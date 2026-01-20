import { execute, queryOne, query } from '@/lib/db';
import { distanceNm, bearing } from '@/lib/utils/geo';
import type {
  ProximityWarning,
  ProximityWarningType,
  ProximitySeverity,
  ProximityAnalysisInput,
  ProximityResult,
} from '@/lib/types/predictions';

// Configuration
const CONFIG = {
  // Distance thresholds (nautical miles)
  thresholds: {
    critical: 3,
    high: 5,
    medium: 10,
    low: 20,
  },
  // Vertical separation thresholds (feet)
  verticalThresholds: {
    critical: 500,
    high: 1000,
    medium: 2000,
    low: 3000,
  },
  // Minimum closure rate to consider (knots)
  minClosureRate: 50,
  // Look-ahead time for predictions (minutes)
  lookAheadMinutes: 30,
  // Maximum active warnings to track
  maxActiveWarnings: 100,
  // Warning resolution time (minutes without update before resolved)
  resolutionMinutes: 10,
  // Minimum confidence to generate warning
  minConfidence: 0.5,
  // Analysis batch size
  batchSize: 50,
};

export class ProximityAnalyzer {
  /**
   * Analyze proximity between two aircraft
   */
  analyzeProximity(input: ProximityAnalysisInput): ProximityResult {
    // Calculate current separation
    const currentDistance = distanceNm(
      input.lat_1,
      input.lon_1,
      input.lat_2,
      input.lon_2
    );

    // Calculate vertical separation
    const verticalSeparation =
      input.altitude_1 !== null && input.altitude_2 !== null
        ? Math.abs(input.altitude_1 - input.altitude_2)
        : null;

    // Calculate closure rate and time to closest approach
    const closureAnalysis = this.calculateClosureRate(input);

    // Determine if there's a potential conflict
    if (closureAnalysis.closureRate <= CONFIG.minClosureRate) {
      // Not converging significantly
      return {
        has_conflict: false,
        warning_type: null,
        severity: null,
        closest_approach_nm: currentDistance,
        closest_approach_time: null,
        time_to_closest_minutes: null,
        closure_rate_kts: closureAnalysis.closureRate,
        vertical_separation_ft: verticalSeparation,
        confidence: 0,
      };
    }

    // Predict closest approach
    const closestApproach = this.predictClosestApproach(
      input,
      closureAnalysis
    );

    // Determine warning type
    const warningType = this.determineWarningType(
      input,
      closestApproach,
      verticalSeparation
    );

    // Determine severity
    const severity = this.determineSeverity(
      closestApproach.distance,
      verticalSeparation
    );

    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(input, closestApproach);

    const hasConflict =
      severity !== null &&
      closestApproach.distance < CONFIG.thresholds.low &&
      confidence >= CONFIG.minConfidence;

    return {
      has_conflict: hasConflict,
      warning_type: hasConflict ? warningType : null,
      severity: hasConflict ? severity : null,
      closest_approach_nm: closestApproach.distance,
      closest_approach_time: closestApproach.time,
      time_to_closest_minutes: closestApproach.timeMinutes,
      closure_rate_kts: closureAnalysis.closureRate,
      vertical_separation_ft: verticalSeparation,
      confidence,
    };
  }

