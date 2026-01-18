import { execute, queryOne, query } from '@/lib/db';
import { distanceNm, bearing } from '@/lib/utils/geo';
import { geminiClient } from './gemini-client';
import {
  detectFormationPattern,
  scoreFormationMatch,
  getFormationPattern,
  FORMATION_PATTERNS,
  type FormationPattern,
} from '@/lib/knowledge/formation-patterns';
import type {
  FormationDetection,
  FormationType,
  FormationDetectionMethod,
  FormationCandidate,
  PositionData,
} from '@/lib/types/ml';
import type { MilitaryCategory } from '@/lib/types/aircraft';

// Configuration for formation detection
const CONFIG = {
  tankerReceiver: {
    maxDistanceNm: 5, // Max distance between tanker and receiver
    altitudeBandLow: 20000, // FL200
    altitudeBandHigh: 35000, // FL350
    maxHeadingDiff: 30, // Max heading difference in degrees
  },
  escort: {
    maxDistanceNm: 10, // Max distance between escort and escorted
    maxHeadingDiff: 45,
  },
  strikePackage: {
    maxSpreadNm: 20, // Max spread of the package
    minAircraft: 3, // Minimum aircraft for strike package
    maxHeadingDiff: 30,
  },
  cap: {
    maxDistanceNm: 30, // CAP orbit radius
    patterns: ['orbit', 'racetrack'],
  },
  // General
  stalePositionMinutes: 5, // Positions older than this are considered stale
  minConfidence: 0.6, // Minimum confidence to report formation
};

// Aircraft types by category for formation detection
const TANKER_TYPES = ['KC135', 'KC10', 'KC46', 'A332', 'A339', 'KC30', 'A400'];
const HIGH_VALUE_TYPES = ['E3TF', 'E3CF', 'E767', 'E737', 'E7WW', 'GLEX', 'RQ4', 'C17', 'C5M'];
const FIGHTER_TYPES = ['F16', 'F15', 'F18', 'F22', 'F35', 'FA18', 'TYP', 'EF2K', 'RFAL'];

export class FormationDetector {
  /**
   * Detect all types of formations from current positions
   */
  async detectFormations(): Promise<FormationDetection[]> {
    const formations: FormationDetection[] = [];

    try {
      // Get current positions with aircraft info
      const positions = await query<{
        aircraft_id: string;
        icao_hex: string;
        latitude: number;
        longitude: number;
        altitude: number | null;
        ground_speed: number | null;
        track: number | null;
        timestamp: string;
        type_code: string | null;
        military_category: MilitaryCategory | null;
      }>(
        `SELECT
           pl.aircraft_id,
           pl.icao_hex,
           pl.latitude,
           pl.longitude,
           pl.altitude,
           pl.ground_speed,
           pl.track,
           pl.timestamp,
           a.type_code,
           a.military_category
         FROM positions_latest pl
         JOIN aircraft a ON a.id = pl.aircraft_id
         WHERE pl.timestamp >= NOW() - INTERVAL '${CONFIG.stalePositionMinutes} minutes'
         AND a.is_military = TRUE`
      );

      if (positions.length < 2) {
        return [];
      }

      // Build position lookup maps
      const positionsByAircraft = new Map<
        string,
        (typeof positions)[0]
      >();
      for (const pos of positions) {
        positionsByAircraft.set(pos.aircraft_id, pos);
      }

      // Detect tanker-receiver formations
      const tankerReceivers = await this.detectTankerReceiverFormations(positions);
      formations.push(...tankerReceivers);

      // Detect escort formations
      const escorts = await this.detectEscortFormations(positions);
      formations.push(...escorts);

      // Detect strike packages
      const strikePackages = await this.detectStrikePackages(positions);
      formations.push(...strikePackages);

      // Detect CAP formations
      const caps = await this.detectCAPFormations(positions);
      formations.push(...caps);

      return formations;
    } catch (error) {
      console.error('Error detecting formations:', error);
      return [];
    }
  }

