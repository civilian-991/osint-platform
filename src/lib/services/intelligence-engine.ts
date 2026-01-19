import { execute, queryOne, query } from '@/lib/db';
import {
  geminiClient,
  buildIntentClassificationPrompt,
  buildThreatAnalysisPrompt,
  buildAnomalyAnalysisPrompt,
} from './gemini-client';
import { behavioralProfiler } from './behavioral-profiler';
import { embeddingService } from './embedding-service';
import { calibrateConfidence, recordPredictionOutcome } from './confidence-calibrator';
import { applyThreshold, updateThreshold } from './adaptive-thresholds';
import {
  createExplanation,
  createAnomalyExplanation,
  createIntentExplanation,
  generateCounterfactuals,
} from './explainability-engine';
import { contextIntelligence } from './context-intelligence';
import type {
  AnomalyDetection,
  AnomalyType,
  IntentClassification,
  FlightIntent,
  IntentEvidence,
  AlternativeIntent,
  ThreatAssessment,
  ThreatLevel,
  ThreatEntityType,
  ThreatFactors,
  ThreatRecommendation,
  PositionData,
  NearbyAircraft,
  THREAT_WEIGHTS,
  getThreatLevel,
} from '@/lib/types/ml';
import type { Aircraft, MilitaryCategory } from '@/lib/types/aircraft';

// Configuration
const CONFIG = {
  anomalyThreshold: 0.6, // Minimum deviation score to trigger anomaly detection
  intentConfidenceThreshold: 0.5,
  threatValidityHours: 6, // How long threat assessments are valid
};

// Weight constants (adjusted to include location context)
const THREAT_WEIGHT_VALUES = {
  patternAnomaly: 0.20,
  regionalTension: 0.15,
  newsCorrelation: 0.20,
  historicalContext: 0.15,
  formationActivity: 0.10,
  locationContext: 0.20, // New: infrastructure, airspace, activity zone awareness
};