  /**
   * Calculate closure rate between two aircraft
   */
  private calculateClosureRate(input: ProximityAnalysisInput): {
    closureRate: number;
    relativeHeading: number;
  } {
    // If we don't have heading/speed for both, estimate from current distance
    if (
      input.heading_1 === null ||
      input.speed_1 === null ||
      input.heading_2 === null ||
      input.speed_2 === null
    ) {
      return { closureRate: 0, relativeHeading: 0 };
    }

    // Calculate relative velocity components
    const rad1 = (input.heading_1 * Math.PI) / 180;
    const rad2 = (input.heading_2 * Math.PI) / 180;

    // Velocity components for aircraft 1
    const vx1 = input.speed_1 * Math.sin(rad1);
    const vy1 = input.speed_1 * Math.cos(rad1);

    // Velocity components for aircraft 2
    const vx2 = input.speed_2 * Math.sin(rad2);
    const vy2 = input.speed_2 * Math.cos(rad2);

    // Relative velocity
    const relVx = vx1 - vx2;
    const relVy = vy1 - vy2;

    // Direction from aircraft 1 to aircraft 2
    const bearingTo2 = bearing(input.lat_1, input.lon_1, input.lat_2, input.lon_2);
    const bearingRad = (bearingTo2 * Math.PI) / 180;

    // Component of relative velocity towards aircraft 2 (closure rate)
    const closureRate = relVx * Math.sin(bearingRad) + relVy * Math.cos(bearingRad);

    // Relative heading (how different are their headings)
    let relativeHeading = Math.abs(input.heading_1 - input.heading_2);
    if (relativeHeading > 180) relativeHeading = 360 - relativeHeading;

    return {
      closureRate: Math.max(0, closureRate), // Only positive (converging)
      relativeHeading,
    };
  }

  /**
   * Predict closest approach point using proper vector math
   * CPA calculation: time_cpa = -(pos · vel) / |vel|², cpa_dist = |pos + vel * t_cpa|
   */
  private predictClosestApproach(
    input: ProximityAnalysisInput,
    closureAnalysis: { closureRate: number; relativeHeading: number }
  ): {
    distance: number;
    time: string | null;
    timeMinutes: number | null;
  } {
    const currentDistance = distanceNm(
      input.lat_1,
      input.lon_1,
      input.lat_2,
      input.lon_2
    );

    // If missing velocity data, return current distance as best estimate
    if (
      input.heading_1 === null ||
      input.speed_1 === null ||
      input.heading_2 === null ||
      input.speed_2 === null
    ) {
      return {
        distance: currentDistance,
        time: null,
        timeMinutes: null,
      };
    }

    // Convert headings to radians
    const rad1 = (input.heading_1 * Math.PI) / 180;
    const rad2 = (input.heading_2 * Math.PI) / 180;

    // Velocity components (knots) - using local tangent plane approximation
    // x = East, y = North
    const vx1 = input.speed_1 * Math.sin(rad1);
    const vy1 = input.speed_1 * Math.cos(rad1);
    const vx2 = input.speed_2 * Math.sin(rad2);
    const vy2 = input.speed_2 * Math.cos(rad2);

    // Relative velocity (aircraft 1 relative to aircraft 2)
    const relVx = vx1 - vx2;
    const relVy = vy1 - vy2;
    const relSpeedSq = relVx * relVx + relVy * relVy;

    // If relative speed is negligible, aircraft maintain current distance
    if (relSpeedSq < 1) {
      return {
        distance: currentDistance,
        time: null,
        timeMinutes: null,
      };
    }

    // Position of aircraft 1 relative to aircraft 2 in nm
    // Convert lat/lon difference to local tangent plane coordinates
    const avgLat = (input.lat_1 + input.lat_2) / 2;
    const cosLat = Math.cos((avgLat * Math.PI) / 180);
    const dx = (input.lon_1 - input.lon_2) * 60 * cosLat; // nm (approx 60nm per degree longitude at equator)
    const dy = (input.lat_1 - input.lat_2) * 60; // nm (approx 60nm per degree latitude)

    // Time to CPA: t = -(pos · vel) / |vel|²
    // Positive t means CPA is in the future
    const dotProduct = dx * relVx + dy * relVy;
    const timeToCpaHours = -dotProduct / relSpeedSq;

    // If CPA is in the past or too far in the future, use current distance
    if (timeToCpaHours < 0) {
      return {
        distance: currentDistance,
        time: null,
        timeMinutes: null,
      };
    }

    const timeMinutes = timeToCpaHours * 60;

    // Cap at look-ahead time
    if (timeMinutes > CONFIG.lookAheadMinutes) {
      return {
        distance: currentDistance,
        time: null,
        timeMinutes: null,
      };
    }

    // Calculate CPA distance: |pos + vel * t_cpa|
    const cpaDx = dx + relVx * timeToCpaHours;
    const cpaDy = dy + relVy * timeToCpaHours;
    const cpaDistance = Math.sqrt(cpaDx * cpaDx + cpaDy * cpaDy);

    const closestTime = new Date();
    closestTime.setMinutes(closestTime.getMinutes() + timeMinutes);

    return {
      distance: cpaDistance,
      time: closestTime.toISOString(),
      timeMinutes,
    };
  }

