/**
 * Explainability Engine
 * Provides human-readable explanations for ML decisions
 */

import { query, queryOne, execute } from '@/lib/db';

export interface DecisionFactor {
  name: string;
  value: number;
  weight: number;
  contribution: number;
  description: string;
}

export interface FeatureImportance {
  feature_name: string;
  importance: number;
  value: unknown;
}

export interface Counterfactual {
  feature_name: string;
  current_value: unknown;
  required_value: unknown;
  effect_on_outcome: string;
}

export interface DecisionExplanation {
  id: string;
  task_id: string;
  entity_type: string;
  entity_id: string;
  decision_type: string;
  final_score: number | null;
  final_classification: string | null;
  factors: DecisionFactor[];
  top_features: FeatureImportance[];
  counterfactuals: Counterfactual[];
  natural_language_explanation: string | null;
  created_at: string;
}

/**
 * Create a decision explanation
 */
export async function createExplanation(
  taskId: string,
  entityType: string,
  entityId: string,
  decisionType: string,
  data: {
    finalScore?: number;
    finalClassification?: string;
    factors: DecisionFactor[];
    topFeatures?: FeatureImportance[];
    counterfactuals?: Counterfactual[];
  }
): Promise<string> {
  // Generate natural language explanation
  const naturalExplanation = generateNaturalExplanation(
    decisionType,
    data.finalScore,
    data.finalClassification,
    data.factors
  );

  const result = await queryOne<{ id: string }>(
    `INSERT INTO ml_decision_explanations (
      task_id, entity_type, entity_id, decision_type,
      final_score, final_classification,
      factors, top_features, counterfactuals,
      natural_language_explanation
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id`,
    [
      taskId,
      entityType,
      entityId,
      decisionType,
      data.finalScore || null,
      data.finalClassification || null,
      JSON.stringify(data.factors),
      JSON.stringify(data.topFeatures || []),
      JSON.stringify(data.counterfactuals || []),
      naturalExplanation,
    ]
  );

  if (!result) {
    throw new Error('Failed to create explanation');
  }

  return result.id;
}

/**
 * Get explanation by ID
 */
export async function getExplanation(id: string): Promise<DecisionExplanation | null> {
  const result = await queryOne<DecisionExplanation>(
    `SELECT * FROM ml_decision_explanations WHERE id = $1`,
    [id]
  );

  return result;
}

/**
 * Get explanations for an entity
 */
export async function getExplanationsForEntity(
  entityType: string,
  entityId: string,
  limit: number = 10
): Promise<DecisionExplanation[]> {
  return query<DecisionExplanation>(
    `SELECT * FROM ml_decision_explanations
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [entityType, entityId, limit]
  );
}

/**
 * Generate natural language explanation from decision factors
 */
export function generateNaturalExplanation(
  decisionType: string,
  finalScore: number | undefined,
  finalClassification: string | undefined,
  factors: DecisionFactor[]
): string {
  const sortedFactors = [...factors].sort((a, b) => b.contribution - a.contribution);
  const topFactors = sortedFactors.slice(0, 3);
  const positiveFactors = topFactors.filter((f) => f.contribution > 0);
  const negativeFactors = sortedFactors.filter((f) => f.contribution < 0).slice(0, 2);

  let explanation = '';

  // Opening statement based on decision type
  switch (decisionType) {
    case 'anomaly':
      if (finalScore !== undefined) {
        const level = finalScore > 0.7 ? 'high' : finalScore > 0.4 ? 'moderate' : 'low';
        explanation = `This aircraft shows ${level} anomaly indicators (score: ${(finalScore * 100).toFixed(0)}%). `;
      }
      break;
    case 'intent':
      if (finalClassification) {
        explanation = `The aircraft's behavior suggests ${finalClassification} intent. `;
      }
      break;
    case 'threat':
      if (finalScore !== undefined) {
        const level = finalScore > 0.7 ? 'elevated' : finalScore > 0.4 ? 'moderate' : 'low';
        explanation = `Threat assessment: ${level} (score: ${(finalScore * 100).toFixed(0)}%). `;
      }
      break;
    case 'formation':
      if (finalClassification) {
        explanation = `Formation type identified: ${finalClassification}. `;
      }
      break;
    default:
      explanation = `Decision type: ${decisionType}. `;
  }

  // Add positive contributing factors
  if (positiveFactors.length > 0) {
    explanation += 'Key factors: ';
    explanation += positiveFactors
      .map((f) => f.description || f.name)
      .join('; ');
    explanation += '. ';
  }

  // Add mitigating factors if present
  if (negativeFactors.length > 0) {
    explanation += 'However, ';
    explanation += negativeFactors
      .map((f) => f.description || `${f.name} was lower than expected`)
      .join('; ');
    explanation += '. ';
  }

  return explanation.trim();
}

/**
 * Create anomaly explanation
 */
