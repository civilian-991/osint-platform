import { execute, queryOne, query } from '@/lib/db';
import type {
  AlertInteraction,
  InteractionType,
  UserAlertModel,
  PrioritizedAlert,
} from '@/lib/types/ml';
import type { Alert, AlertType, AlertSeverity } from '@/lib/types/correlation';

// Configuration
const CONFIG = {
  defaultLearningRate: 0.1,
  defaultDecayRate: 0.95,
  batchThresholdCount: 5, // Batch alerts if more than this many pending
  skipThreshold: 0.2, // Skip alerts with relevance below this
  contextBoostMax: 0.5, // Maximum context boost
};

// Alert type base scores (intrinsic importance)
const ALERT_TYPE_BASE_SCORES: Record<AlertType, number> = {
  high_confidence_match: 0.9,
  watchlist_aircraft: 0.85,
  unusual_pattern: 0.75,
  new_correlation: 0.7,
  breaking_news: 0.65,
  region_activity: 0.5,
};

// Severity multipliers
const SEVERITY_MULTIPLIERS: Record<AlertSeverity, number> = {
  critical: 1.5,
  high: 1.2,
  medium: 1.0,
  low: 0.7,
};

export class SmartAlertingService {
  /**
   * Record a user interaction with an alert
   */
  async recordInteraction(
    alertId: string,
    userId: string,
    interactionType: InteractionType,
    metadata?: Record<string, unknown>
  ): Promise<AlertInteraction | null> {
    try {
      // Get alert creation time to calculate time_to_action
      const alert = await queryOne<{ created_at: string }>(
        `SELECT created_at FROM alerts WHERE id = $1`,
        [alertId]
      );

      const timeToAction = alert
        ? Date.now() - new Date(alert.created_at).getTime()
        : null;

      const interaction = await queryOne<AlertInteraction>(
        `INSERT INTO alert_interactions
         (alert_id, user_id, interaction_type, time_to_action_ms, metadata)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [alertId, userId, interactionType, timeToAction, JSON.stringify(metadata || {})]
      );

      // Update user model based on this interaction
      if (interaction) {
        await this.updateUserModel(userId, alertId, interactionType, timeToAction);
      }

      return interaction;
    } catch (error) {
      console.error('Error recording interaction:', error);
      return null;
    }
  }

  /**
   * Get or create user alert model
   */
  async getOrCreateUserModel(userId: string): Promise<UserAlertModel | null> {
    try {
      let model = await queryOne<UserAlertModel>(
        `SELECT * FROM user_alert_models WHERE user_id = $1`,
        [userId]
      );

      if (!model) {
        model = await queryOne<UserAlertModel>(
          `INSERT INTO user_alert_models (user_id)
           VALUES ($1)
           RETURNING *`,
          [userId]
        );
      }

      return model;
    } catch (error) {
      console.error('Error getting/creating user model:', error);
      return null;
    }
  }

  /**
   * Update user model based on an interaction
   */
  private async updateUserModel(
    userId: string,
    alertId: string,
    interactionType: InteractionType,
    timeToActionMs: number | null
  ): Promise<void> {
    try {
      const model = await this.getOrCreateUserModel(userId);
      if (!model) return;

      // Get alert details
      const alert = await queryOne<{
        alert_type: AlertType;
        data: Record<string, unknown>;
        created_at: string;
      }>(
        `SELECT alert_type, data, created_at FROM alerts WHERE id = $1`,
        [alertId]
      );

      if (!alert) return;

      const lr = model.learning_rate;
      const decay = model.decay_rate;

      // Update type preferences
      const typePrefs = { ...model.type_preferences };
      const currentTypePref = typePrefs[alert.alert_type] || 1;

      if (interactionType === 'clicked' || interactionType === 'expanded') {
        // Positive feedback - increase preference
        typePrefs[alert.alert_type] = currentTypePref * (1 - lr) + (currentTypePref + 0.2) * lr;
      } else if (interactionType === 'dismissed' || interactionType === 'ignored') {
        // Negative feedback - decrease preference
        typePrefs[alert.alert_type] = currentTypePref * (1 - lr) + (currentTypePref - 0.2) * lr;
      }

      // Normalize type preferences
      const maxPref = Math.max(...Object.values(typePrefs));
      if (maxPref > 2) {
        for (const key of Object.keys(typePrefs)) {
          typePrefs[key] = typePrefs[key] / maxPref * 2;
        }
      }

      // Update activity patterns
      const alertHour = new Date(alert.created_at).getUTCHours();
      const alertDay = new Date(alert.created_at).getUTCDay();

      const hourlyActivity = { ...model.active_hours };
      const dailyActivity = { ...model.active_days };

      if (interactionType !== 'ignored') {
        // User was active at this time
        hourlyActivity[String(alertHour)] =
          (hourlyActivity[String(alertHour)] || 0) * decay + (1 - decay) * 0.1;

        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        dailyActivity[days[alertDay]] =
          (dailyActivity[days[alertDay]] || 0) * decay + (1 - decay) * 0.15;
      }

      // Update engagement metrics
      let clickThroughRate = model.click_through_rate;
      let dismissRate = model.dismiss_rate;
      let avgTimeToAction = model.avg_time_to_action_ms;

      if (interactionType === 'clicked' || interactionType === 'expanded') {
        clickThroughRate = clickThroughRate * decay + (1 - decay);
      } else {
        clickThroughRate = clickThroughRate * decay;
      }

      if (interactionType === 'dismissed') {
        dismissRate = dismissRate * decay + (1 - decay);
      } else {
        dismissRate = dismissRate * decay;
      }

      if (timeToActionMs !== null) {
        avgTimeToAction = Math.round(avgTimeToAction * decay + timeToActionMs * (1 - decay));
      }

      // Update region preferences if present
      const regionPrefs = { ...model.region_preferences };
      const region = alert.data?.region as string | undefined;
      if (region) {
        const currentRegionPref = regionPrefs[region] || 1;
        if (interactionType === 'clicked' || interactionType === 'expanded') {
          regionPrefs[region] = currentRegionPref * (1 - lr) + (currentRegionPref + 0.15) * lr;
        }
      }

      // Update aircraft type preferences if present
      const aircraftPrefs = { ...model.aircraft_type_preferences };
      const aircraftType = alert.data?.military_category as string | undefined;
      if (aircraftType) {
        const currentAircraftPref = aircraftPrefs[aircraftType] || 1;
        if (interactionType === 'clicked' || interactionType === 'expanded') {
          aircraftPrefs[aircraftType] =
            currentAircraftPref * (1 - lr) + (currentAircraftPref + 0.15) * lr;
        }
      }

      // Save updated model
      await execute(
        `UPDATE user_alert_models SET
           type_preferences = $1,
           region_preferences = $2,
           aircraft_type_preferences = $3,
           active_hours = $4,
           active_days = $5,
           click_through_rate = $6,
           dismiss_rate = $7,
           avg_time_to_action_ms = $8,
           total_interactions = total_interactions + 1,
           updated_at = NOW()
         WHERE user_id = $9`,
        [
          JSON.stringify(typePrefs),
          JSON.stringify(regionPrefs),
          JSON.stringify(aircraftPrefs),
          JSON.stringify(hourlyActivity),
          JSON.stringify(dailyActivity),
          Math.round(clickThroughRate * 100) / 100,
          Math.round(dismissRate * 100) / 100,
          avgTimeToAction,
          userId,
        ]
      );
    } catch (error) {
      console.error('Error updating user model:', error);
    }
  }

  /**
   * Prioritize alerts for a user
   */
  async prioritizeAlerts(userId: string): Promise<PrioritizedAlert[]> {
    try {
      const model = await this.getOrCreateUserModel(userId);

      // Get unread alerts for user
      const alerts = await query<{
        id: string;
        alert_type: AlertType;
        severity: AlertSeverity;
        data: Record<string, unknown>;
        created_at: string;
      }>(
        `SELECT id, alert_type, severity, data, created_at
         FROM alerts
         WHERE (user_id = $1 OR user_id IS NULL)
         AND is_read = FALSE
         AND is_dismissed = FALSE
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      );

      const prioritized: PrioritizedAlert[] = [];

      for (const alert of alerts) {
        const baseScore =
          (ALERT_TYPE_BASE_SCORES[alert.alert_type] || 0.5) *
          (SEVERITY_MULTIPLIERS[alert.severity] || 1);

        const userRelevance = model
          ? this.calculateUserRelevance(model, alert)
          : 1;

        const contextBoost = this.calculateContextBoost(alert);

        const finalScore = baseScore * userRelevance * (1 + contextBoost);

        let recommendation: 'send' | 'batch' | 'skip' = 'send';
        if (finalScore < CONFIG.skipThreshold) {
          recommendation = 'skip';
        } else if (alerts.length > CONFIG.batchThresholdCount && finalScore < 0.5) {
          recommendation = 'batch';
        }

        prioritized.push({
          alert_id: alert.id,
          base_score: Math.round(baseScore * 100) / 100,
          user_relevance: Math.round(userRelevance * 100) / 100,
          context_boost: Math.round(contextBoost * 100) / 100,
          final_score: Math.round(finalScore * 100) / 100,
          recommendation,
        });
      }

      // Sort by final score
      prioritized.sort((a, b) => b.final_score - a.final_score);

      return prioritized;
    } catch (error) {
      console.error('Error prioritizing alerts:', error);
      return [];
    }
  }