  /**
   * Determine the type of proximity warning
   */
  private determineWarningType(
    input: ProximityAnalysisInput,
    closestApproach: { distance: number; timeMinutes: number | null },
    verticalSeparation: number | null
  ): ProximityWarningType {
    // Check for same altitude conflict
    if (
      verticalSeparation !== null &&
      verticalSeparation < CONFIG.verticalThresholds.critical
    ) {
      return 'same_altitude';
    }

    // Determine based on relative headings
    if (input.heading_1 !== null && input.heading_2 !== null) {
      let headingDiff = Math.abs(input.heading_1 - input.heading_2);
      if (headingDiff > 180) headingDiff = 360 - headingDiff;

      if (headingDiff < 30) {
        return 'parallel_approach';
      } else if (headingDiff > 150) {
        return 'convergence'; // Head-on
      } else if (headingDiff > 60 && headingDiff < 120) {
        return 'crossing';
      }
    }

    // Check for vertical conflict
    if (input.altitude_1 !== null && input.altitude_2 !== null) {
      // Check if altitudes are converging (would need vertical rates to properly assess)
      if (
        verticalSeparation !== null &&
        verticalSeparation < CONFIG.verticalThresholds.medium
      ) {
        return 'vertical_conflict';
      }
    }

    return 'convergence';
  }

  /**
   * Determine severity of the warning
   */
  private determineSeverity(
    closestApproachNm: number,
    verticalSeparation: number | null
  ): ProximitySeverity | null {
    // Determine lateral severity
    let lateralSeverity: ProximitySeverity | null = null;
    if (closestApproachNm < CONFIG.thresholds.critical) {
      lateralSeverity = 'critical';
    } else if (closestApproachNm < CONFIG.thresholds.high) {
      lateralSeverity = 'high';
    } else if (closestApproachNm < CONFIG.thresholds.medium) {
      lateralSeverity = 'medium';
    } else if (closestApproachNm < CONFIG.thresholds.low) {
      lateralSeverity = 'low';
    }

    // Determine vertical severity if available
    let verticalSeverity: ProximitySeverity | null = null;
    if (verticalSeparation !== null) {
      if (verticalSeparation < CONFIG.verticalThresholds.critical) {
        verticalSeverity = 'critical';
      } else if (verticalSeparation < CONFIG.verticalThresholds.high) {
        verticalSeverity = 'high';
      } else if (verticalSeparation < CONFIG.verticalThresholds.medium) {
        verticalSeverity = 'medium';
      } else if (verticalSeparation < CONFIG.verticalThresholds.low) {
        verticalSeverity = 'low';
      }
    }

    // Combine: take the higher severity
    const severityOrder: ProximitySeverity[] = ['critical', 'high', 'medium', 'low'];

    if (lateralSeverity === null && verticalSeverity === null) {
      return null;
    }

    if (lateralSeverity === null) return verticalSeverity;
    if (verticalSeverity === null) return lateralSeverity;

    const lateralIndex = severityOrder.indexOf(lateralSeverity);
    const verticalIndex = severityOrder.indexOf(verticalSeverity);

    return lateralIndex <= verticalIndex ? lateralSeverity : verticalSeverity;
  }

