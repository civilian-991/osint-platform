/**
 * Confidence Calibrator Service
 * Implements Platt scaling for calibrating ML prediction confidence scores
 */

import { query, queryOne, execute } from '@/lib/db';

export interface CalibrationModel {
  id: string;
  task_type: string;
  platt_a: number;
  platt_b: number;
  bin_boundaries: number[];
  bin_calibrated_values: number[];
  sample_count: number;
  last_calibration_at: string | null;
  calibration_quality: number | null;
}

export interface PredictionOutcome {
  id: string;
  task_type: string;
  entity_type: string;
  entity_id: string;
  predicted_class: string | null;
  predicted_score: number;
  calibrated_score: number | null;
  actual_outcome: boolean | null;
  verification_method: string | null;
  verified_by: string | null;
  predicted_at: string;
  verified_at: string | null;
}

export interface CalibrationResult {
  rawScore: number;
  calibratedScore: number;
  method: 'platt' | 'histogram' | 'identity';
}

/**
 * Apply Platt scaling to calibrate a confidence score
 */
export function applyPlattScaling(score: number, a: number, b: number): number {
  // Platt scaling: P(y=1|s) = 1 / (1 + exp(A*s + B))
  const calibrated = 1.0 / (1.0 + Math.exp(a * score + b));
  return Math.max(0, Math.min(1, calibrated));
}

/**
 * Apply histogram binning calibration
 */
export function applyHistogramCalibration(
  score: number,
  boundaries: number[],
  values: number[]
): number {
  // Find the bin for this score
  for (let i = 0; i < boundaries.length - 1; i++) {
    if (score >= boundaries[i] && score < boundaries[i + 1]) {
      return values[i];
    }
  }
  // If score is exactly 1.0, use the last bin
  return values[values.length - 1];
}

/**
 * Calibrate a confidence score using the stored calibration model
 */
export async function calibrateConfidence(
  taskType: string,
  rawScore: number
): Promise<CalibrationResult> {
  const model = await queryOne<CalibrationModel>(
    `SELECT * FROM confidence_calibration_models WHERE task_type = $1`,
    [taskType]
  );

  if (!model || model.sample_count < 50) {
    // Not enough data for calibration, return raw score
    return {
      rawScore,
      calibratedScore: rawScore,
      method: 'identity',
    };
  }

  // Use Platt scaling as primary method
  const calibrated = applyPlattScaling(rawScore, model.platt_a, model.platt_b);

  return {
    rawScore,
    calibratedScore: calibrated,
    method: 'platt',
  };
}

/**
 * Record a prediction outcome for calibration training
 */
export async function recordPredictionOutcome(
  taskType: string,
  entityType: string,
  entityId: string,
  predictedScore: number,
  predictedClass?: string,
  calibratedScore?: number
): Promise<string> {
  const result = await queryOne<{ id: string }>(
    `INSERT INTO ml_prediction_outcomes (
      task_type, entity_type, entity_id,
      predicted_score, predicted_class, calibrated_score,
      predicted_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING id`,
    [taskType, entityType, entityId, predictedScore, predictedClass || null, calibratedScore || null]
  );

  if (!result) {
    throw new Error('Failed to record prediction outcome');
  }

  return result.id;
}

/**
 * Verify a prediction outcome with ground truth
 */
export async function verifyPredictionOutcome(
  outcomeId: string,
  actualOutcome: boolean,
  verificationMethod: string,
  verifiedBy?: string
): Promise<void> {
  await execute(
    `UPDATE ml_prediction_outcomes
     SET actual_outcome = $1,
         verification_method = $2,
         verified_by = $3,
         verified_at = NOW()
     WHERE id = $4`,
    [actualOutcome, verificationMethod, verifiedBy || null, outcomeId]
  );
}

/**
 * Train calibration model using verified outcomes
 * Uses Platt scaling (logistic regression) on the verified predictions
 */