  /**
   * Detect tanker-receiver refueling formations
   */
  private async detectTankerReceiverFormations(
    positions: Array<{
      aircraft_id: string;
      icao_hex: string;
      latitude: number;
      longitude: number;
      altitude: number | null;
      track: number | null;
      type_code: string | null;
      military_category: MilitaryCategory | null;
    }>
  ): Promise<FormationDetection[]> {
    const formations: FormationDetection[] = [];

    // Find tankers
    const tankers = positions.filter(
      (p) =>
        p.military_category === 'tanker' ||
        (p.type_code && TANKER_TYPES.includes(p.type_code))
    );

    for (const tanker of tankers) {
      // Skip if tanker not in refueling altitude band
      if (
        tanker.altitude === null ||
        tanker.altitude < CONFIG.tankerReceiver.altitudeBandLow ||
        tanker.altitude > CONFIG.tankerReceiver.altitudeBandHigh
      ) {
        continue;
      }

      // Find nearby aircraft that could be receivers
      const nearbyReceivers = positions.filter((p) => {
        if (p.aircraft_id === tanker.aircraft_id) return false;
        if (p.military_category === 'tanker') return false;

        const dist = distanceNm(
          tanker.latitude,
          tanker.longitude,
          p.latitude,
          p.longitude
        );

        if (dist > CONFIG.tankerReceiver.maxDistanceNm) return false;

        // Check altitude band
        if (
          p.altitude === null ||
          p.altitude < CONFIG.tankerReceiver.altitudeBandLow ||
          p.altitude > CONFIG.tankerReceiver.altitudeBandHigh
        ) {
          return false;
        }

        // Check heading alignment
        if (tanker.track !== null && p.track !== null) {
          let headingDiff = Math.abs(tanker.track - p.track);
          if (headingDiff > 180) headingDiff = 360 - headingDiff;
          if (headingDiff > CONFIG.tankerReceiver.maxHeadingDiff) return false;
        }

        return true;
      });

      if (nearbyReceivers.length > 0) {
        // Calculate formation geometry
        const allAircraft = [tanker, ...nearbyReceivers];
        const geometry = this.calculateFormationGeometry(allAircraft);

        const confidence = this.calculateTankerReceiverConfidence(
          tanker,
          nearbyReceivers
        );

        if (confidence >= CONFIG.minConfidence) {
          const formation = await this.createOrUpdateFormation({
            formationType: 'tanker_receiver',
            leadAircraftId: tanker.aircraft_id,
            aircraftIds: allAircraft.map((a) => a.aircraft_id),
            ...geometry,
            confidence,
            detectionMethod: 'spatial_clustering',
          });

          if (formation) {
            formations.push(formation);
          }
        }
      }
    }

    return formations;
  }

  /**
   * Detect escort formations (fighters protecting high-value assets)
   */
  private async detectEscortFormations(
    positions: Array<{
      aircraft_id: string;
      icao_hex: string;
      latitude: number;
      longitude: number;
      altitude: number | null;
      track: number | null;
      type_code: string | null;
      military_category: MilitaryCategory | null;
    }>
  ): Promise<FormationDetection[]> {
    const formations: FormationDetection[] = [];

    // Find high-value assets (AWACS, ISR, large transports)
    const highValueAssets = positions.filter(
      (p) =>
        p.military_category === 'awacs' ||
        p.military_category === 'isr' ||
        (p.type_code && HIGH_VALUE_TYPES.includes(p.type_code))
    );

    for (const hva of highValueAssets) {
      // Find nearby fighters
      const escorts = positions.filter((p) => {
        if (p.aircraft_id === hva.aircraft_id) return false;
        if (
          p.military_category !== 'fighter' &&
          !(p.type_code && FIGHTER_TYPES.includes(p.type_code))
        ) {
          return false;
        }

        const dist = distanceNm(hva.latitude, hva.longitude, p.latitude, p.longitude);
        if (dist > CONFIG.escort.maxDistanceNm) return false;

        // Check heading alignment
        if (hva.track !== null && p.track !== null) {
          let headingDiff = Math.abs(hva.track - p.track);
          if (headingDiff > 180) headingDiff = 360 - headingDiff;
          if (headingDiff > CONFIG.escort.maxHeadingDiff) return false;
        }

        return true;
      });

      if (escorts.length > 0) {
        const allAircraft = [hva, ...escorts];
        const geometry = this.calculateFormationGeometry(allAircraft);
        const confidence = 0.5 + escorts.length * 0.15; // More escorts = higher confidence

        if (confidence >= CONFIG.minConfidence) {
          const formation = await this.createOrUpdateFormation({
            formationType: 'escort',
            leadAircraftId: hva.aircraft_id,
            aircraftIds: allAircraft.map((a) => a.aircraft_id),
            ...geometry,
            confidence: Math.min(confidence, 0.95),
            detectionMethod: 'spatial_clustering',
          });

          if (formation) {
            formations.push(formation);
          }
        }
      }
    }

    return formations;
  }

