/**
 * Intelligence Alert Generation Service
 *
 * Generates actionable intelligence alerts by correlating:
 * - Aircraft tracking data (formations, patterns, counts)
 * - News events (GDELT, corroborated stories)
 * - Anomaly detections
 * - Regional activity patterns
 */

import { query, queryOne, execute } from '@/lib/db';
import { geminiClient } from './gemini-client';
import type { FormationDetection } from '@/lib/types/ml';

export interface IntelligenceAlert {
  type: 'flash_alert' | 'formation_alert' | 'activity_spike' | 'news_correlation' | 'regional_alert';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  data: {
    aircraft?: Array<{
      callsign: string;
      type: string;
      operator?: string;
      icao_hex: string;
    }>;
    formation?: {
      type: string;
      aircraft_count: number;
      confidence: number;
    };
    news?: Array<{
      title: string;
      source: string;
      url?: string;
    }>;
    region?: string;
    activity_count?: number;
    baseline_count?: number;
    anomalies?: string[];
  };
}

interface RegionConfig {
  name: string;
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  baselineCount: number; // Expected normal aircraft count
}

const MONITORED_REGIONS: RegionConfig[] = [
  { name: 'Lebanon', bounds: { minLat: 33.0, maxLat: 34.7, minLon: 35.1, maxLon: 36.6 }, baselineCount: 2 },
  { name: 'Israel', bounds: { minLat: 29.5, maxLat: 33.3, minLon: 34.2, maxLon: 35.9 }, baselineCount: 5 },
  { name: 'Syria', bounds: { minLat: 32.3, maxLat: 37.3, minLon: 35.7, maxLon: 42.4 }, baselineCount: 3 },
  { name: 'Iran', bounds: { minLat: 25.0, maxLat: 40.0, minLon: 44.0, maxLon: 63.3 }, baselineCount: 4 },
  { name: 'Iraq', bounds: { minLat: 29.0, maxLat: 37.4, minLon: 38.8, maxLon: 48.6 }, baselineCount: 3 },
  { name: 'Persian Gulf', bounds: { minLat: 24.0, maxLat: 30.0, minLon: 48.0, maxLon: 56.5 }, baselineCount: 6 },
  { name: 'Red Sea', bounds: { minLat: 12.5, maxLat: 30.0, minLon: 32.0, maxLon: 44.0 }, baselineCount: 4 },
  { name: 'Mediterranean', bounds: { minLat: 31.0, maxLat: 37.0, minLon: 25.0, maxLon: 36.0 }, baselineCount: 8 },
];

// High-interest aircraft types
const STRATEGIC_AIRCRAFT = ['B52', 'B1B', 'B2', 'KC135', 'KC10', 'KC46', 'E3', 'E8', 'RC135', 'EP3', 'P8', 'RQ4', 'MQ9'];
const FIGHTER_TYPES = ['F15', 'F16', 'F18', 'F22', 'F35', 'FA18', 'F15E', 'F15C', 'F16C'];

class IntelligenceAlertService {
  /**
   * Main entry point - analyze current situation and generate alerts
   */
  async generateAlerts(): Promise<IntelligenceAlert[]> {
    const alerts: IntelligenceAlert[] = [];

    try {
      // 1. Check for formations
      const formationAlerts = await this.checkFormations();
      alerts.push(...formationAlerts);

      // 2. Check for regional activity spikes
      const activityAlerts = await this.checkRegionalActivity();
      alerts.push(...activityAlerts);

      // 3. Check for strategic aircraft movements
      const strategicAlerts = await this.checkStrategicMovements();
      alerts.push(...strategicAlerts);

      // 4. Correlate with recent news
      const correlatedAlerts = await this.correlateWithNews(alerts);

      // 5. Generate composite intelligence alerts for high-severity situations
      const compositeAlerts = await this.generateCompositeAlerts(correlatedAlerts);

      // 6. Store alerts in database
      await this.storeAlerts(compositeAlerts);

      return compositeAlerts;
    } catch (error) {
      console.error('Error generating intelligence alerts:', error);
      return alerts;
    }
  }

