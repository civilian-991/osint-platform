import { execute, queryOne, query } from '@/lib/db';
import { distanceNm, destination } from '@/lib/utils/geo';
import type {
  TrajectoryPrediction,
  TrajectoryPredictionInput,
  PredictedPosition,
  PredictionMethod,
  TypicalRegion,
  PredictionValidationStats,
} from '@/lib/types/predictions';
import type { BehavioralProfile } from '@/lib/types/ml';

// Configuration
const CONFIG = {
  horizons: [5, 15, 30] as const, // Prediction horizons in minutes
  confidenceDecay: {
    5: 0.95,
    15: 0.85,
    30: 0.70,
  } as Record<number, number>,
  uncertaintyGrowth: {
    5: 1.0, // nm base uncertainty at 5 min
    15: 3.0, // nm base uncertainty at 15 min
    30: 6.0, // nm base uncertainty at 30 min
  } as Record<number, number>,
  // Speed-based uncertainty adjustment (faster = more uncertainty)
  speedUncertaintyFactor: 0.01, // nm per knot at max horizon
  // Turn rate uncertainty (turning = more uncertainty)
  turnRateUncertaintyFactor: 0.5, // nm per deg/sec
  // Minimum predictions to validate
  minValidationSamples: 100,
  // Stale prediction threshold
  staleMinutes: 10,
  // Base confidence for physics-only prediction
  baseConfidence: 0.7,
  // Behavioral profile confidence boost
  behavioralBoost: 0.15,
};

export class TrajectoryPredictor {
  /**
   * Predict trajectory for a single aircraft
   */
  async predictTrajectory(
    input: TrajectoryPredictionInput
  ): Promise<TrajectoryPrediction[]> {
    const predictions: TrajectoryPrediction[] = [];

    try {
      // Get behavioral profile if available
      const profile = await this.getBehavioralProfile(input.aircraft_id);

      // Calculate base confidence
      let baseConfidence = CONFIG.baseConfidence;
      let method: PredictionMethod = 'physics_basic';

      // Boost confidence if we have behavioral data
      if (profile && profile.is_trained) {
        baseConfidence += CONFIG.behavioralBoost;
        method = 'physics_behavioral';
      }

      // Ensure we have minimum required data
      if (input.heading === null && input.ground_speed === null) {
        // Can't predict without heading or speed
        return [];
      }

      const heading = input.heading ?? 0;
      const speed = input.ground_speed ?? 0;

      for (const horizon of CONFIG.horizons) {
        const predicted = this.calculatePredictedPosition(
          input,
          horizon,
          heading,
          speed,
          profile,
          baseConfidence,
          method
        );

        // Store prediction
        const storedPrediction = await this.storePrediction({
          aircraft_id: input.aircraft_id,
          icao_hex: input.icao_hex,
          ...predicted,
          source_lat: input.latitude,
          source_lon: input.longitude,
          source_altitude: input.altitude,
          source_heading: input.heading,
          source_speed: input.ground_speed,
          turn_rate: input.turn_rate ?? null,
          vertical_rate: input.vertical_rate ?? null,
          prediction_method: method,
        });

        if (storedPrediction) {
          predictions.push(storedPrediction);
        }
      }

      return predictions;
    } catch (error) {
      console.error('Error predicting trajectory:', error);
      return [];
    }
  }