  /**
   * Calculate user relevance score for an alert
   */
  private calculateUserRelevance(
    model: UserAlertModel,
    alert: {
      alert_type: AlertType;
      data: Record<string, unknown>;
      created_at: string;
    }
  ): number {
    let relevance = 1;

    // Type preference
    const typePref = model.type_preferences[alert.alert_type];
    if (typePref !== undefined) {
      relevance *= typePref;
    }

    // Region preference
    const region = alert.data?.region as string | undefined;
    if (region && model.region_preferences[region] !== undefined) {
      relevance *= model.region_preferences[region];
    }

    // Aircraft type preference
    const aircraftType = alert.data?.military_category as string | undefined;
    if (aircraftType && model.aircraft_type_preferences[aircraftType] !== undefined) {
      relevance *= model.aircraft_type_preferences[aircraftType];
    }

    // Time relevance (is user typically active at this time?)
    const alertHour = new Date(alert.created_at).getUTCHours();
    const hourActivity = model.active_hours[String(alertHour)];
    if (hourActivity !== undefined) {
      // Boost if user is typically active at this hour
      relevance *= 1 + hourActivity;
    }

    // Engagement score - users who engage more should see more
    relevance *= 1 + model.click_through_rate * 0.2;

    // Penalize if user dismisses a lot
    relevance *= 1 - model.dismiss_rate * 0.3;

    return Math.max(0.1, Math.min(2, relevance));
  }