  /**
   * Detect strike packages (multiple fighters + support aircraft)
   */
  private async detectStrikePackages(
    positions: Array<{
      aircraft_id: string;
      icao_hex: string;
      latitude: number;
      longitude: number;
      altitude: number | null;
      track: number | null;
      type_code: string | null;
      military_category: MilitaryCategory | null;
    }>
  ): Promise<FormationDetection[]> {
    const formations: FormationDetection[] = [];

    // Find fighters
    const fighters = positions.filter(
      (p) =>
        p.military_category === 'fighter' ||
        (p.type_code && FIGHTER_TYPES.includes(p.type_code))
    );

    // Cluster fighters by proximity
    const processed = new Set<string>();

    for (const fighter of fighters) {
      if (processed.has(fighter.aircraft_id)) continue;

      // Find nearby fighters with similar heading
      const cluster = [fighter];
      processed.add(fighter.aircraft_id);

      for (const other of fighters) {
        if (processed.has(other.aircraft_id)) continue;

        const dist = distanceNm(
          fighter.latitude,
          fighter.longitude,
          other.latitude,
          other.longitude
        );

        if (dist > CONFIG.strikePackage.maxSpreadNm) continue;

        // Check heading alignment
        if (fighter.track !== null && other.track !== null) {
          let headingDiff = Math.abs(fighter.track - other.track);
          if (headingDiff > 180) headingDiff = 360 - headingDiff;
          if (headingDiff > CONFIG.strikePackage.maxHeadingDiff) continue;
        }

        cluster.push(other);
        processed.add(other.aircraft_id);
      }

      // Check if cluster is large enough
      if (cluster.length >= CONFIG.strikePackage.minAircraft) {
        const geometry = this.calculateFormationGeometry(cluster);
        const confidence = 0.5 + (cluster.length - 3) * 0.1; // More aircraft = higher confidence

        const formation = await this.createOrUpdateFormation({
          formationType: 'strike_package',
          leadAircraftId: cluster[0].aircraft_id,
          aircraftIds: cluster.map((a) => a.aircraft_id),
          ...geometry,
          confidence: Math.min(confidence, 0.9),
          detectionMethod: 'spatial_clustering',
        });

        if (formation) {
          formations.push(formation);
        }
      }
    }

    return formations;
  }