  /**
   * Calculate confidence in the warning
   */
  private calculateConfidence(
    input: ProximityAnalysisInput,
    closestApproach: { distance: number; timeMinutes: number | null }
  ): number {
    let confidence = 1.0;

    // Reduce confidence if missing data
    if (input.heading_1 === null) confidence -= 0.2;
    if (input.heading_2 === null) confidence -= 0.2;
    if (input.speed_1 === null) confidence -= 0.15;
    if (input.speed_2 === null) confidence -= 0.15;
    if (input.altitude_1 === null) confidence -= 0.1;
    if (input.altitude_2 === null) confidence -= 0.1;

    // Reduce confidence for further future predictions
    if (closestApproach.timeMinutes !== null) {
      if (closestApproach.timeMinutes > 20) {
        confidence -= 0.2;
      } else if (closestApproach.timeMinutes > 10) {
        confidence -= 0.1;
      }
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Analyze all active aircraft for proximity warnings
   */
  async analyzeAllProximity(): Promise<{
    pairs_analyzed: number;
    warnings_generated: number;
    warnings_updated: number;
    warnings_resolved: number;
  }> {
    const stats = {
      pairs_analyzed: 0,
      warnings_generated: 0,
      warnings_updated: 0,
      warnings_resolved: 0,
    };

    try {
      // Get active military aircraft positions
      const positions = await query<{
        aircraft_id: string;
        icao_hex: string;
        latitude: number;
        longitude: number;
        altitude: number | null;
        ground_speed: number | null;
        track: number | null;
      }>(
        `SELECT
           pl.aircraft_id,
           pl.icao_hex,
           pl.latitude,
           pl.longitude,
           pl.altitude,
           pl.ground_speed,
           pl.track
         FROM positions_latest pl
         JOIN aircraft a ON a.id = pl.aircraft_id
         WHERE pl.timestamp >= NOW() - INTERVAL '5 minutes'
         AND a.is_military = TRUE
         AND pl.ground_speed > 50`
      );

      // Analyze pairs within potential conflict range
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const pos1 = positions[i];
          const pos2 = positions[j];

          // Quick distance check before detailed analysis
          const quickDist = distanceNm(
            pos1.latitude,
            pos1.longitude,
            pos2.latitude,
            pos2.longitude
          );

          if (quickDist > CONFIG.thresholds.low * 2) {
            continue; // Too far apart to analyze
          }

          stats.pairs_analyzed++;

          const result = this.analyzeProximity({
            aircraft_id_1: pos1.aircraft_id,
            icao_hex_1: pos1.icao_hex,
            lat_1: pos1.latitude,
            lon_1: pos1.longitude,
            altitude_1: pos1.altitude,
            heading_1: pos1.track,
            speed_1: pos1.ground_speed,
            aircraft_id_2: pos2.aircraft_id,
            icao_hex_2: pos2.icao_hex,
            lat_2: pos2.latitude,
            lon_2: pos2.longitude,
            altitude_2: pos2.altitude,
            heading_2: pos2.track,
            speed_2: pos2.ground_speed,
          });

          if (result.has_conflict && result.severity && result.warning_type) {
            const storeResult = await this.storeWarning({
              aircraft_id_1: pos1.aircraft_id,
              aircraft_id_2: pos2.aircraft_id,
              icao_hex_1: pos1.icao_hex,
              icao_hex_2: pos2.icao_hex,
              warning_type: result.warning_type,
              severity: result.severity,
              closest_approach_nm: result.closest_approach_nm,
              closest_approach_time: result.closest_approach_time!,
              lat_1: pos1.latitude,
              lon_1: pos1.longitude,
              altitude_1: pos1.altitude,
              lat_2: pos2.latitude,
              lon_2: pos2.longitude,
              altitude_2: pos2.altitude,
              closure_rate_kts: result.closure_rate_kts,
              vertical_separation_ft: result.vertical_separation_ft,
              confidence: result.confidence,
            });

            if (storeResult.created) {
              stats.warnings_generated++;
            } else if (storeResult.updated) {
              stats.warnings_updated++;
            }
          }
        }
      }

      // Resolve stale warnings
      stats.warnings_resolved = await this.resolveStaleWarnings();

      return stats;
    } catch (error) {
      console.error('Error analyzing proximity:', error);
      return stats;
    }
  }

