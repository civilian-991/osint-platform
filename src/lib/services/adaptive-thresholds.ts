/**
 * Adaptive Thresholds Service
 * Implements Bayesian threshold management for ML decisions
 */

import { query, queryOne, execute } from '@/lib/db';

export interface AdaptiveThreshold {
  id: string;
  task_type: string;
  threshold_name: string;
  prior_alpha: number;
  prior_beta: number;
  current_value: number;
  min_value: number;
  max_value: number;
  true_positives: number;
  false_positives: number;
  true_negatives: number;
  false_negatives: number;
  description: string | null;
  is_active: boolean;
  last_adjusted_at: string | null;
}

export interface ThresholdStats {
  precision: number;
  recall: number;
  f1Score: number;
  accuracy: number;
  totalPredictions: number;
}

/**
 * Get the current threshold value
 */
export async function getThreshold(
  taskType: string,
  thresholdName: string
): Promise<number> {
  const result = await queryOne<{ current_value: number }>(
    `SELECT current_value FROM adaptive_thresholds
     WHERE task_type = $1 AND threshold_name = $2 AND is_active = true`,
    [taskType, thresholdName]
  );

  return result?.current_value ?? 0.5;
}

/**
 * Get all thresholds for a task type
 */
export async function getThresholdsForTask(
  taskType: string
): Promise<AdaptiveThreshold[]> {
  return query<AdaptiveThreshold>(
    `SELECT * FROM adaptive_thresholds
     WHERE task_type = $1 AND is_active = true
     ORDER BY threshold_name`,
    [taskType]
  );
}

/**
 * Get threshold with statistics
 */
export async function getThresholdWithStats(
  taskType: string,
  thresholdName: string
): Promise<{ threshold: AdaptiveThreshold; stats: ThresholdStats } | null> {
  const threshold = await queryOne<AdaptiveThreshold>(
    `SELECT * FROM adaptive_thresholds
     WHERE task_type = $1 AND threshold_name = $2 AND is_active = true`,
    [taskType, thresholdName]
  );

  if (!threshold) return null;

  const stats = calculateStats(threshold);

  return { threshold, stats };
}

/**
 * Update threshold based on a prediction outcome
 */
export async function updateThreshold(
  taskType: string,
  thresholdName: string,
  predictedPositive: boolean,
  actualPositive: boolean
): Promise<AdaptiveThreshold | null> {
  // Use database function for atomic update
  await execute(
    `SELECT update_adaptive_threshold($1, $2, $3, $4)`,
    [taskType, thresholdName, predictedPositive, actualPositive]
  );

  // Return updated threshold
  return queryOne<AdaptiveThreshold>(
    `SELECT * FROM adaptive_thresholds
     WHERE task_type = $1 AND threshold_name = $2`,
    [taskType, thresholdName]
  );
}

/**
 * Batch update thresholds from multiple outcomes
 */
export async function batchUpdateThreshold(
  taskType: string,
  thresholdName: string,
  outcomes: Array<{ predictedPositive: boolean; actualPositive: boolean }>
): Promise<AdaptiveThreshold | null> {
  for (const outcome of outcomes) {
    await execute(
      `SELECT update_adaptive_threshold($1, $2, $3, $4)`,
      [taskType, thresholdName, outcome.predictedPositive, outcome.actualPositive]
    );
  }

  return queryOne<AdaptiveThreshold>(
    `SELECT * FROM adaptive_thresholds
     WHERE task_type = $1 AND threshold_name = $2`,
    [taskType, thresholdName]
  );
}

/**
 * Calculate performance statistics for a threshold
 */
export function calculateStats(threshold: AdaptiveThreshold): ThresholdStats {
  const tp = threshold.true_positives;
  const fp = threshold.false_positives;
  const tn = threshold.true_negatives;
  const fn = threshold.false_negatives;

  const total = tp + fp + tn + fn;

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1Score =
    precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const accuracy = total > 0 ? (tp + tn) / total : 0;

  return {
    precision,
    recall,
    f1Score,
    accuracy,
    totalPredictions: total,
  };
}

/**
 * Reset threshold to initial values
 */
