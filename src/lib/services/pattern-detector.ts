/**
 * Enhanced Pattern Detection Service
 * Detects flight patterns like orbits, racetracks, holding patterns, and tanker tracks
 */

import {
  Point,
  fitCircle,
  findHeadingReversals,
  calculateAngularVelocity,
  checkAreaConfinement,
  detectRacetrackParams,
  haversineDistance,
  calculateBearing,
} from '@/lib/utils/pattern-math';
import type { Position, FlightPattern } from '@/lib/types/aircraft';

export interface PatternDetection {
  pattern_type: FlightPattern;
  confidence: number;
  center_lat: number | null;
  center_lon: number | null;
  radius_nm: number | null;
  duration_minutes: number;
  start_time: Date;
  end_time: Date;
  metadata: Record<string, unknown>;
}

export interface PatternDetectionResult {
  detected: boolean;
  patterns: PatternDetection[];
  primaryPattern: PatternDetection | null;
}

// Minimum requirements for pattern detection
const MIN_POSITIONS_FOR_ORBIT = 10;
const MIN_POSITIONS_FOR_RACETRACK = 8;
const MIN_POSITIONS_FOR_HOLDING = 6;
const MIN_DURATION_MINUTES = 5;

export class PatternDetector {
  /**
   * Analyze a set of positions to detect all flight patterns
   */
  detectPatterns(positions: Position[]): PatternDetectionResult {
    if (positions.length < 6) {
      return { detected: false, patterns: [], primaryPattern: null };
    }

    // Sort positions by timestamp
    const sortedPositions = [...positions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Convert to Points with timestamps
    const points: Point[] = sortedPositions.map(p => ({
      lat: p.latitude,
      lon: p.longitude,
      timestamp: new Date(p.timestamp).getTime(),
      heading: p.track ?? undefined,
      altitude: p.altitude ?? undefined,
    }));

    const patterns: PatternDetection[] = [];
    const startTime = new Date(sortedPositions[0].timestamp);
    const endTime = new Date(sortedPositions[sortedPositions.length - 1].timestamp);
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / 60000;

    if (durationMinutes < MIN_DURATION_MINUTES) {
      return { detected: false, patterns: [], primaryPattern: null };
    }

    // Try to detect each pattern type
    const orbitResult = this.detectOrbit(points, startTime, endTime, durationMinutes);
    if (orbitResult) patterns.push(orbitResult);

    const racetrackResult = this.detectRacetrack(points, startTime, endTime, durationMinutes);
    if (racetrackResult) patterns.push(racetrackResult);

    const holdingResult = this.detectHolding(points, startTime, endTime, durationMinutes);
    if (holdingResult) patterns.push(holdingResult);

    const tankerResult = this.detectTankerTrack(points, sortedPositions, startTime, endTime, durationMinutes);
    if (tankerResult) patterns.push(tankerResult);

    // Sort by confidence and return
    patterns.sort((a, b) => b.confidence - a.confidence);

    return {
      detected: patterns.length > 0,
      patterns,
      primaryPattern: patterns[0] || null,
    };
  }

  /**
   * Detect circular orbit pattern
   */
  private detectOrbit(
    points: Point[],
    startTime: Date,
    endTime: Date,
    durationMinutes: number
  ): PatternDetection | null {
    if (points.length < MIN_POSITIONS_FOR_ORBIT) return null;

    try {
      const circleFit = fitCircle(points);

      // Check if this is a reasonable orbit
      // - Radius between 2 and 50 nm
      // - Confidence above 0.5
      // - Duration at least 5 minutes
      if (
        circleFit.confidence < 0.5 ||
        circleFit.radius < 2 ||
        circleFit.radius > 50 ||
        durationMinutes < 5
      ) {
        return null;
      }

      // Calculate angular velocity
      const angularResult = calculateAngularVelocity(points);

      // For a valid orbit, we expect consistent angular velocity
      if (angularResult.consistency < 0.3 || angularResult.direction === 'indeterminate') {
        return null;
      }

      // Calculate number of revolutions
      const circumference = 2 * Math.PI * circleFit.radius;
      const totalDistance = points.slice(1).reduce((sum, p, i) =>
        sum + haversineDistance(points[i], p), 0
      );
      const numRevolutions = totalDistance / circumference;

      // Need at least 0.5 revolution for a valid orbit
      if (numRevolutions < 0.5) {
        return null;
      }

      // Boost confidence for multiple revolutions
      const revolutionBoost = Math.min(1, numRevolutions / 2) * 0.2;
      const finalConfidence = Math.min(1, circleFit.confidence + revolutionBoost);

      return {
        pattern_type: 'orbit',
        confidence: finalConfidence,
        center_lat: circleFit.center.lat,
        center_lon: circleFit.center.lon,
        radius_nm: circleFit.radius,
        duration_minutes: durationMinutes,
        start_time: startTime,
        end_time: endTime,
        metadata: {
          fitted_radius_nm: circleFit.radius,
          angular_velocity_deg_per_min: angularResult.averageVelocity,
          direction: angularResult.direction,
          num_revolutions: Math.round(numRevolutions * 10) / 10,
          center_precision: circleFit.confidence,
          fit_error_nm: circleFit.error,
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Detect racetrack/oval pattern
   */
  private detectRacetrack(
    points: Point[],
    startTime: Date,
    endTime: Date,
    durationMinutes: number
  ): PatternDetection | null {
    if (points.length < MIN_POSITIONS_FOR_RACETRACK) return null;

    const racetrackParams = detectRacetrackParams(points);
    if (!racetrackParams || !racetrackParams.detected) {
      return null;
    }

    // Calculate center point
    const confinement = checkAreaConfinement(points);
    const centerLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const centerLon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;

    return {
      pattern_type: 'racetrack',
      confidence: racetrackParams.confidence,
      center_lat: centerLat,
      center_lon: centerLon,
      radius_nm: racetrackParams.legLength / 2,
      duration_minutes: durationMinutes,
      start_time: startTime,
      end_time: endTime,
      metadata: {
        leg_length_nm: racetrackParams.legLength,
        leg_width_nm: racetrackParams.legWidth,
        heading_leg1: Math.round(racetrackParams.heading1),
        heading_leg2: Math.round(racetrackParams.heading2),
        num_legs: racetrackParams.numLegs,
        bounding_box_area_nm2: confinement.area,
      },
    };
  }

  /**
   * Detect holding pattern (confined area, repeated patterns)
   */
  private detectHolding(
    points: Point[],
    startTime: Date,
    endTime: Date,
    durationMinutes: number
  ): PatternDetection | null {
    if (points.length < MIN_POSITIONS_FOR_HOLDING) return null;

    const confinement = checkAreaConfinement(points, 50); // Max 50 nm² for holding

    if (!confinement.confined) {
      return null;
    }

    // Check for repeated heading patterns
    const reversals = findHeadingReversals(points);
    if (reversals.length < 2) {
      return null;
    }

    // Calculate center
    const centerLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const centerLon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;

    // Confidence based on confinement and number of reversals
    const confinementScore = 1 - (confinement.area / 50);
    const reversalScore = Math.min(1, reversals.length / 4);
    const confidence = confinementScore * 0.6 + reversalScore * 0.4;

    if (confidence < 0.5) {
      return null;
    }

    // Determine inbound heading and turn direction
    const avgHeading = reversals.reduce((sum, r) => sum + r.headingBefore, 0) / reversals.length;
    const turnDeltas = reversals.map(r => r.headingAfter - r.headingBefore);
    const avgTurnDelta = turnDeltas.reduce((a, b) => a + b, 0) / turnDeltas.length;
    const turnDirection = avgTurnDelta > 0 ? 'right' : 'left';

    return {
      pattern_type: 'holding',
      confidence,
      center_lat: centerLat,
      center_lon: centerLon,
      radius_nm: Math.max(confinement.boundingBox.width, confinement.boundingBox.height) / 2,
      duration_minutes: durationMinutes,
      start_time: startTime,
      end_time: endTime,
      metadata: {
        hold_point: { lat: centerLat, lon: centerLon },
        inbound_heading: Math.round(avgHeading),
        turn_direction: turnDirection,
        num_turns: reversals.length,
        area_nm2: confinement.area,
        altitude_variation_ft: this.calculateAltitudeVariation(points),
      },
    };
  }

  /**
   * Detect tanker track pattern (long straight-ish tracks at consistent altitude)
   */
  private detectTankerTrack(
    points: Point[],
    positions: Position[],
    startTime: Date,
    endTime: Date,
    durationMinutes: number
  ): PatternDetection | null {
    if (points.length < 6) return null;

    // Tanker tracks are characterized by:
    // 1. Long, relatively straight tracks
    // 2. Consistent altitude (FL200-FL300 typically)
    // 3. Duration > 30 minutes

    if (durationMinutes < 20) return null;

    // Check altitude consistency
    const altitudes = positions
      .filter(p => p.altitude !== null)
      .map(p => p.altitude as number);

    if (altitudes.length < 5) return null;

    const avgAltitude = altitudes.reduce((a, b) => a + b, 0) / altitudes.length;
    const altitudeVariance = altitudes.reduce((sum, a) => sum + Math.pow(a - avgAltitude, 2), 0) / altitudes.length;
    const altitudeStdDev = Math.sqrt(altitudeVariance);

    // Tanker altitude should be between FL200 and FL350 (20000-35000 ft)
    if (avgAltitude < 18000 || avgAltitude > 40000) return null;

    // Altitude should be fairly consistent (std dev < 2000 ft)
    if (altitudeStdDev > 3000) return null;

    // Check track length
    const totalDistance = points.slice(1).reduce((sum, p, i) =>
      sum + haversineDistance(points[i], p), 0
    );

    // Tanker tracks are typically 40-150 nm
    if (totalDistance < 30 || totalDistance > 200) return null;

    // Check straightness - compare actual distance to direct distance
    const directDistance = haversineDistance(points[0], points[points.length - 1]);
    const straightness = directDistance / totalDistance;

    // But also check for reversals (tanker tracks often have turns at the ends)
    const reversals = findHeadingReversals(points);
    const hasEndReversals = reversals.length >= 1;

    // Calculate average heading
    const avgHeading = calculateBearing(points[0], points[points.length - 1]);

    // Calculate confidence
    let confidence = 0;
    confidence += altitudeStdDev < 1000 ? 0.3 : (altitudeStdDev < 2000 ? 0.2 : 0.1);
    confidence += totalDistance > 50 ? 0.2 : 0.1;
    confidence += durationMinutes > 30 ? 0.2 : 0.1;
    confidence += hasEndReversals ? 0.2 : (straightness > 0.7 ? 0.15 : 0);
    confidence += (avgAltitude >= 22000 && avgAltitude <= 30000) ? 0.1 : 0;

    if (confidence < 0.5) return null;

    const centerLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const centerLon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;

    return {
      pattern_type: 'tanker_track',
      confidence,
      center_lat: centerLat,
      center_lon: centerLon,
      radius_nm: totalDistance / 2,
      duration_minutes: durationMinutes,
      start_time: startTime,
      end_time: endTime,
      metadata: {
        track_heading: Math.round(avgHeading),
        track_length_nm: Math.round(totalDistance),
        altitude_fl: Math.round(avgAltitude / 100),
        refueling_altitude_band: [
          Math.round((avgAltitude - altitudeStdDev) / 100),
          Math.round((avgAltitude + altitudeStdDev) / 100),
        ],
        straightness,
        num_legs: hasEndReversals ? reversals.length + 1 : 1,
      },
    };
  }

  /**
   * Calculate altitude variation from points
   */
  private calculateAltitudeVariation(points: Point[]): number {
    const altitudes = points
      .filter(p => p.altitude !== undefined)
      .map(p => p.altitude as number);

    if (altitudes.length < 2) return 0;

    const min = Math.min(...altitudes);
    const max = Math.max(...altitudes);
    return max - min;
  }
}

// Export singleton instance
export const patternDetector = new PatternDetector();