  /**
   * Check for active formations
   */
  private async checkFormations(): Promise<IntelligenceAlert[]> {
    const alerts: IntelligenceAlert[] = [];

    const formations = await query<FormationDetection & { positions_data: string }>(
      `SELECT f.*, f.metadata::text as positions_data
       FROM formation_detections f
       WHERE f.detected_at > NOW() - INTERVAL '30 minutes'
       AND f.confidence > 0.7
       ORDER BY f.confidence DESC`
    );

    for (const formation of formations) {
      const aircraftCount = formation.aircraft_ids?.length || 0;
      const formationType = formation.formation_type;

      // Determine severity based on formation type and size
      let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';
      if (formationType === 'strike_package' && aircraftCount >= 4) {
        severity = 'critical';
      } else if (formationType === 'strike_package' || aircraftCount >= 6) {
        severity = 'high';
      } else if (formationType === 'tanker_receiver') {
        severity = 'high'; // Refueling often precedes operations
      }

      const formationLabels: Record<string, string> = {
        tanker_receiver: 'Aerial Refueling Operation',
        escort: 'Escort Formation',
        strike_package: 'Strike Package',
        cap: 'Combat Air Patrol',
      };

      alerts.push({
        type: 'formation_alert',
        severity,
        title: `${formationLabels[formationType] || 'Formation'} Detected`,
        description: `${aircraftCount} aircraft detected in ${formationLabels[formationType]?.toLowerCase() || 'formation'} configuration`,
        data: {
          formation: {
            type: formationType,
            aircraft_count: aircraftCount,
            confidence: formation.confidence,
          },
        },
      });
    }

    return alerts;
  }

  /**
   * Check for regional activity spikes
   */
  private async checkRegionalActivity(): Promise<IntelligenceAlert[]> {
    const alerts: IntelligenceAlert[] = [];

    for (const region of MONITORED_REGIONS) {
      const result = await queryOne<{ count: string; aircraft_list: unknown }>(
        `SELECT
           COUNT(DISTINCT p.icao_hex) as count,
           jsonb_agg(DISTINCT jsonb_build_object(
             'callsign', p.callsign,
             'type', a.type_code,
             'operator', a.operator,
             'icao_hex', p.icao_hex
           )) as aircraft_list
         FROM positions_latest p
         LEFT JOIN aircraft a ON p.icao_hex = a.icao_hex
         WHERE p.latitude BETWEEN $1 AND $2
         AND p.longitude BETWEEN $3 AND $4
         AND p.updated_at > NOW() - INTERVAL '10 minutes'`,
        [region.bounds.minLat, region.bounds.maxLat, region.bounds.minLon, region.bounds.maxLon]
      );

      const count = parseInt(result?.count || '0');
      const aircraftList = result?.aircraft_list as Array<{
        callsign: string;
        type: string;
        operator?: string;
        icao_hex: string;
      }> || [];

      // Check for significant activity above baseline
      const ratio = count / Math.max(region.baselineCount, 1);

      if (ratio >= 3 && count >= 6) {
        // Critical - 3x normal activity
        alerts.push({
          type: 'activity_spike',
          severity: 'critical',
          title: `Critical Activity Surge - ${region.name}`,
          description: `${count} military aircraft detected in ${region.name} region (${Math.round(ratio)}x normal levels)`,
          data: {
            region: region.name,
            activity_count: count,
            baseline_count: region.baselineCount,
            aircraft: aircraftList.slice(0, 10), // Limit to 10 for display
          },
        });
      } else if (ratio >= 2 && count >= 4) {
        // High - 2x normal activity
        alerts.push({
          type: 'activity_spike',
          severity: 'high',
          title: `Elevated Activity - ${region.name}`,
          description: `${count} military aircraft detected in ${region.name} region (${Math.round(ratio)}x normal levels)`,
          data: {
            region: region.name,
            activity_count: count,
            baseline_count: region.baselineCount,
            aircraft: aircraftList.slice(0, 10),
          },
        });
      }
    }

    return alerts;
  }