export async function trainCalibrationModel(taskType: string): Promise<CalibrationModel | null> {
  // Get verified outcomes
  const outcomes = await query<{
    predicted_score: number;
    actual_outcome: boolean;
  }>(
    `SELECT predicted_score, actual_outcome
     FROM ml_prediction_outcomes
     WHERE task_type = $1
       AND actual_outcome IS NOT NULL
       AND verified_at IS NOT NULL
     ORDER BY verified_at DESC
     LIMIT 1000`,
    [taskType]
  );

  if (outcomes.length < 50) {
    console.log(`Not enough verified outcomes for ${taskType} calibration (${outcomes.length}/50)`);
    return null;
  }

  // Simple gradient descent for Platt scaling
  // Minimize: sum(-y*log(p) - (1-y)*log(1-p)) where p = 1/(1+exp(A*s+B))
  let a = -1.0;
  let b = 0.0;
  const learningRate = 0.1;
  const iterations = 1000;

  for (let iter = 0; iter < iterations; iter++) {
    let gradA = 0;
    let gradB = 0;

    for (const outcome of outcomes) {
      const s = outcome.predicted_score;
      const y = outcome.actual_outcome ? 1 : 0;
      const p = 1.0 / (1.0 + Math.exp(a * s + b));

      // Gradients
      gradA += (p - y) * s;
      gradB += (p - y);
    }

    a -= (learningRate * gradA) / outcomes.length;
    b -= (learningRate * gradB) / outcomes.length;
  }

  // Calculate calibration quality (Expected Calibration Error)
  const bins = 10;
  const binCounts = new Array(bins).fill(0);
  const binCorrect = new Array(bins).fill(0);
  const binConfidence = new Array(bins).fill(0);

  for (const outcome of outcomes) {
    const calibrated = applyPlattScaling(outcome.predicted_score, a, b);
    const binIndex = Math.min(Math.floor(calibrated * bins), bins - 1);
    binCounts[binIndex]++;
    binConfidence[binIndex] += calibrated;
    if (outcome.actual_outcome) {
      binCorrect[binIndex]++;
    }
  }

  let ece = 0;
  for (let i = 0; i < bins; i++) {
    if (binCounts[i] > 0) {
      const accuracy = binCorrect[i] / binCounts[i];
      const confidence = binConfidence[i] / binCounts[i];
      ece += (binCounts[i] / outcomes.length) * Math.abs(accuracy - confidence);
    }
  }

  // Update model
  const result = await queryOne<CalibrationModel>(
    `UPDATE confidence_calibration_models
     SET platt_a = $1,
         platt_b = $2,
         sample_count = $3,
         last_calibration_at = NOW(),
         calibration_quality = $4
     WHERE task_type = $5
     RETURNING *`,
    [a, b, outcomes.length, ece, taskType]
  );

  console.log(`Trained calibration model for ${taskType}: A=${a.toFixed(4)}, B=${b.toFixed(4)}, ECE=${ece.toFixed(4)}`);

  return result;
}

/**
 * Get calibration statistics for a task type
 */
export async function getCalibrationStats(taskType: string): Promise<{
  model: CalibrationModel | null;
  totalPredictions: number;
  verifiedPredictions: number;
  recentAccuracy: number | null;
}> {
  const model = await queryOne<CalibrationModel>(
    `SELECT * FROM confidence_calibration_models WHERE task_type = $1`,
    [taskType]
  );

  const stats = await queryOne<{
    total: number;
    verified: number;
    correct: number;
  }>(
    `SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE actual_outcome IS NOT NULL)::int as verified,
      COUNT(*) FILTER (WHERE actual_outcome = true)::int as correct
     FROM ml_prediction_outcomes
     WHERE task_type = $1
       AND predicted_at > NOW() - INTERVAL '7 days'`,
    [taskType]
  );

  return {
    model,
    totalPredictions: stats?.total || 0,
    verifiedPredictions: stats?.verified || 0,
    recentAccuracy:
      stats && stats.verified > 0 ? stats.correct / stats.verified : null,
  };
}

/**
 * Batch calibrate multiple scores
 */
export async function batchCalibrateConfidence(
  taskType: string,
  rawScores: number[]
): Promise<CalibrationResult[]> {
  const model = await queryOne<CalibrationModel>(
    `SELECT * FROM confidence_calibration_models WHERE task_type = $1`,
    [taskType]
  );

  if (!model || model.sample_count < 50) {
    return rawScores.map((score) => ({
      rawScore: score,
      calibratedScore: score,
      method: 'identity' as const,
    }));
  }

  return rawScores.map((score) => ({
    rawScore: score,
    calibratedScore: applyPlattScaling(score, model.platt_a, model.platt_b),
    method: 'platt' as const,
  }));
}