  /**
   * Calculate context boost for an alert
   */
  private calculateContextBoost(alert: {
    alert_type: AlertType;
    severity: AlertSeverity;
    data: Record<string, unknown>;
    created_at: string;
  }): number {
    let boost = 0;

    // Recency boost - newer alerts get higher boost
    const ageMinutes =
      (Date.now() - new Date(alert.created_at).getTime()) / (1000 * 60);
    if (ageMinutes < 5) {
      boost += 0.3;
    } else if (ageMinutes < 30) {
      boost += 0.15;
    }

    // Severity boost
    if (alert.severity === 'critical') {
      boost += 0.2;
    } else if (alert.severity === 'high') {
      boost += 0.1;
    }

    // Special event boost (could check against current events)
    const confidence = alert.data?.confidence as number | undefined;
    if (confidence && confidence > 0.8) {
      boost += 0.15;
    }

    return Math.min(CONFIG.contextBoostMax, boost);
  }

  /**
   * Get alerts for a user with prioritization
   */
  async getAlertsForUser(
    userId: string,
    options: {
      limit?: number;
      includeRead?: boolean;
      minScore?: number;
    } = {}
  ): Promise<
    Array<{
      alert: Alert;
      priority: PrioritizedAlert;
    }>
  > {
    try {
      const { limit = 20, includeRead = false, minScore = 0 } = options;

      const prioritized = await this.prioritizeAlerts(userId);

      // Filter by minimum score
      const filtered = prioritized.filter((p) => p.final_score >= minScore);

      // Get full alert data for top alerts
      const topAlerts = filtered.slice(0, limit);
      const alertIds = topAlerts.map((p) => p.alert_id);

      if (alertIds.length === 0) {
        return [];
      }

      const alerts = await query<Alert>(
        `SELECT * FROM alerts
         WHERE id = ANY($1)
         ${includeRead ? '' : 'AND is_read = FALSE'}`,
        [alertIds]
      );

      const alertMap = new Map(alerts.map((a) => [a.id, a]));

      return topAlerts
        .filter((p) => alertMap.has(p.alert_id))
        .map((p) => ({
          alert: alertMap.get(p.alert_id)!,
          priority: p,
        }));
    } catch (error) {
      console.error('Error getting alerts for user:', error);
      return [];
    }
  }