  /**
   * Check for strategic aircraft movements
   */
  private async checkStrategicMovements(): Promise<IntelligenceAlert[]> {
    const alerts: IntelligenceAlert[] = [];

    // Check for strategic bombers/tankers
    const strategicAircraft = await query<{
      type_code: string;
      count: string;
      aircraft_list: unknown;
    }>(
      `SELECT
         a.type_code,
         COUNT(*) as count,
         jsonb_agg(jsonb_build_object(
           'callsign', p.callsign,
           'type', a.type_code,
           'operator', a.operator,
           'icao_hex', p.icao_hex,
           'altitude', p.altitude,
           'heading', p.track
         )) as aircraft_list
       FROM positions_latest p
       JOIN aircraft a ON p.icao_hex = a.icao_hex
       WHERE a.type_code = ANY($1)
       AND p.updated_at > NOW() - INTERVAL '10 minutes'
       GROUP BY a.type_code
       HAVING COUNT(*) >= 2`,
      [STRATEGIC_AIRCRAFT]
    );

    for (const group of strategicAircraft) {
      const count = parseInt(group.count);
      const aircraftList = group.aircraft_list as Array<{
        callsign: string;
        type: string;
        operator?: string;
        icao_hex: string;
      }>;

      const typeLabels: Record<string, string> = {
        B52: 'B-52 Stratofortress bombers',
        B1B: 'B-1B Lancer bombers',
        B2: 'B-2 Spirit stealth bombers',
        KC135: 'KC-135 tankers',
        KC10: 'KC-10 tankers',
        KC46: 'KC-46 tankers',
        E3: 'E-3 AWACS',
        E8: 'E-8 JSTARS',
        RC135: 'RC-135 reconnaissance',
        RQ4: 'RQ-4 Global Hawk drones',
      };

      const label = typeLabels[group.type_code] || `${group.type_code} aircraft`;
      const isBomber = ['B52', 'B1B', 'B2'].includes(group.type_code);

      alerts.push({
        type: 'regional_alert',
        severity: isBomber ? 'critical' : 'high',
        title: `Strategic Movement: ${count} ${label}`,
        description: `${count} ${label} detected active in monitored airspace`,
        data: {
          aircraft: aircraftList,
        },
      });
    }

    // Check for large fighter groups
    const fighterGroups = await query<{
      type_code: string;
      count: string;
      aircraft_list: unknown;
    }>(
      `SELECT
         a.type_code,
         COUNT(*) as count,
         jsonb_agg(jsonb_build_object(
           'callsign', p.callsign,
           'type', a.type_code,
           'operator', a.operator,
           'icao_hex', p.icao_hex
         )) as aircraft_list
       FROM positions_latest p
       JOIN aircraft a ON p.icao_hex = a.icao_hex
       WHERE a.type_code = ANY($1)
       AND p.updated_at > NOW() - INTERVAL '10 minutes'
       GROUP BY a.type_code
       HAVING COUNT(*) >= 6`,
      [FIGHTER_TYPES]
    );

    for (const group of fighterGroups) {
      const count = parseInt(group.count);
      const aircraftList = group.aircraft_list as Array<{
        callsign: string;
        type: string;
        operator?: string;
        icao_hex: string;
      }>;

      alerts.push({
        type: 'regional_alert',
        severity: count >= 10 ? 'critical' : 'high',
        title: `Large Fighter Deployment: ${count} ${group.type_code}`,
        description: `${count} ${group.type_code} fighters detected active`,
        data: {
          aircraft: aircraftList,
        },
      });
    }

    return alerts;
  }

  /**
   * Correlate alerts with recent news
   */
  private async correlateWithNews(alerts: IntelligenceAlert[]): Promise<IntelligenceAlert[]> {
    // Get recent relevant news
    const recentNews = await query<{
      title: string;
      source_name: string;
      url: string;
      tone: number;
      goldstein_scale: number;
    }>(
      `SELECT title, source_name, url, tone, goldstein_scale
       FROM news_events
       WHERE fetched_at > NOW() - INTERVAL '6 hours'
       AND (
         title ILIKE '%military%' OR
         title ILIKE '%aircraft%' OR
         title ILIKE '%strike%' OR
         title ILIKE '%attack%' OR
         title ILIKE '%iran%' OR
         title ILIKE '%israel%' OR
         title ILIKE '%lebanon%' OR
         title ILIKE '%syria%' OR
         title ILIKE '%hezbollah%' OR
         title ILIKE '%houthi%' OR
         title ILIKE '%missile%' OR
         title ILIKE '%drone%' OR
         title ILIKE '%air force%' OR
         title ILIKE '%bomber%' OR
         title ILIKE '%fighter%'
       )
       ORDER BY fetched_at DESC
       LIMIT 10`
    );

    // Attach relevant news to alerts
    for (const alert of alerts) {
      const relevantNews = recentNews.filter(news => {
        // Simple keyword matching
        const region = alert.data.region?.toLowerCase() || '';
        const titleLower = news.title.toLowerCase();

        return (
          (region && titleLower.includes(region)) ||
          (alert.type === 'formation_alert' && (titleLower.includes('strike') || titleLower.includes('attack'))) ||
          (alert.severity === 'critical' && news.goldstein_scale < -5) // Negative events
        );
      });

      if (relevantNews.length > 0) {
        alert.data.news = relevantNews.map(n => ({
          title: n.title,
          source: n.source_name,
          url: n.url,
        }));
      }
    }

    return alerts;
  }

  /**
   * Generate composite "Red Alert" type intelligence summaries
   */
  private async generateCompositeAlerts(alerts: IntelligenceAlert[]): Promise<IntelligenceAlert[]> {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'high');