  /**
   * Detect Combat Air Patrol formations
   */
  private async detectCAPFormations(
    positions: Array<{
      aircraft_id: string;
      icao_hex: string;
      latitude: number;
      longitude: number;
      altitude: number | null;
      track: number | null;
      type_code: string | null;
      military_category: MilitaryCategory | null;
    }>
  ): Promise<FormationDetection[]> {
    const formations: FormationDetection[] = [];

    // Find fighters with detected patterns
    const patternedFighters = await query<{
      aircraft_id: string;
      pattern_detected: string;
    }>(
      `SELECT DISTINCT f.aircraft_id, f.pattern_detected
       FROM flights f
       JOIN aircraft a ON a.id = f.aircraft_id
       WHERE f.departure_time >= NOW() - INTERVAL '2 hours'
       AND f.pattern_detected IN ('orbit', 'racetrack')
       AND (a.military_category = 'fighter' OR a.type_code IN (${FIGHTER_TYPES.map((t) => `'${t}'`).join(',')}))`
    );

    for (const pf of patternedFighters) {
      const fighterPos = positions.find((p) => p.aircraft_id === pf.aircraft_id);
      if (!fighterPos) continue;

      // Find other fighters nearby doing similar patterns
      const capGroup = [fighterPos];

      for (const other of patternedFighters) {
        if (other.aircraft_id === pf.aircraft_id) continue;

        const otherPos = positions.find((p) => p.aircraft_id === other.aircraft_id);
        if (!otherPos) continue;

        const dist = distanceNm(
          fighterPos.latitude,
          fighterPos.longitude,
          otherPos.latitude,
          otherPos.longitude
        );

        if (dist <= CONFIG.cap.maxDistanceNm) {
          capGroup.push(otherPos);
        }
      }

      if (capGroup.length >= 2) {
        const geometry = this.calculateFormationGeometry(capGroup);
        const confidence = 0.6 + (capGroup.length - 2) * 0.1;

        const formation = await this.createOrUpdateFormation({
          formationType: 'cap',
          leadAircraftId: capGroup[0].aircraft_id,
          aircraftIds: capGroup.map((a) => a.aircraft_id),
          ...geometry,
          confidence: Math.min(confidence, 0.85),
          detectionMethod: 'temporal_correlation',
        });

        if (formation) {
          formations.push(formation);
        }
      }
    }

    return formations;
  }

  /**
   * Calculate formation geometry from aircraft positions
   */
  private calculateFormationGeometry(
    aircraft: Array<{
      latitude: number;
      longitude: number;
      altitude: number | null;
      track: number | null;
    }>
  ): {
    centerLat: number;
    centerLon: number;
    spreadNm: number;
    heading: number | null;
    altitudeBandLow: number | null;
    altitudeBandHigh: number | null;
  } {
    const centerLat =
      aircraft.reduce((sum, a) => sum + a.latitude, 0) / aircraft.length;
    const centerLon =
      aircraft.reduce((sum, a) => sum + a.longitude, 0) / aircraft.length;

    let maxDist = 0;
    for (const a of aircraft) {
      const dist = distanceNm(centerLat, centerLon, a.latitude, a.longitude);
      maxDist = Math.max(maxDist, dist);
    }

    const headings = aircraft
      .map((a) => a.track)
      .filter((t): t is number => t !== null);
    const avgHeading =
      headings.length > 0
        ? headings.reduce((a, b) => a + b, 0) / headings.length
        : null;

    const altitudes = aircraft
      .map((a) => a.altitude)
      .filter((alt): alt is number => alt !== null);

    return {
      centerLat,
      centerLon,
      spreadNm: maxDist,
      heading: avgHeading,
      altitudeBandLow: altitudes.length > 0 ? Math.min(...altitudes) : null,
      altitudeBandHigh: altitudes.length > 0 ? Math.max(...altitudes) : null,
    };
  }

  /**
   * Calculate confidence for tanker-receiver formation
   */
  private calculateTankerReceiverConfidence(
    tanker: { altitude: number | null; track: number | null },
    receivers: Array<{ altitude: number | null; track: number | null }>
  ): number {
    let confidence = 0.5;

    // Altitude band alignment
    if (tanker.altitude !== null) {
      const inBand = receivers.filter(
        (r) =>
          r.altitude !== null &&
          Math.abs(r.altitude - tanker.altitude!) < 2000
      );
      confidence += (inBand.length / receivers.length) * 0.2;
    }

    // Heading alignment
    if (tanker.track !== null) {
      const aligned = receivers.filter((r) => {
        if (r.track === null) return false;
        let diff = Math.abs(r.track - tanker.track!);
        if (diff > 180) diff = 360 - diff;
        return diff < 15;
      });
      confidence += (aligned.length / receivers.length) * 0.3;
    }

    return Math.min(confidence, 0.95);
  }