  /**
   * Predict engagement probability for an alert
   */
  async predictEngagement(
    userId: string,
    alertType: AlertType,
    severity: AlertSeverity,
    data: Record<string, unknown>
  ): Promise<{
    clickProbability: number;
    dismissProbability: number;
    recommended: boolean;
  }> {
    try {
      const model = await this.getOrCreateUserModel(userId);
      if (!model) {
        return {
          clickProbability: 0.5,
          dismissProbability: 0.2,
          recommended: true,
        };
      }

      // Base click probability from model
      let clickProb = model.click_through_rate;
      let dismissProb = model.dismiss_rate;

      // Adjust based on type preference
      const typePref = model.type_preferences[alertType] || 1;
      clickProb *= typePref;
      dismissProb /= typePref;

      // Adjust based on severity
      if (severity === 'critical' || severity === 'high') {
        clickProb *= 1.3;
        dismissProb *= 0.7;
      }

      // Normalize
      clickProb = Math.min(0.95, Math.max(0.05, clickProb));
      dismissProb = Math.min(0.95, Math.max(0.05, dismissProb));

      return {
        clickProbability: Math.round(clickProb * 100) / 100,
        dismissProbability: Math.round(dismissProb * 100) / 100,
        recommended: clickProb > dismissProb && clickProb > 0.3,
      };
    } catch {
      return {
        clickProbability: 0.5,
        dismissProbability: 0.2,
        recommended: true,
      };
    }
  }

  /**
   * Get interaction statistics for a user
   */
  async getUserInteractionStats(userId: string): Promise<{
    total_interactions: number;
    by_type: Record<string, number>;
    avg_time_to_action_ms: number;
    most_engaged_alert_types: string[];
  }> {
    try {
      const totalResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM alert_interactions WHERE user_id = $1`,
        [userId]
      );

      const byTypeResults = await query<{ interaction_type: string; count: string }>(
        `SELECT interaction_type, COUNT(*) as count
         FROM alert_interactions
         WHERE user_id = $1
         GROUP BY interaction_type`,
        [userId]
      );

      const avgTime = await queryOne<{ avg_time: string }>(
        `SELECT AVG(time_to_action_ms) as avg_time
         FROM alert_interactions
         WHERE user_id = $1 AND time_to_action_ms IS NOT NULL`,
        [userId]
      );

      const engagedTypes = await query<{ alert_type: string }>(
        `SELECT a.alert_type
         FROM alert_interactions ai
         JOIN alerts a ON a.id = ai.alert_id
         WHERE ai.user_id = $1
         AND ai.interaction_type IN ('clicked', 'expanded')
         GROUP BY a.alert_type
         ORDER BY COUNT(*) DESC
         LIMIT 3`,
        [userId]
      );

      const byType: Record<string, number> = {};
      for (const row of byTypeResults) {
        byType[row.interaction_type] = parseInt(row.count, 10);
      }

      return {
        total_interactions: parseInt(totalResult?.count || '0', 10),
        by_type: byType,
        avg_time_to_action_ms: parseInt(avgTime?.avg_time || '0', 10),
        most_engaged_alert_types: engagedTypes.map((e) => e.alert_type),
      };
    } catch {
      return {
        total_interactions: 0,
        by_type: {},
        avg_time_to_action_ms: 0,
        most_engaged_alert_types: [],
      };
    }
  }

  /**
   * Get overall alerting statistics
   */
  async getStats(): Promise<{
    total_models: number;
    total_interactions: number;
    avg_click_through_rate: number;
    avg_dismiss_rate: number;
  }> {
    try {
      const modelStats = await queryOne<{
        count: string;
        avg_ctr: string;
        avg_dismiss: string;
      }>(
        `SELECT
           COUNT(*) as count,
           AVG(click_through_rate) as avg_ctr,
           AVG(dismiss_rate) as avg_dismiss
         FROM user_alert_models`
      );

      const interactionCount = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM alert_interactions`
      );

      return {
        total_models: parseInt(modelStats?.count || '0', 10),
        total_interactions: parseInt(interactionCount?.count || '0', 10),
        avg_click_through_rate: parseFloat(modelStats?.avg_ctr || '0'),
        avg_dismiss_rate: parseFloat(modelStats?.avg_dismiss || '0'),
      };
    } catch {
      return {
        total_models: 0,
        total_interactions: 0,
        avg_click_through_rate: 0,
        avg_dismiss_rate: 0,
      };
    }
  }
}

// Export singleton instance
export const smartAlertingService = new SmartAlertingService();