export class IntelligenceEngine {
  /**
   * Detect anomalies for an aircraft based on behavioral profile
   */
  async detectAnomalies(
    aircraftId: string,
    flightId: string | null,
    positions: PositionData[],
    pattern?: string
  ): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];

    try {
      // Check for deviations from behavioral profile
      const deviationResult = await behavioralProfiler.checkDeviation(
        aircraftId,
        positions,
        pattern
      );

      if (!deviationResult.hasDeviation) {
        return [];
      }

      // Get aircraft info for better analysis
      const aircraft = await queryOne<Aircraft>(
        `SELECT * FROM aircraft WHERE id = $1`,
        [aircraftId]
      );

      for (const deviation of deviationResult.deviations) {
        // Apply adaptive threshold for anomaly detection
        const thresholdResult = await applyThreshold(
          'anomaly_detection',
          deviation.type,
          deviation.severity
        );

        // Only create anomaly if severity exceeds adaptive threshold
        if (!thresholdResult.exceeds) {
          continue;
        }

        // Calibrate confidence score
        const calibration = await calibrateConfidence('anomaly_detection', deviation.severity);
        const calibratedSeverity = calibration.calibratedScore;

        let analysis: string | null = null;

        // Use Gemini for high-severity anomalies
        if (calibratedSeverity >= 0.7 && geminiClient.isEnabled()) {
          try {
            const prompt = buildAnomalyAnalysisPrompt(
              aircraft?.type_code || 'Unknown',
              deviation.detected as Record<string, unknown>,
              deviation.expected as Record<string, unknown>
            );

            const response = await geminiClient.generateContent({
              prompt,
              model: 'flash',
              temperature: 0.3,
            });

            analysis = response.text;
          } catch (error) {
            console.error('Error generating anomaly analysis:', error);
          }
        }

        // Store the anomaly
        const anomaly = await queryOne<AnomalyDetection>(
          `INSERT INTO anomaly_detections
           (aircraft_id, flight_id, anomaly_type, severity, detected_value, expected_value, deviation_score, analysis, confidence)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            aircraftId,
            flightId,
            deviation.type as AnomalyType,
            calibratedSeverity,
            JSON.stringify(deviation.detected),
            JSON.stringify(deviation.expected),
            deviation.severity, // Original score
            analysis,
            thresholdResult.confidence,
          ]
        );

        if (anomaly) {
          anomalies.push(anomaly);

          // Create explainability record
          const detectedFeatures = deviation.detected as Record<string, unknown>;
          const explainData = createAnomalyExplanation(
            calibratedSeverity,
            {
              altitudeDeviation: detectedFeatures.avgAltitude as number | undefined,
              speedDeviation: detectedFeatures.avgSpeed as number | undefined,
              patternUnusual: deviation.type === 'pattern',
              regionUnusual: deviation.type === 'route',
              timeUnusual: deviation.type === 'timing',
              trackErratic: false,
            }
          );

          await createExplanation(
            anomaly.id,
            'aircraft',
            aircraftId,
            'anomaly',
            {
              finalScore: calibratedSeverity,
              factors: explainData.factors,
              topFeatures: explainData.topFeatures,
            }
          );

          // Record prediction outcome for calibration training
          await recordPredictionOutcome(
            'anomaly_detection',
            'aircraft',
            aircraftId,
            deviation.severity,
            undefined,
            calibratedSeverity
          );
        }
      }

      return anomalies;
    } catch (error) {
      console.error('Error detecting anomalies:', error);
      return [];
    }
  }

  /**
   * Classify the intent of a flight
   */
  async classifyIntent(
    aircraftId: string,
    flightId: string | null,
    aircraftType: string | null,
    militaryCategory: MilitaryCategory | null,
    pattern: string | null,
    positions: PositionData[],
    nearbyAircraft: NearbyAircraft[] = []
  ): Promise<IntentClassification | null> {
    try {
      // Determine region from positions
      let region = 'Unknown';
      if (positions.length > 0) {
        const avgLat = positions.reduce((s, p) => s + p.latitude, 0) / positions.length;
        const avgLon = positions.reduce((s, p) => s + p.longitude, 0) / positions.length;
        region = this.getRegionName(avgLat, avgLon);
      }

      let intent: FlightIntent;
      let confidence: number;
      let evidence: IntentEvidence[] = [];
      let reasoning: string | null = null;
      let alternativeIntents: AlternativeIntent[] = [];

      if (geminiClient.isEnabled()) {
        // Use Gemini for classification
        const prompt = buildIntentClassificationPrompt(
          aircraftType || militaryCategory || 'Unknown',
          pattern || 'straight',
          nearbyAircraft.map(
            (a) => `${a.aircraft_type || 'Unknown'} at ${a.distance_nm.toFixed(1)}nm`
          ),
          region
        );

        try {
          const response = await geminiClient.generateContent({
            prompt,
            model: 'pro',
            temperature: 0.3,
            jsonMode: true,
          });

          const parsed = JSON.parse(response.text);
          intent = parsed.intent || 'transit';
          confidence = parsed.confidence || 0.5;
          evidence = (parsed.evidence || []).map((e: string) => ({
            type: 'gemini_analysis',
            description: e,
            weight: 1,
          }));
          reasoning = parsed.reasoning || null;
          alternativeIntents = parsed.alternative_intents || [];
        } catch (parseError) {
          console.error('Error parsing intent classification:', parseError);
          // Fall back to heuristic classification
          return this.heuristicIntentClassification(
            aircraftId,
            flightId,
            militaryCategory,
            pattern,
            nearbyAircraft
          );
        }
      } else {
        // Heuristic classification
        return this.heuristicIntentClassification(
          aircraftId,
          flightId,
          militaryCategory,
          pattern,
          nearbyAircraft
        );
      }

      // Store classification
      const classification = await queryOne<IntentClassification>(
        `INSERT INTO intent_classifications
         (aircraft_id, flight_id, intent, confidence, evidence, reasoning, alternative_intents, model_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (aircraft_id, flight_id) DO UPDATE SET
           intent = EXCLUDED.intent,
           confidence = EXCLUDED.confidence,
           evidence = EXCLUDED.evidence,
           reasoning = EXCLUDED.reasoning,
           alternative_intents = EXCLUDED.alternative_intents,
           model_version = EXCLUDED.model_version,
           updated_at = NOW()
         RETURNING *`,
        [
          aircraftId,
          flightId,
          intent,
          confidence,
          JSON.stringify(evidence),
          reasoning,
          JSON.stringify(alternativeIntents),
          geminiClient.isEnabled() ? 'gemini-pro' : 'heuristic',
        ]
      );

      return classification;
    } catch (error) {
      console.error('Error classifying intent:', error);
      return null;
    }
  }

  /**
   * Heuristic intent classification (fallback)
   */
  private async heuristicIntentClassification(
    aircraftId: string,
    flightId: string | null,
    militaryCategory: MilitaryCategory | null,
    pattern: string | null,
    nearbyAircraft: NearbyAircraft[]
  ): Promise<IntentClassification | null> {
    let intent: FlightIntent = 'transit';
    let confidence = 0.5;
    const evidence: IntentEvidence[] = [];

    // Category-based heuristics
    if (militaryCategory === 'tanker') {
      // Check for nearby receivers
      const potentialReceivers = nearbyAircraft.filter(
        (a) => a.distance_nm < 10 && a.military_category !== 'tanker'
      );
      if (potentialReceivers.length > 0) {
        intent = 'refueling';
        confidence = 0.8;
        evidence.push({
          type: 'formation',
          description: `Tanker with ${potentialReceivers.length} nearby aircraft`,
          weight: 0.8,
        });
      }
    } else if (militaryCategory === 'isr' || militaryCategory === 'awacs') {
      if (pattern === 'orbit' || pattern === 'racetrack') {
        intent = 'surveillance';
        confidence = 0.75;
        evidence.push({
          type: 'pattern',
          description: `ISR/AWACS aircraft in ${pattern} pattern`,
          weight: 0.75,
        });
      }
    } else if (militaryCategory === 'fighter') {
      if (pattern === 'orbit' || pattern === 'racetrack') {
        intent = 'patrol';
        confidence = 0.6;
        evidence.push({
          type: 'pattern',
          description: `Fighter in ${pattern} pattern`,
          weight: 0.6,
        });
      }
    } else if (militaryCategory === 'trainer') {
      intent = 'training';
      confidence = 0.7;
      evidence.push({
        type: 'aircraft_type',
        description: 'Trainer aircraft',
        weight: 0.7,
      });
    }

    // Pattern-based adjustments
    if (pattern === 'holding' && intent === 'transit') {
      intent = 'patrol';
      confidence = Math.max(confidence, 0.55);
    }

    const classification = await queryOne<IntentClassification>(
      `INSERT INTO intent_classifications
       (aircraft_id, flight_id, intent, confidence, evidence, reasoning, alternative_intents, model_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (aircraft_id, flight_id) DO UPDATE SET
         intent = EXCLUDED.intent,
         confidence = EXCLUDED.confidence,
         evidence = EXCLUDED.evidence,
         reasoning = EXCLUDED.reasoning,
         alternative_intents = EXCLUDED.alternative_intents,
         model_version = EXCLUDED.model_version,
         updated_at = NOW()
       RETURNING *`,
      [
        aircraftId,
        flightId,
        intent,
        confidence,
        JSON.stringify(evidence),
        'Heuristic classification based on aircraft type and flight pattern',
        JSON.stringify([]),
        'heuristic',
      ]
    );

    return classification;
  }

  /**
   * Calculate composite threat score
   */
  async assessThreat(
    entityType: ThreatEntityType,
    entityId: string,
    contextData?: Record<string, unknown>
  ): Promise<ThreatAssessment | null> {
    try {
      // Calculate component scores
      const patternAnomalyScore = await this.calculatePatternAnomalyScore(entityType, entityId);
      const regionalTensionScore = await this.calculateRegionalTensionScore(entityType, entityId);
      const newsCorrelationScore = await this.calculateNewsCorrelationScore(entityType, entityId);
      const historicalContextScore = await this.calculateHistoricalContextScore(
        entityType,
        entityId
      );
      const formationActivityScore = await this.calculateFormationActivityScore(
        entityType,
        entityId
      );
      const locationContextScore = await this.calculateLocationContextScore(
        entityType,
        entityId
      );

      // Calculate composite score (now includes location context)
      const threatScore =
        patternAnomalyScore * THREAT_WEIGHT_VALUES.patternAnomaly +
        regionalTensionScore * THREAT_WEIGHT_VALUES.regionalTension +
        newsCorrelationScore * THREAT_WEIGHT_VALUES.newsCorrelation +
        historicalContextScore * THREAT_WEIGHT_VALUES.historicalContext +
        formationActivityScore * THREAT_WEIGHT_VALUES.formationActivity +
        locationContextScore * THREAT_WEIGHT_VALUES.locationContext;

      const threatLevel = this.getThreatLevelFromScore(threatScore);

      // Get entity data for analysis
      let entityData: Record<string, unknown> = {};
      if (entityType === 'aircraft') {
        const aircraft = await queryOne<Aircraft>(
          `SELECT * FROM aircraft WHERE id = $1`,
          [entityId]
        );
        if (aircraft) {
          entityData = aircraft as unknown as Record<string, unknown>;
        }
      }

      let analysis: string | null = null;
      let factors: ThreatFactors = {};
      let recommendations: ThreatRecommendation[] = [];

      // Use Gemini for high threat scores
      if (threatScore >= 0.5 && geminiClient.isEnabled()) {
        try {
          const prompt = buildThreatAnalysisPrompt(entityType, entityData, {
            ...contextData,
            component_scores: {
              patternAnomalyScore,
              regionalTensionScore,
              newsCorrelationScore,
              historicalContextScore,
              formationActivityScore,
              locationContextScore,
            },
          });

          const response = await geminiClient.generateContent({
            prompt,
            model: 'pro',
            temperature: 0.3,
            jsonMode: true,
          });

          const parsed = JSON.parse(response.text);
          analysis = parsed.analysis || null;
          factors = parsed.factors || {};
          recommendations = parsed.recommendations || [];
        } catch (parseError) {
          console.error('Error parsing threat analysis:', parseError);
        }
      }

      // Store assessment
      const validUntil = new Date(Date.now() + CONFIG.threatValidityHours * 60 * 60 * 1000);

      // Add location context to factors
      if (locationContextScore > 0) {
        const significance = locationContextScore >= 0.7 ? 'high' : locationContextScore >= 0.4 ? 'medium' : 'low';
        factors.location = [`Location context score: ${(locationContextScore * 100).toFixed(0)}% (${significance} significance)`];
      }

      const assessment = await queryOne<ThreatAssessment>(
        `INSERT INTO threat_assessments
         (entity_type, entity_id, threat_score, threat_level,
          pattern_anomaly_score, regional_tension_score, news_correlation_score,
          historical_context_score, formation_activity_score, location_context_score,
          factors, analysis, recommendations, confidence, valid_until)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (entity_type, entity_id) DO UPDATE SET
           threat_score = EXCLUDED.threat_score,
           threat_level = EXCLUDED.threat_level,
           pattern_anomaly_score = EXCLUDED.pattern_anomaly_score,
           regional_tension_score = EXCLUDED.regional_tension_score,
           news_correlation_score = EXCLUDED.news_correlation_score,
           historical_context_score = EXCLUDED.historical_context_score,
           formation_activity_score = EXCLUDED.formation_activity_score,
           location_context_score = EXCLUDED.location_context_score,
           factors = EXCLUDED.factors,
           analysis = EXCLUDED.analysis,
           recommendations = EXCLUDED.recommendations,
           confidence = EXCLUDED.confidence,
           valid_until = EXCLUDED.valid_until,
           updated_at = NOW()
         RETURNING *`,
        [
          entityType,
          entityId,
          Math.round(threatScore * 100) / 100,
          threatLevel,
          patternAnomalyScore,
          regionalTensionScore,
          newsCorrelationScore,
          historicalContextScore,
          formationActivityScore,
          locationContextScore,
          JSON.stringify(factors),
          analysis,
          JSON.stringify(recommendations),
          0.7, // Confidence in the assessment
          validUntil,
        ]
      );

      return assessment;
    } catch (error) {
      console.error('Error assessing threat:', error);
      return null;
    }
  }

  /**
   * Calculate pattern anomaly score for an entity
   */
  private async calculatePatternAnomalyScore(
    entityType: ThreatEntityType,
    entityId: string
  ): Promise<number> {
    if (entityType !== 'aircraft') {
      return 0;
    }

    try {
      // Get recent anomalies
      const anomalies = await query<{ severity: number }>(
        `SELECT severity FROM anomaly_detections
         WHERE aircraft_id = $1
         AND created_at >= NOW() - INTERVAL '24 hours'
         AND is_acknowledged = FALSE`,
        [entityId]
      );

      if (anomalies.length === 0) {
        return 0;
      }

      // Return weighted average of severities
      const totalSeverity = anomalies.reduce((sum, a) => sum + a.severity, 0);
      return Math.min(totalSeverity / anomalies.length, 1);
    } catch {
      return 0;
    }
  }

  /**
   * Calculate regional tension score
   */
  private async calculateRegionalTensionScore(
    entityType: ThreatEntityType,
    entityId: string
  ): Promise<number> {
    try {
      // Get recent negative news from the region
      let regionName: string | null = null;
      if (entityType === 'aircraft') {
        const position = await queryOne<{ latitude: number; longitude: number }>(
          `SELECT latitude, longitude FROM positions_latest WHERE aircraft_id = $1`,
          [entityId]
        );

        if (!position) return 0; // No position data - return unknown (not biased)

        regionName = this.getRegionName(position.latitude, position.longitude);
      }

      // Use parameterized query to prevent SQL injection
      const recentNews = regionName
        ? await query<{ sentiment_score: number | null }>(
            `SELECT sentiment_score FROM news_events
             WHERE published_at >= NOW() - INTERVAL '24 hours'
             AND (title ILIKE '%' || $1 || '%' OR countries @> ARRAY[$1])
             AND sentiment_score IS NOT NULL`,
            [regionName]
          )
        : await query<{ sentiment_score: number | null }>(
            `SELECT sentiment_score FROM news_events
             WHERE published_at >= NOW() - INTERVAL '24 hours'
             AND sentiment_score IS NOT NULL`,
            []
          );

      if (recentNews.length === 0) {
        return 0; // No news data - return unknown (not biased)
      }

      // Calculate average negative sentiment
      const negativeSentiments = recentNews
        .filter((n) => n.sentiment_score !== null && n.sentiment_score < 0)
        .map((n) => Math.abs(n.sentiment_score!));

      if (negativeSentiments.length === 0) {
        return 0.2;
      }

      const avgNegative =
        negativeSentiments.reduce((a, b) => a + b, 0) / negativeSentiments.length;
      return Math.min(avgNegative / 100, 1); // Normalize from GDELT scale
    } catch {
      return 0; // Error case - return unknown (not biased)
    }
  }

  /**
   * Calculate news correlation score
   */
  private async calculateNewsCorrelationScore(
    entityType: ThreatEntityType,
    entityId: string
  ): Promise<number> {
    try {
      // Get recent correlations for this entity
      let correlations: Array<{ confidence_score: number }>;

      if (entityType === 'aircraft') {
        correlations = await query<{ confidence_score: number }>(
          `SELECT confidence_score FROM correlations
           WHERE aircraft_id = $1
           AND created_at >= NOW() - INTERVAL '48 hours'`,
          [entityId]
        );
      } else if (entityType === 'news_event') {
        correlations = await query<{ confidence_score: number }>(
          `SELECT confidence_score FROM correlations
           WHERE news_event_id = $1`,
          [entityId]
        );
      } else {
        return 0;
      }

      if (correlations.length === 0) {
        return 0;
      }

      // Return max confidence as the score
      return Math.max(...correlations.map((c) => c.confidence_score));
    } catch {
      return 0;
    }
  }

  /**
   * Calculate historical context score
   */
  private async calculateHistoricalContextScore(
    entityType: ThreatEntityType,
    entityId: string
  ): Promise<number> {
    if (entityType !== 'aircraft') {
      return 0.3;
    }

    try {
      // Check if aircraft has history of anomalies
      const historicalAnomalies = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM anomaly_detections
         WHERE aircraft_id = $1
         AND created_at >= NOW() - INTERVAL '30 days'`,
        [entityId]
      );

      const count = parseInt(historicalAnomalies?.count || '0', 10);

      // More historical anomalies = higher score
      if (count === 0) return 0.1;
      if (count < 5) return 0.3;
      if (count < 10) return 0.5;
      return 0.7;
    } catch {
      return 0.2;
    }
  }

  /**
   * Calculate formation activity score
   */
  private async calculateFormationActivityScore(
    entityType: ThreatEntityType,
    entityId: string
  ): Promise<number> {
    if (entityType !== 'aircraft') {
      return 0;
    }

    try {
      // Check for active formations involving this aircraft
      const formations = await query<{ formation_type: string; confidence: number }>(
        `SELECT formation_type, confidence FROM formation_detections
         WHERE $1 = ANY(aircraft_ids)
         AND is_active = TRUE`,
        [entityId]
      );

      if (formations.length === 0) {
        return 0;
      }

      // Different formation types have different threat implications
      const formationScores: Record<string, number> = {
        tanker_receiver: 0.4,
        escort: 0.6,
        strike_package: 0.9,
        cap: 0.5,
      };

      const maxScore = Math.max(
        ...formations.map(
          (f) => (formationScores[f.formation_type] || 0.3) * f.confidence
        )
      );

      return maxScore;
    } catch {
      return 0;
    }
  }

  /**
   * Calculate location context score based on infrastructure, airspace, and activity zones
   */
  private async calculateLocationContextScore(
    entityType: ThreatEntityType,
    entityId: string
  ): Promise<number> {
    if (entityType !== 'aircraft') {
      return 0;
    }

    try {
      // Get aircraft's current position
      const position = await queryOne<{
        latitude: number;
        longitude: number;
        altitude: number | null;
      }>(
        `SELECT latitude, longitude, altitude FROM positions_latest WHERE aircraft_id = $1`,
        [entityId]
      );

      if (!position) {
        return 0;
      }

      // Get context for the position
      const context = await contextIntelligence.getPositionContext(
        position.latitude,
        position.longitude,
        position.altitude ?? undefined
      );

      // Return the combined context score
      // This considers proximity to critical infrastructure, restricted airspace, and activity zones
      return context.combined_score;
    } catch (error) {
      console.error('Error calculating location context score:', error);
      return 0;
    }
  }

  /**
   * Get threat level from score
   */
  private getThreatLevelFromScore(score: number): ThreatLevel {
    if (score < 0.2) return 'minimal';
    if (score < 0.4) return 'low';
    if (score < 0.6) return 'elevated';
    if (score < 0.8) return 'high';
    return 'critical';
  }

  /**
   * Get region name from coordinates
   */
  private getRegionName(lat: number, lon: number): string {
    const regions = [
      { name: 'Lebanon', lat: 33.85, lon: 35.86, radius: 1.5 },
      { name: 'Israel', lat: 31.77, lon: 35.23, radius: 1.5 },
      { name: 'Syria', lat: 34.8, lon: 38.99, radius: 3 },
      { name: 'Iran', lat: 32.43, lon: 53.69, radius: 6 },
      { name: 'Iraq', lat: 33.31, lon: 44.37, radius: 4 },
      { name: 'Turkey', lat: 39.93, lon: 32.86, radius: 5 },
      { name: 'Egypt', lat: 26.82, lon: 30.8, radius: 5 },
      { name: 'Cyprus', lat: 35.13, lon: 33.43, radius: 1 },
      { name: 'Jordan', lat: 31.24, lon: 36.51, radius: 1.5 },
      { name: 'Saudi Arabia', lat: 24.47, lon: 46.0, radius: 6 },
      { name: 'UAE', lat: 24.0, lon: 54.0, radius: 2 },
    ];

    for (const region of regions) {
      const dist = Math.sqrt(Math.pow(lat - region.lat, 2) + Math.pow(lon - region.lon, 2));
      if (dist < region.radius) {
        return region.name;
      }
    }

    return 'Middle East';
  }

  /**
   * Get recent anomalies for an aircraft
   */
  async getRecentAnomalies(
    aircraftId: string,
    hoursSince: number = 24
  ): Promise<AnomalyDetection[]> {
    try {
      // Use parameterized interval to prevent SQL injection
      return await query<AnomalyDetection>(
        `SELECT * FROM anomaly_detections
         WHERE aircraft_id = $1
         AND created_at >= NOW() - INTERVAL '1 hour' * $2
         ORDER BY created_at DESC`,
        [aircraftId, hoursSince]
      );
    } catch {
      return [];
    }
  }

  /**
   * Get threat assessment for an entity
   */
  async getThreatAssessment(
    entityType: ThreatEntityType,
    entityId: string
  ): Promise<ThreatAssessment | null> {
    try {
      return await queryOne<ThreatAssessment>(
        `SELECT * FROM threat_assessments
         WHERE entity_type = $1
         AND entity_id = $2
         AND valid_until > NOW()`,
        [entityType, entityId]
      );
    } catch {
      return null;
    }
  }

  /**
   * Get intelligence statistics
   */
  async getStats(): Promise<{
    anomalies_24h: number;
    high_severity_anomalies: number;
    intent_classifications: number;
    high_threat_entities: number;
  }> {
    try {
      const anomalies24h = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM anomaly_detections
         WHERE created_at >= NOW() - INTERVAL '24 hours'`
      );

      const highSeverity = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM anomaly_detections
         WHERE severity >= 0.7 AND created_at >= NOW() - INTERVAL '24 hours'`
      );

      const intents = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM intent_classifications
         WHERE created_at >= NOW() - INTERVAL '24 hours'`
      );

      const highThreat = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM threat_assessments
         WHERE threat_level IN ('high', 'critical') AND valid_until > NOW()`
      );

      return {
        anomalies_24h: parseInt(anomalies24h?.count || '0', 10),
        high_severity_anomalies: parseInt(highSeverity?.count || '0', 10),
        intent_classifications: parseInt(intents?.count || '0', 10),
        high_threat_entities: parseInt(highThreat?.count || '0', 10),
      };
    } catch {
      return {
        anomalies_24h: 0,
        high_severity_anomalies: 0,
        intent_classifications: 0,
        high_threat_entities: 0,
      };
    }
  }
}

// Export singleton instance
export const intelligenceEngine = new IntelligenceEngine();