export function createAnomalyExplanation(
  anomalyScore: number,
  features: {
    altitudeDeviation?: number;
    speedDeviation?: number;
    patternUnusual?: boolean;
    regionUnusual?: boolean;
    timeUnusual?: boolean;
    trackErratic?: boolean;
  }
): { factors: DecisionFactor[]; topFeatures: FeatureImportance[] } {
  const factors: DecisionFactor[] = [];
  const topFeatures: FeatureImportance[] = [];

  // Altitude factor
  if (features.altitudeDeviation !== undefined) {
    const altNormalized = Math.min(features.altitudeDeviation / 20000, 1);
    factors.push({
      name: 'altitude_deviation',
      value: features.altitudeDeviation,
      weight: 0.2,
      contribution: altNormalized * 0.2,
      description:
        features.altitudeDeviation > 10000
          ? 'Flying at unusual altitude'
          : 'Altitude within normal range',
    });
    topFeatures.push({
      feature_name: 'altitude_deviation',
      importance: altNormalized,
      value: features.altitudeDeviation,
    });
  }

  // Speed factor
  if (features.speedDeviation !== undefined) {
    const speedNormalized = Math.min(features.speedDeviation / 200, 1);
    factors.push({
      name: 'speed_deviation',
      value: features.speedDeviation,
      weight: 0.2,
      contribution: speedNormalized * 0.2,
      description:
        features.speedDeviation > 100
          ? 'Traveling at unusual speed'
          : 'Speed within expected range',
    });
    topFeatures.push({
      feature_name: 'speed_deviation',
      importance: speedNormalized,
      value: features.speedDeviation,
    });
  }

  // Pattern factor
  if (features.patternUnusual !== undefined) {
    const patternValue = features.patternUnusual ? 1 : 0;
    factors.push({
      name: 'unusual_pattern',
      value: patternValue,
      weight: 0.25,
      contribution: patternValue * 0.25,
      description: features.patternUnusual
        ? 'Flight pattern deviates from typical behavior'
        : 'Flight pattern consistent with type',
    });
    topFeatures.push({
      feature_name: 'unusual_pattern',
      importance: patternValue,
      value: features.patternUnusual,
    });
  }

  // Region factor
  if (features.regionUnusual !== undefined) {
    const regionValue = features.regionUnusual ? 1 : 0;
    factors.push({
      name: 'unusual_region',
      value: regionValue,
      weight: 0.2,
      contribution: regionValue * 0.2,
      description: features.regionUnusual
        ? 'Operating in unusual geographic area'
        : 'Operating in expected region',
    });
    topFeatures.push({
      feature_name: 'unusual_region',
      importance: regionValue,
      value: features.regionUnusual,
    });
  }

  // Time factor
  if (features.timeUnusual !== undefined) {
    const timeValue = features.timeUnusual ? 0.8 : 0;
    factors.push({
      name: 'unusual_time',
      value: timeValue,
      weight: 0.1,
      contribution: timeValue * 0.1,
      description: features.timeUnusual
        ? 'Activity at unusual time'
        : 'Activity during normal hours',
    });
  }

  // Track factor
  if (features.trackErratic !== undefined) {
    const trackValue = features.trackErratic ? 1 : 0;
    factors.push({
      name: 'erratic_track',
      value: trackValue,
      weight: 0.05,
      contribution: trackValue * 0.05,
      description: features.trackErratic
        ? 'Erratic heading changes detected'
        : 'Stable flight path',
    });
  }

  return { factors, topFeatures };
}

/**
 * Create intent explanation
 */