  /**
   * Store or update a proximity warning
   */
  private async storeWarning(params: {
    aircraft_id_1: string;
    aircraft_id_2: string;
    icao_hex_1: string;
    icao_hex_2: string;
    warning_type: ProximityWarningType;
    severity: ProximitySeverity;
    closest_approach_nm: number;
    closest_approach_time: string;
    lat_1: number;
    lon_1: number;
    altitude_1: number | null;
    lat_2: number;
    lon_2: number;
    altitude_2: number | null;
    closure_rate_kts: number | null;
    vertical_separation_ft: number | null;
    confidence: number;
  }): Promise<{ created: boolean; updated: boolean }> {
    try {
      // Normalize aircraft order (smaller ID first)
      const [id1, id2] =
        params.aircraft_id_1 < params.aircraft_id_2
          ? [params.aircraft_id_1, params.aircraft_id_2]
          : [params.aircraft_id_2, params.aircraft_id_1];

      // Check for existing active warning
      const existing = await queryOne<ProximityWarning>(
        `SELECT * FROM proximity_warnings
         WHERE aircraft_id_1 = $1 AND aircraft_id_2 = $2
         AND is_active = TRUE`,
        [id1, id2]
      );

      if (existing) {
        // Update existing warning
        await execute(
          `UPDATE proximity_warnings SET
             warning_type = $1,
             severity = $2,
             closest_approach_nm = $3,
             closest_approach_time = $4,
             lat_1 = $5, lon_1 = $6, altitude_1 = $7,
             lat_2 = $8, lon_2 = $9, altitude_2 = $10,
             closure_rate_kts = $11,
             vertical_separation_ft = $12,
             confidence = $13,
             last_updated_at = NOW()
           WHERE id = $14`,
          [
            params.warning_type,
            params.severity,
            params.closest_approach_nm,
            params.closest_approach_time,
            params.lat_1,
            params.lon_1,
            params.altitude_1,
            params.lat_2,
            params.lon_2,
            params.altitude_2,
            params.closure_rate_kts,
            params.vertical_separation_ft,
            params.confidence,
            existing.id,
          ]
        );
        return { created: false, updated: true };
      } else {
        // Create new warning
        await execute(
          `INSERT INTO proximity_warnings (
             aircraft_id_1, aircraft_id_2, icao_hex_1, icao_hex_2,
             warning_type, severity, closest_approach_nm, closest_approach_time,
             lat_1, lon_1, altitude_1, lat_2, lon_2, altitude_2,
             closure_rate_kts, vertical_separation_ft, confidence,
             first_detected_at, last_updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())`,
          [
            id1,
            id2,
            params.icao_hex_1,
            params.icao_hex_2,
            params.warning_type,
            params.severity,
            params.closest_approach_nm,
            params.closest_approach_time,
            params.lat_1,
            params.lon_1,
            params.altitude_1,
            params.lat_2,
            params.lon_2,
            params.altitude_2,
            params.closure_rate_kts,
            params.vertical_separation_ft,
            params.confidence,
          ]
        );
        return { created: true, updated: false };
      }
    } catch (error) {
      console.error('Error storing warning:', error);
      return { created: false, updated: false };
    }
  }

  /**
   * Resolve stale warnings (no update for resolution period)
   */
  private async resolveStaleWarnings(): Promise<number> {
    try {
      const result = await queryOne<{ count: string }>(
        `WITH resolved AS (
           UPDATE proximity_warnings
           SET is_active = FALSE, resolved_at = NOW()
           WHERE is_active = TRUE
           AND last_updated_at < NOW() - INTERVAL '${CONFIG.resolutionMinutes} minutes'
           RETURNING id
         )
         SELECT COUNT(*) as count FROM resolved`
      );
      return parseInt(result?.count || '0', 10);
    } catch (error) {
      console.error('Error resolving stale warnings:', error);
      return 0;
    }
  }