export async function resetThreshold(
  taskType: string,
  thresholdName: string,
  newValue?: number
): Promise<AdaptiveThreshold | null> {
  const result = await queryOne<AdaptiveThreshold>(
    `UPDATE adaptive_thresholds
     SET prior_alpha = 2.0,
         prior_beta = 2.0,
         current_value = COALESCE($3, (2.0 / (2.0 + 2.0))),
         true_positives = 0,
         false_positives = 0,
         true_negatives = 0,
         false_negatives = 0,
         last_adjusted_at = NOW()
     WHERE task_type = $1 AND threshold_name = $2
     RETURNING *`,
    [taskType, thresholdName, newValue || null]
  );

  return result;
}

/**
 * Create a new adaptive threshold
 */
export async function createThreshold(
  taskType: string,
  thresholdName: string,
  initialValue: number,
  minValue: number = 0.1,
  maxValue: number = 0.9,
  description?: string
): Promise<AdaptiveThreshold> {
  const result = await queryOne<AdaptiveThreshold>(
    `INSERT INTO adaptive_thresholds (
      task_type, threshold_name, current_value,
      min_value, max_value, description
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (task_type, threshold_name) DO UPDATE SET
      current_value = EXCLUDED.current_value,
      min_value = EXCLUDED.min_value,
      max_value = EXCLUDED.max_value,
      description = EXCLUDED.description
    RETURNING *`,
    [taskType, thresholdName, initialValue, minValue, maxValue, description || null]
  );

  if (!result) {
    throw new Error('Failed to create threshold');
  }

  return result;
}

/**
 * Suggest optimal threshold based on performance
 */
export async function suggestOptimalThreshold(
  taskType: string,
  thresholdName: string,
  targetMetric: 'precision' | 'recall' | 'f1' = 'f1'
): Promise<{ suggestedValue: number; currentStats: ThresholdStats }> {
  const threshold = await queryOne<AdaptiveThreshold>(
    `SELECT * FROM adaptive_thresholds
     WHERE task_type = $1 AND threshold_name = $2`,
    [taskType, thresholdName]
  );

  if (!threshold) {
    return { suggestedValue: 0.5, currentStats: { precision: 0, recall: 0, f1Score: 0, accuracy: 0, totalPredictions: 0 } };
  }

  const stats = calculateStats(threshold);

  // Use Beta distribution mode as suggestion
  // Mode = (alpha - 1) / (alpha + beta - 2) for alpha, beta > 1
  const alpha = threshold.prior_alpha;
  const beta = threshold.prior_beta;

  let suggestedValue = threshold.current_value;

  if (alpha > 1 && beta > 1) {
    suggestedValue = (alpha - 1) / (alpha + beta - 2);
  }

  // Adjust based on target metric
  if (targetMetric === 'precision' && stats.precision < 0.8) {
    // Increase threshold to improve precision
    suggestedValue = Math.min(threshold.max_value, suggestedValue + 0.05);
  } else if (targetMetric === 'recall' && stats.recall < 0.8) {
    // Decrease threshold to improve recall
    suggestedValue = Math.max(threshold.min_value, suggestedValue - 0.05);
  }

  // Clamp to bounds
  suggestedValue = Math.max(
    threshold.min_value,
    Math.min(threshold.max_value, suggestedValue)
  );

  return { suggestedValue, currentStats: stats };
}

/**
 * Apply a decision using the adaptive threshold
 */
export async function applyThreshold(
  taskType: string,
  thresholdName: string,
  score: number
): Promise<{ exceeds: boolean; threshold: number; confidence: number }> {
  const threshold = await getThreshold(taskType, thresholdName);

  // Calculate confidence as distance from threshold
  // Scores near the threshold have lower confidence
  const distance = Math.abs(score - threshold);
  const maxDistance = Math.max(threshold, 1 - threshold);
  const confidence = maxDistance > 0 ? distance / maxDistance : 0;

  return {
    exceeds: score >= threshold,
    threshold,
    confidence,
  };
}

/**
 * Get all thresholds summary
 */
export async function getAllThresholdsSummary(): Promise<
  Array<{
    taskType: string;
    thresholdName: string;
    currentValue: number;
    stats: ThresholdStats;
  }>
> {
  const thresholds = await query<AdaptiveThreshold>(
    `SELECT * FROM adaptive_thresholds WHERE is_active = true ORDER BY task_type, threshold_name`
  );

  return thresholds.map((t) => ({
    taskType: t.task_type,
    thresholdName: t.threshold_name,
    currentValue: t.current_value,
    stats: calculateStats(t),
  }));
}