  /**
   * Create or update a formation detection record
   */
  private async createOrUpdateFormation(params: {
    formationType: FormationType;
    leadAircraftId: string;
    aircraftIds: string[];
    centerLat: number;
    centerLon: number;
    spreadNm: number;
    heading: number | null;
    altitudeBandLow: number | null;
    altitudeBandHigh: number | null;
    confidence: number;
    detectionMethod: FormationDetectionMethod;
    analysis?: string;
  }): Promise<FormationDetection | null> {
    try {
      // Check for existing active formation with similar aircraft
      const existing = await queryOne<FormationDetection>(
        `SELECT * FROM formation_detections
         WHERE formation_type = $1
         AND is_active = TRUE
         AND aircraft_ids && $2
         ORDER BY first_detected_at DESC
         LIMIT 1`,
        [params.formationType, params.aircraftIds]
      );

      if (existing) {
        // Update existing formation
        const updated = await queryOne<FormationDetection>(
          `UPDATE formation_detections SET
             aircraft_ids = $1,
             center_lat = $2,
             center_lon = $3,
             spread_nm = $4,
             heading = $5,
             altitude_band_low = $6,
             altitude_band_high = $7,
             confidence = $8,
             last_seen_at = NOW(),
             updated_at = NOW()
           WHERE id = $9
           RETURNING *`,
          [
            params.aircraftIds,
            params.centerLat,
            params.centerLon,
            params.spreadNm,
            params.heading,
            params.altitudeBandLow,
            params.altitudeBandHigh,
            params.confidence,
            existing.id,
          ]
        );
        return updated;
      } else {
        // Create new formation
        const created = await queryOne<FormationDetection>(
          `INSERT INTO formation_detections
           (formation_type, confidence, lead_aircraft_id, aircraft_ids,
            center_lat, center_lon, spread_nm, heading,
            altitude_band_low, altitude_band_high,
            detection_method, analysis, first_detected_at, last_seen_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
           RETURNING *`,
          [
            params.formationType,
            params.confidence,
            params.leadAircraftId,
            params.aircraftIds,
            params.centerLat,
            params.centerLon,
            params.spreadNm,
            params.heading,
            params.altitudeBandLow,
            params.altitudeBandHigh,
            params.detectionMethod,
            params.analysis || null,
          ]
        );
        return created;
      }
    } catch (error) {
      console.error('Error creating/updating formation:', error);
      return null;
    }
  }

  /**
   * Mark stale formations as inactive
   */
  async deactivateStaleFormations(staleMinutes: number = 10): Promise<number> {
    try {
      const result = await queryOne<{ count: string }>(
        `WITH updated AS (
           UPDATE formation_detections
           SET is_active = FALSE, updated_at = NOW()
           WHERE is_active = TRUE
           AND last_seen_at < NOW() - INTERVAL '${staleMinutes} minutes'
           RETURNING id
         )
         SELECT COUNT(*) as count FROM updated`
      );
      return parseInt(result?.count || '0', 10);
    } catch (error) {
      console.error('Error deactivating stale formations:', error);
      return 0;
    }
  }

  /**
   * Get active formations
   */
  async getActiveFormations(
    formationType?: FormationType
  ): Promise<FormationDetection[]> {
    try {
      let whereClause = 'WHERE is_active = TRUE';
      const params: string[] = [];

      if (formationType) {
        whereClause += ' AND formation_type = $1';
        params.push(formationType);
      }

      return await query<FormationDetection>(
        `SELECT * FROM formation_detections
         ${whereClause}
         ORDER BY confidence DESC, first_detected_at DESC`,
        params
      );
    } catch (error) {
      console.error('Error fetching active formations:', error);
      return [];
    }
  }

  /**
   * Get formations involving a specific aircraft
   */
  async getFormationsForAircraft(aircraftId: string): Promise<FormationDetection[]> {
    try {
      return await query<FormationDetection>(
        `SELECT * FROM formation_detections
         WHERE $1 = ANY(aircraft_ids)
         AND is_active = TRUE
         ORDER BY confidence DESC`,
        [aircraftId]
      );
    } catch (error) {
      console.error('Error fetching formations for aircraft:', error);
      return [];
    }
  }