  /**
   * Get active proximity warnings
   */
  async getActiveWarnings(
    severity?: ProximitySeverity
  ): Promise<ProximityWarning[]> {
    try {
      let whereClause = 'WHERE is_active = TRUE';
      const params: string[] = [];

      if (severity) {
        whereClause += ' AND severity = $1';
        params.push(severity);
      }

      return await query<ProximityWarning>(
        `SELECT * FROM proximity_warnings
         ${whereClause}
         ORDER BY
           CASE severity
             WHEN 'critical' THEN 0
             WHEN 'high' THEN 1
             WHEN 'medium' THEN 2
             WHEN 'low' THEN 3
           END,
           closest_approach_nm ASC`,
        params
      );
    } catch (error) {
      console.error('Error getting active warnings:', error);
      return [];
    }
  }

  /**
   * Get warnings involving a specific aircraft
   */
  async getWarningsForAircraft(aircraftId: string): Promise<ProximityWarning[]> {
    try {
      return await query<ProximityWarning>(
        `SELECT * FROM proximity_warnings
         WHERE (aircraft_id_1 = $1 OR aircraft_id_2 = $1)
         AND is_active = TRUE
         ORDER BY severity, closest_approach_nm ASC`,
        [aircraftId]
      );
    } catch (error) {
      console.error('Error getting warnings for aircraft:', error);
      return [];
    }
  }

  /**
   * Acknowledge a warning
   */
  async acknowledgeWarning(
    warningId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const result = await execute(
        `UPDATE proximity_warnings
         SET is_acknowledged = TRUE, acknowledged_by = $1, acknowledged_at = NOW()
         WHERE id = $2`,
        [userId, warningId]
      );
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error acknowledging warning:', error);
      return false;
    }
  }

  /**
   * Get warning statistics
   */
  async getStats(): Promise<{
    active_warnings: number;
    by_severity: Record<string, number>;
    by_type: Record<string, number>;
    acknowledged: number;
    avg_closure_rate: number;
  }> {
    try {
      const activeResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM proximity_warnings WHERE is_active = TRUE`
      );

      const bySeverityResults = await query<{ severity: string; count: string }>(
        `SELECT severity, COUNT(*) as count
         FROM proximity_warnings
         WHERE is_active = TRUE
         GROUP BY severity`
      );

      const byTypeResults = await query<{ warning_type: string; count: string }>(
        `SELECT warning_type, COUNT(*) as count
         FROM proximity_warnings
         WHERE is_active = TRUE
         GROUP BY warning_type`
      );

      const acknowledgedResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM proximity_warnings
         WHERE is_active = TRUE AND is_acknowledged = TRUE`
      );

      const avgClosureResult = await queryOne<{ avg_closure: string }>(
        `SELECT AVG(closure_rate_kts) as avg_closure
         FROM proximity_warnings
         WHERE is_active = TRUE AND closure_rate_kts IS NOT NULL`
      );

      const bySeverity: Record<string, number> = {};
      for (const row of bySeverityResults) {
        bySeverity[row.severity] = parseInt(row.count, 10);
      }

      const byType: Record<string, number> = {};
      for (const row of byTypeResults) {
        byType[row.warning_type] = parseInt(row.count, 10);
      }

      return {
        active_warnings: parseInt(activeResult?.count || '0', 10),
        by_severity: bySeverity,
        by_type: byType,
        acknowledged: parseInt(acknowledgedResult?.count || '0', 10),
        avg_closure_rate: parseFloat(avgClosureResult?.avg_closure || '0'),
      };
    } catch {
      return {
        active_warnings: 0,
        by_severity: {},
        by_type: {},
        acknowledged: 0,
        avg_closure_rate: 0,
      };
    }
  }
}

// Export singleton instance
export const proximityAnalyzer = new ProximityAnalyzer();