  /**
   * Calculate predicted position for a given horizon
   */
  private calculatePredictedPosition(
    input: TrajectoryPredictionInput,
    horizonMinutes: number,
    heading: number,
    speed: number,
    profile: BehavioralProfile | null,
    baseConfidence: number,
    method: PredictionMethod
  ): PredictedPosition {
    // Calculate distance traveled in horizon time
    const hoursElapsed = horizonMinutes / 60;
    let distanceNm = speed * hoursElapsed;

    // Adjust heading for turn rate if available
    let predictedHeading = heading;
    if (input.turn_rate && input.turn_rate !== 0) {
      // Turn rate is degrees per second
      const turnDegrees = input.turn_rate * horizonMinutes * 60;
      predictedHeading = (heading + turnDegrees + 360) % 360;

      // For curved paths, reduce distance (aircraft turns, doesn't go straight)
      const avgHeadingChange = Math.abs(turnDegrees) / 2;
      if (avgHeadingChange > 10) {
        distanceNm *= Math.cos(avgHeadingChange * (Math.PI / 180));
      }
    }

    // Calculate predicted position using great circle navigation
    const predictedPos = destination(
      input.latitude,
      input.longitude,
      (heading + predictedHeading) / 2, // Use average heading for curved path
      distanceNm
    );

    // Calculate predicted altitude
    let predictedAltitude = input.altitude;
    if (input.altitude !== null && input.vertical_rate) {
      // Vertical rate is feet per minute
      predictedAltitude = input.altitude + (input.vertical_rate * horizonMinutes);
      predictedAltitude = Math.max(0, predictedAltitude); // Don't go below ground
    }

    // Calculate predicted speed (assume constant for now)
    const predictedSpeed = speed;

    // Calculate uncertainty radius
    let uncertainty = CONFIG.uncertaintyGrowth[horizonMinutes] || 5;

    // Increase uncertainty based on speed
    uncertainty += speed * CONFIG.speedUncertaintyFactor * (horizonMinutes / 30);

    // Increase uncertainty for turning aircraft
    if (input.turn_rate && Math.abs(input.turn_rate) > 0.5) {
      uncertainty += Math.abs(input.turn_rate) * CONFIG.turnRateUncertaintyFactor * (horizonMinutes / 30);
    }

    // Apply behavioral profile adjustments
    if (profile && profile.is_trained && profile.typical_regions.length > 0) {
      // Check if predicted position is near typical operating regions
      const nearTypicalRegion = this.isNearTypicalRegion(
        predictedPos.lat,
        predictedPos.lon,
        profile.typical_regions
      );

      if (nearTypicalRegion) {
        // Reduce uncertainty if aircraft typically operates here
        uncertainty *= 0.8;
      } else {
        // Increase uncertainty if outside typical area
        uncertainty *= 1.2;
      }
    }

    // Calculate confidence with decay
    const confidence = Math.min(
      baseConfidence * (CONFIG.confidenceDecay[horizonMinutes] || 0.7),
      0.95
    );

    return {
      horizon_minutes: horizonMinutes,
      latitude: predictedPos.lat,
      longitude: predictedPos.lon,
      altitude: predictedAltitude,
      heading: predictedHeading,
      speed: predictedSpeed,
      uncertainty_radius_nm: Math.round(uncertainty * 100) / 100,
      confidence: Math.round(confidence * 1000) / 1000,
    };
  }