    // If we have multiple high-severity alerts, generate a composite intelligence summary
    if (criticalAlerts.length >= 2) {
      // Collect all aircraft from alerts
      const allAircraft = criticalAlerts
        .flatMap(a => a.data.aircraft || [])
        .filter((a, i, arr) => arr.findIndex(b => b.icao_hex === a.icao_hex) === i);

      // Collect all news
      const allNews = criticalAlerts
        .flatMap(a => a.data.news || [])
        .filter((n, i, arr) => arr.findIndex(b => b.title === n.title) === i)
        .slice(0, 5);

      // Get regions
      const regions = [...new Set(criticalAlerts.map(a => a.data.region).filter(Boolean))];

      // Generate summary using Gemini if available
      let summary = '';
      try {
        const context = {
          alerts: criticalAlerts.map(a => ({ type: a.type, title: a.title, description: a.description })),
          aircraft_count: allAircraft.length,
          regions,
          news: allNews.map(n => n.title),
        };

        const prompt = `Generate a brief (2-3 sentences) intelligence summary for military aviation activity:
${JSON.stringify(context, null, 2)}

Focus on: what's happening, where, and potential significance. Be factual and concise.`;

        const result = await geminiClient.generateContent({ prompt, model: 'flash' });
        summary = result.text || '';
      } catch {
        // Fallback summary
        summary = `Multiple high-priority events detected: ${criticalAlerts.length} alerts across ${regions.join(', ') || 'monitored regions'}. ${allAircraft.length} military aircraft tracked.`;
      }

      // Create composite flash alert
      const flashAlert: IntelligenceAlert = {
        type: 'flash_alert',
        severity: 'critical',
        title: `FLASH: Significant Military Activity`,
        description: summary,
        data: {
          aircraft: allAircraft.slice(0, 15),
          news: allNews,
          region: regions.join(', '),
          activity_count: allAircraft.length,
          anomalies: criticalAlerts.map(a => a.title),
        },
      };

      // Return flash alert first, then individual alerts
      return [flashAlert, ...alerts];
    }

    return alerts;
  }

  /**
   * Store alerts in database
   */
  private async storeAlerts(alerts: IntelligenceAlert[]): Promise<void> {
    for (const alert of alerts) {
      // Check for duplicate alert in last 30 minutes
      const existing = await queryOne<{ id: string }>(
        `SELECT id FROM alerts
         WHERE alert_type = $1
         AND title = $2
         AND created_at > NOW() - INTERVAL '30 minutes'`,
        [alert.type, alert.title]
      );

      if (existing) continue; // Skip duplicate

      await execute(
        `INSERT INTO alerts (user_id, alert_type, severity, title, description, data, created_at)
         VALUES (NULL, $1, $2, $3, $4, $5, NOW())`,
        [alert.type, alert.severity, alert.title, alert.description, JSON.stringify(alert.data)]
      );
    }
  }

  /**
   * Get current intelligence summary
   */
  async getIntelligenceSummary(): Promise<{
    threat_level: 'low' | 'elevated' | 'high' | 'critical';
    active_alerts: number;
    aircraft_tracked: number;
    formations_active: number;
    regions_active: string[];
    summary: string;
  }> {
    const [alertCount, aircraftCount, formationCount, regionalActivity] = await Promise.all([
      queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM alerts WHERE created_at > NOW() - INTERVAL '1 hour' AND severity IN ('critical', 'high')`),
      queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM positions_latest WHERE updated_at > NOW() - INTERVAL '10 minutes'`),
      queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM formation_detections WHERE detected_at > NOW() - INTERVAL '30 minutes'`),
      query<{ region: string; count: string }>(`
        SELECT
          CASE
            WHEN latitude BETWEEN 33.0 AND 34.7 AND longitude BETWEEN 35.1 AND 36.6 THEN 'Lebanon'
            WHEN latitude BETWEEN 29.5 AND 33.3 AND longitude BETWEEN 34.2 AND 35.9 THEN 'Israel'
            WHEN latitude BETWEEN 32.3 AND 37.3 AND longitude BETWEEN 35.7 AND 42.4 THEN 'Syria'
            WHEN latitude BETWEEN 25.0 AND 40.0 AND longitude BETWEEN 44.0 AND 63.3 THEN 'Iran'
            ELSE 'Other'
          END as region,
          COUNT(*) as count
        FROM positions_latest
        WHERE updated_at > NOW() - INTERVAL '10 minutes'
        GROUP BY region
        HAVING COUNT(*) >= 3
      `),
    ]);

    const alerts = parseInt(alertCount?.count || '0');
    const aircraft = parseInt(aircraftCount?.count || '0');
    const formations = parseInt(formationCount?.count || '0');
    const regions = regionalActivity.map(r => r.region).filter(r => r !== 'Other');

    // Determine threat level
    let threat_level: 'low' | 'elevated' | 'high' | 'critical' = 'low';
    if (alerts >= 3 || formations >= 2) {
      threat_level = 'critical';
    } else if (alerts >= 2 || formations >= 1) {
      threat_level = 'high';
    } else if (aircraft >= 10 || regions.length >= 3) {
      threat_level = 'elevated';
    }

    return {
      threat_level,
      active_alerts: alerts,
      aircraft_tracked: aircraft,
      formations_active: formations,
      regions_active: regions,
      summary: `${aircraft} aircraft tracked across ${regions.length} active regions. ${formations} formations detected.`,
    };
  }
}

export const intelligenceAlertService = new IntelligenceAlertService();