export function createIntentExplanation(
  intent: string,
  confidence: number,
  features: {
    pattern?: string;
    altitude?: number;
    speed?: number;
    duration?: number;
    region?: string;
    accompanyingAircraft?: string[];
  }
): { factors: DecisionFactor[]; topFeatures: FeatureImportance[] } {
  const factors: DecisionFactor[] = [];
  const topFeatures: FeatureImportance[] = [];

  // Pattern contribution
  if (features.pattern) {
    const patternContribution = getPatternIntentContribution(features.pattern, intent);
    factors.push({
      name: 'flight_pattern',
      value: patternContribution,
      weight: 0.3,
      contribution: patternContribution * 0.3,
      description: `${features.pattern} pattern typical for ${intent}`,
    });
    topFeatures.push({
      feature_name: 'flight_pattern',
      importance: patternContribution,
      value: features.pattern,
    });
  }

  // Altitude contribution
  if (features.altitude !== undefined) {
    const altContribution = getAltitudeIntentContribution(features.altitude, intent);
    factors.push({
      name: 'altitude',
      value: altContribution,
      weight: 0.2,
      contribution: altContribution * 0.2,
      description:
        altContribution > 0.5
          ? `Altitude consistent with ${intent}`
          : `Altitude somewhat unusual for ${intent}`,
    });
    topFeatures.push({
      feature_name: 'altitude',
      importance: altContribution,
      value: features.altitude,
    });
  }

  // Duration contribution
  if (features.duration !== undefined) {
    const durContribution = getDurationIntentContribution(features.duration, intent);
    factors.push({
      name: 'mission_duration',
      value: durContribution,
      weight: 0.15,
      contribution: durContribution * 0.15,
      description:
        durContribution > 0.5
          ? `Duration typical for ${intent}`
          : `Duration atypical for ${intent}`,
    });
  }

  // Accompanying aircraft
  if (features.accompanyingAircraft && features.accompanyingAircraft.length > 0) {
    const formContribution = 0.8; // Formation presence is significant
    factors.push({
      name: 'formation',
      value: formContribution,
      weight: 0.2,
      contribution: formContribution * 0.2,
      description: `Accompanied by ${features.accompanyingAircraft.join(', ')}`,
    });
    topFeatures.push({
      feature_name: 'accompanying_aircraft',
      importance: formContribution,
      value: features.accompanyingAircraft,
    });
  }

  // Region contribution
  if (features.region) {
    const regionContribution = 0.7; // Region provides context
    factors.push({
      name: 'operating_region',
      value: regionContribution,
      weight: 0.15,
      contribution: regionContribution * 0.15,
      description: `Operating in ${features.region}`,
    });
  }

  return { factors, topFeatures };
}

/**
 * Helper: Get pattern contribution to intent
 */
function getPatternIntentContribution(pattern: string, intent: string): number {
  const patternIntentScores: Record<string, Record<string, number>> = {
    orbit: { reconnaissance: 0.9, patrol: 0.8, refueling: 0.7, training: 0.5 },
    racetrack: { refueling: 0.9, reconnaissance: 0.8, patrol: 0.7, training: 0.6 },
    holding: { patrol: 0.8, training: 0.6, transport: 0.4 },
    straight: { transport: 0.9, combat: 0.7, training: 0.5 },
    tanker_track: { refueling: 1.0 },
  };

  return patternIntentScores[pattern]?.[intent] || 0.3;
}

/**
 * Helper: Get altitude contribution to intent
 */
function getAltitudeIntentContribution(altitude: number, intent: string): number {
  // Different intents have typical altitude ranges
  const intentAltitudes: Record<string, { ideal: number; tolerance: number }> = {
    reconnaissance: { ideal: 35000, tolerance: 20000 },
    transport: { ideal: 35000, tolerance: 15000 },
    training: { ideal: 15000, tolerance: 15000 },
    combat: { ideal: 25000, tolerance: 20000 },
    refueling: { ideal: 30000, tolerance: 10000 },
    patrol: { ideal: 30000, tolerance: 15000 },
  };

  const expected = intentAltitudes[intent] || { ideal: 25000, tolerance: 20000 };
  const deviation = Math.abs(altitude - expected.ideal);
  return Math.max(0, 1 - deviation / expected.tolerance);
}

/**
 * Helper: Get duration contribution to intent
 */
function getDurationIntentContribution(durationMinutes: number, intent: string): number {
  const intentDurations: Record<string, { min: number; max: number }> = {
    reconnaissance: { min: 120, max: 600 },
    transport: { min: 60, max: 360 },
    training: { min: 45, max: 180 },
    combat: { min: 30, max: 120 },
    refueling: { min: 15, max: 60 },
    patrol: { min: 60, max: 240 },
  };

  const expected = intentDurations[intent] || { min: 30, max: 180 };
  if (durationMinutes >= expected.min && durationMinutes <= expected.max) {
    return 1.0;
  }
  const deviation =
    durationMinutes < expected.min
      ? expected.min - durationMinutes
      : durationMinutes - expected.max;
  const range = expected.max - expected.min;
  return Math.max(0, 1 - deviation / range);
}

/**
 * Generate counterfactual explanations
 */
export function generateCounterfactuals(
  currentScore: number,
  targetScore: number,
  factors: DecisionFactor[]
): Counterfactual[] {
  const counterfactuals: Counterfactual[] = [];
  const scoreDiff = targetScore - currentScore;

  // Sort factors by contribution to find most impactful ones
  const sortedFactors = [...factors].sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)
  );

  for (const factor of sortedFactors.slice(0, 3)) {
    // Calculate what value would be needed
    const requiredChange = (scoreDiff / factor.weight) * (factor.contribution / factor.value);
    const requiredValue = factor.value - requiredChange;

    counterfactuals.push({
      feature_name: factor.name,
      current_value: factor.value,
      required_value: Math.max(0, requiredValue),
      effect_on_outcome:
        scoreDiff > 0
          ? `Increasing ${factor.name} would raise the score`
          : `Decreasing ${factor.name} would lower the score`,
    });
  }

  return counterfactuals;
}