  /**
   * Check if position is near typical operating regions
   */
  private isNearTypicalRegion(
    lat: number,
    lon: number,
    regions: TypicalRegion[]
  ): boolean {
    for (const region of regions) {
      const dist = distanceNm(lat, lon, region.center_lat, region.center_lon);
      if (dist <= region.radius_nm * 1.5) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get behavioral profile for aircraft
   */
  private async getBehavioralProfile(
    aircraftId: string
  ): Promise<BehavioralProfile | null> {
    try {
      return await queryOne<BehavioralProfile>(
        `SELECT * FROM behavioral_profiles WHERE aircraft_id = $1`,
        [aircraftId]
      );
    } catch {
      return null;
    }
  }

  /**
   * Store prediction in database
   */
  private async storePrediction(params: {
    aircraft_id: string;
    icao_hex: string;
    horizon_minutes: number;
    latitude: number;
    longitude: number;
    altitude: number | null;
    heading: number | null;
    speed: number | null;
    uncertainty_radius_nm: number;
    confidence: number;
    source_lat: number;
    source_lon: number;
    source_altitude: number | null;
    source_heading: number | null;
    source_speed: number | null;
    turn_rate: number | null;
    vertical_rate: number | null;
    prediction_method: PredictionMethod;
  }): Promise<TrajectoryPrediction | null> {
    try {
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + params.horizon_minutes + 5);

      return await queryOne<TrajectoryPrediction>(
        `INSERT INTO trajectory_predictions (
           aircraft_id, icao_hex, horizon_minutes,
           predicted_lat, predicted_lon, predicted_altitude,
           predicted_heading, predicted_speed,
           uncertainty_radius_nm, confidence,
           source_lat, source_lon, source_altitude,
           source_heading, source_speed,
           turn_rate, vertical_rate,
           prediction_method,
           predicted_at, expires_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), $19)
         RETURNING *`,
        [
          params.aircraft_id,
          params.icao_hex,
          params.horizon_minutes,
          params.latitude,
          params.longitude,
          params.altitude,
          params.heading,
          params.speed,
          params.uncertainty_radius_nm,
          params.confidence,
          params.source_lat,
          params.source_lon,
          params.source_altitude,
          params.source_heading,
          params.source_speed,
          params.turn_rate,
          params.vertical_rate,
          params.prediction_method,
          expiresAt.toISOString(),
        ]
      );
    } catch (error) {
      console.error('Error storing prediction:', error);
      return null;
    }
  }

  /**
   * Predict trajectories for all active aircraft
   */
  async predictAllActive(): Promise<{
    total: number;
    predicted: number;
    errors: number;
  }> {
    const stats = { total: 0, predicted: 0, errors: 0 };

    try {
      // Get active aircraft positions
      const positions = await query<{
        aircraft_id: string;
        icao_hex: string;
        latitude: number;
        longitude: number;
        altitude: number | null;
        ground_speed: number | null;
        track: number | null;
        vertical_rate: number | null;
      }>(
        `SELECT
           pl.aircraft_id,
           pl.icao_hex,
           pl.latitude,
           pl.longitude,
           pl.altitude,
           pl.ground_speed,
           pl.track,
           pl.vertical_rate
         FROM positions_latest pl
         JOIN aircraft a ON a.id = pl.aircraft_id
         WHERE pl.timestamp >= NOW() - INTERVAL '5 minutes'
         AND a.is_military = TRUE
         AND pl.ground_speed > 50`
      );

      stats.total = positions.length;

      for (const pos of positions) {
        try {
          const predictions = await this.predictTrajectory({
            aircraft_id: pos.aircraft_id,
            icao_hex: pos.icao_hex,
            latitude: pos.latitude,
            longitude: pos.longitude,
            altitude: pos.altitude,
            heading: pos.track,
            ground_speed: pos.ground_speed,
            vertical_rate: pos.vertical_rate,
          });

          if (predictions.length > 0) {
            stats.predicted++;
          }
        } catch {
          stats.errors++;
        }
      }

      return stats;
    } catch (error) {
      console.error('Error predicting all trajectories:', error);
      return stats;
    }
  }

  /**
   * Get active predictions for an aircraft
   */
  async getPredictions(aircraftId: string): Promise<TrajectoryPrediction[]> {
    try {
      return await query<TrajectoryPrediction>(
        `SELECT * FROM trajectory_predictions
         WHERE aircraft_id = $1
         AND expires_at > NOW()
         ORDER BY horizon_minutes ASC`,
        [aircraftId]
      );
    } catch (error) {
      console.error('Error getting predictions:', error);
      return [];
    }
  }

  /**
   * Get predictions by ICAO hex
   */
  async getPredictionsByIcao(icaoHex: string): Promise<TrajectoryPrediction[]> {
    try {
      return await query<TrajectoryPrediction>(
        `SELECT * FROM trajectory_predictions
         WHERE icao_hex = $1
         AND expires_at > NOW()
         ORDER BY horizon_minutes ASC`,
        [icaoHex]
      );
    } catch (error) {
      console.error('Error getting predictions by ICAO:', error);
      return [];
    }
  }

  /**
   * Validate past predictions against actual positions
   */
  async validatePredictions(): Promise<{
    validated: number;
    accurate: number;
    accuracy_rate: number;
  }> {
    const stats = { validated: 0, accurate: 0, accuracy_rate: 0 };

    try {
      // Find predictions that have now passed their prediction time
      // and compare against actual positions
      const predictions = await query<{
        id: string;
        aircraft_id: string;
        horizon_minutes: number;
        predicted_lat: number;
        predicted_lon: number;
        predicted_at: string;
        uncertainty_radius_nm: number;
      }>(
        `SELECT p.id, p.aircraft_id, p.horizon_minutes,
                p.predicted_lat, p.predicted_lon, p.predicted_at,
                p.uncertainty_radius_nm
         FROM trajectory_predictions p
         WHERE p.predicted_at + (p.horizon_minutes || ' minutes')::interval < NOW()
         AND p.predicted_at + (p.horizon_minutes || ' minutes')::interval > NOW() - INTERVAL '30 minutes'
         LIMIT 500`
      );

      for (const pred of predictions) {
        // Get actual position at prediction time
        const predictionTargetTime = new Date(pred.predicted_at);
        predictionTargetTime.setMinutes(
          predictionTargetTime.getMinutes() + pred.horizon_minutes
        );

        const actualPos = await queryOne<{
          latitude: number;
          longitude: number;
        }>(
          `SELECT latitude, longitude
           FROM positions
           WHERE aircraft_id = $1
           AND timestamp >= $2 - INTERVAL '1 minute'
           AND timestamp <= $2 + INTERVAL '1 minute'
           ORDER BY ABS(EXTRACT(EPOCH FROM (timestamp - $2)))
           LIMIT 1`,
          [pred.aircraft_id, predictionTargetTime.toISOString()]
        );

        if (actualPos) {
          stats.validated++;

          // Calculate error distance
          const errorNm = distanceNm(
            pred.predicted_lat,
            pred.predicted_lon,
            actualPos.latitude,
            actualPos.longitude
          );

          // Prediction is accurate if within uncertainty cone
          if (errorNm <= pred.uncertainty_radius_nm) {
            stats.accurate++;
          }

          // Store validation result
          await this.storeValidationResult(
            pred.horizon_minutes,
            errorNm,
            pred.uncertainty_radius_nm
          );
        }
      }

      stats.accuracy_rate =
        stats.validated > 0 ? stats.accurate / stats.validated : 0;

      return stats;
    } catch (error) {
      console.error('Error validating predictions:', error);
      return stats;
    }
  }

  /**
   * Store validation result for statistics
   */
  private async storeValidationResult(
    horizonMinutes: number,
    errorNm: number,
    uncertaintyNm: number
  ): Promise<void> {
    const periodStart = new Date();
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 1);

    try {
      await execute(
        `INSERT INTO prediction_validation_stats (
           prediction_type, horizon_minutes,
           total_predictions, validated_predictions, accurate_predictions,
           mean_error, period_start, period_end
         )
         VALUES ('trajectory', $1, 1, 1, $2, $3, $4, $5)
         ON CONFLICT (prediction_type, horizon_minutes, period_start)
         DO UPDATE SET
           total_predictions = prediction_validation_stats.total_predictions + 1,
           validated_predictions = prediction_validation_stats.validated_predictions + 1,
           accurate_predictions = prediction_validation_stats.accurate_predictions + $2,
           mean_error = (prediction_validation_stats.mean_error * prediction_validation_stats.validated_predictions + $3) /
                        (prediction_validation_stats.validated_predictions + 1)`,
        [
          horizonMinutes,
          errorNm <= uncertaintyNm ? 1 : 0,
          errorNm,
          periodStart.toISOString(),
          periodEnd.toISOString(),
        ]
      );
    } catch (error) {
      console.error('Error storing validation result:', error);
    }
  }

  /**
   * Get prediction accuracy statistics
   */
  async getAccuracyStats(): Promise<PredictionValidationStats[]> {
    try {
      return await query<PredictionValidationStats>(
        `SELECT * FROM prediction_validation_stats
         WHERE prediction_type = 'trajectory'
         AND period_start >= NOW() - INTERVAL '30 days'
         ORDER BY period_start DESC, horizon_minutes ASC`
      );
    } catch (error) {
      console.error('Error getting accuracy stats:', error);
      return [];
    }
  }

  /**
   * Clean up expired predictions
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await queryOne<{ count: string }>(
        `WITH deleted AS (
           DELETE FROM trajectory_predictions
           WHERE expires_at < NOW() - INTERVAL '1 hour'
           RETURNING id
         )
         SELECT COUNT(*) as count FROM deleted`
      );
      return parseInt(result?.count || '0', 10);
    } catch (error) {
      console.error('Error cleaning up predictions:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const trajectoryPredictor = new TrajectoryPredictor();