  /**
   * Enhanced formation detection using pattern library
   * Analyzes aircraft group against known formation patterns
   */
  async detectWithPatternLibrary(
    aircraft: Array<{
      aircraft_id: string;
      latitude: number;
      longitude: number;
      altitude: number | null;
      ground_speed: number | null;
      track: number | null;
      type_code: string | null;
    }>
  ): Promise<{
    pattern: FormationPattern | null;
    score: number;
    factors: Record<string, number>;
    threatLevel: string;
    tacticalSignificance: string;
  } | null> {
    if (aircraft.length < 2) {
      return null;
    }

    // Calculate formation metrics
    const geometry = this.calculateFormationGeometry(aircraft);

    // Calculate average spacing
    let totalDistance = 0;
    let pairCount = 0;
    for (let i = 0; i < aircraft.length; i++) {
      for (let j = i + 1; j < aircraft.length; j++) {
        totalDistance += distanceNm(
          aircraft[i].latitude,
          aircraft[i].longitude,
          aircraft[j].latitude,
          aircraft[j].longitude
        );
        pairCount++;
      }
    }
    const avgSpacingNm = pairCount > 0 ? totalDistance / pairCount : 0;

    // Calculate speed differences
    const speeds = aircraft
      .map((a) => a.ground_speed)
      .filter((s): s is number => s !== null);
    const maxSpeedDiff = speeds.length > 1
      ? Math.max(...speeds) - Math.min(...speeds)
      : 0;

    // Calculate heading variance
    const headings = aircraft
      .map((a) => a.track)
      .filter((t): t is number => t !== null);
    let headingVariance = 0;
    if (headings.length > 1) {
      const avgHeading = headings.reduce((a, b) => a + b, 0) / headings.length;
      headingVariance = Math.sqrt(
        headings.reduce((sum, h) => {
          let diff = Math.abs(h - avgHeading);
          if (diff > 180) diff = 360 - diff;
          return sum + diff * diff;
        }, 0) / headings.length
      );
    }

    // Get aircraft types
    const aircraftTypes = aircraft
      .map((a) => a.type_code)
      .filter((t): t is string => t !== null);

    // Use pattern library detection
    const result = detectFormationPattern({
      aircraftCount: aircraft.length,
      avgSpacingNm,
      maxAltitudeDiff: (geometry.altitudeBandHigh || 0) - (geometry.altitudeBandLow || 0),
      maxSpeedDiff,
      headingVariance,
      aircraftTypes,
    });

    if (!result.pattern) {
      return null;
    }

    return {
      pattern: result.pattern,
      score: result.score,
      factors: result.factors,
      threatLevel: result.pattern.threatLevel,
      tacticalSignificance: result.pattern.tacticalSignificance,
    };
  }

  /**
   * Get formation statistics
   */
  async getStats(): Promise<{
    active_formations: number;
    by_type: Record<string, number>;
    avg_duration_minutes: number;
  }> {
    try {
      const activeResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM formation_detections WHERE is_active = TRUE`
      );

      const byTypeResults = await query<{ formation_type: string; count: string }>(
        `SELECT formation_type, COUNT(*) as count
         FROM formation_detections
         WHERE is_active = TRUE
         GROUP BY formation_type`
      );

      const avgDuration = await queryOne<{ avg_duration: string }>(
        `SELECT AVG(duration_minutes) as avg_duration
         FROM formation_detections
         WHERE is_active = FALSE AND duration_minutes IS NOT NULL`
      );

      const byType: Record<string, number> = {};
      for (const row of byTypeResults) {
        byType[row.formation_type] = parseInt(row.count, 10);
      }

      return {
        active_formations: parseInt(activeResult?.count || '0', 10),
        by_type: byType,
        avg_duration_minutes: parseFloat(avgDuration?.avg_duration || '0'),
      };
    } catch {
      return { active_formations: 0, by_type: {}, avg_duration_minutes: 0 };
    }
  }
}

// Export singleton instance
export const formationDetector = new FormationDetector();
