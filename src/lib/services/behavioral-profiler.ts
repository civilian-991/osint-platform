import { execute, queryOne, query } from '@/lib/db';
import { distanceNm } from '@/lib/utils/geo';
import { getAircraftPrior, applyPriorToProfile } from '@/lib/knowledge/aircraft-priors';
import type {
  BehavioralProfile,
  PatternDistribution,
  TypicalRegion,
  ProfileUpdateInput,
  PositionData,
} from '@/lib/types/ml';
import type { FlightPattern } from '@/lib/types/aircraft';

// Configuration
const CONFIG = {
  minSamplesForTrained: 10,
  defaultDecayFactor: 0.95,
  maxRegions: 10,
  regionMergeThresholdNm: 50, // Merge regions within this distance
  learningRate: 0.1,
};

export class BehavioralProfiler {
  /**
   * Get or create a behavioral profile for an aircraft
   * For new profiles, applies cold-start priors based on aircraft type
   */
  async getOrCreateProfile(aircraftId: string): Promise<BehavioralProfile | null> {
    try {
      // Try to get existing profile
      let profile = await queryOne<BehavioralProfile>(
        `SELECT * FROM aircraft_behavioral_profiles WHERE aircraft_id = $1`,
        [aircraftId]
      );

      if (!profile) {
        // Get aircraft type for cold-start priors
        const aircraft = await queryOne<{ type_code: string | null }>(
          `SELECT type_code FROM aircraft WHERE id = $1`,
          [aircraftId]
        );

        // Create new profile with cold-start priors if available
        const prior = aircraft?.type_code ? getAircraftPrior(aircraft.type_code) : null;

        if (prior) {
          // Apply prior knowledge to new profile
          const priorProfile = applyPriorToProfile(prior);

          profile = await queryOne<BehavioralProfile>(
            `INSERT INTO aircraft_behavioral_profiles (
              aircraft_id, typical_patterns, altitude_min, altitude_max, altitude_avg,
              speed_min, speed_max, speed_avg, sample_count
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
              aircraftId,
              JSON.stringify(priorProfile.typical_patterns),
              priorProfile.altitude_min,
              priorProfile.altitude_max,
              priorProfile.altitude_avg,
              priorProfile.speed_min,
              priorProfile.speed_max,
              priorProfile.speed_avg,
              3, // Treat priors as equivalent to 3 observations
            ]
          );
        } else {
          // Create blank profile
          profile = await queryOne<BehavioralProfile>(
            `INSERT INTO aircraft_behavioral_profiles (aircraft_id)
             VALUES ($1)
             RETURNING *`,
            [aircraftId]
          );
        }
      }

      return profile || null;
    } catch (error) {
      console.error('Error getting/creating profile:', error);
      return null;
    }
  }

  /**
   * Update behavioral profile with new flight data using exponential moving average
   */
  async updateProfile(input: ProfileUpdateInput): Promise<boolean> {
    try {
      const profile = await this.getOrCreateProfile(input.aircraft_id);
      if (!profile) {
        return false;
      }

      const positions = input.positions;
      if (positions.length < 2) {
        return false;
      }

      // Calculate statistics from positions
      const stats = this.calculatePositionStats(positions);

      // Update pattern distribution
      const newPatterns = this.updatePatternDistribution(
        profile.typical_patterns,
        input.pattern || 'straight',
        profile.sample_count,
        CONFIG.learningRate
      );

      // Update regions
      const newRegions = this.updateTypicalRegions(
        profile.typical_regions,
        stats.centerLat,
        stats.centerLon,
        stats.radiusNm,
        profile.sample_count
      );

      // Update altitude stats (exponential moving average)
      const newAltitude = this.updateStatistics(
        profile.altitude_min,
        profile.altitude_max,
        profile.altitude_avg,
        profile.altitude_stddev,
        stats.altitudes,
        CONFIG.defaultDecayFactor
      );

      // Update speed stats
      const newSpeed = this.updateStatistics(
        profile.speed_min,
        profile.speed_max,
        profile.speed_avg,
        profile.speed_stddev,
        stats.speeds,
        CONFIG.defaultDecayFactor
      );

      // Update activity schedule
      const newHourly = this.updateActivitySchedule(
        profile.hourly_activity,
        input.flight_time?.departure
          ? new Date(input.flight_time.departure).getUTCHours()
          : new Date().getUTCHours(),
        24
      );

      const newDaily = this.updateActivitySchedule(
        profile.daily_activity,
        input.flight_time?.departure
          ? new Date(input.flight_time.departure).getUTCDay()
          : new Date().getUTCDay(),
        7,
        ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      );

      const newSampleCount = profile.sample_count + 1;
      const isTrained = newSampleCount >= CONFIG.minSamplesForTrained;

      // Update the profile
      await execute(
        `UPDATE aircraft_behavioral_profiles SET
           typical_patterns = $1,
           typical_regions = $2,
           altitude_min = $3,
           altitude_max = $4,
           altitude_avg = $5,
           altitude_stddev = $6,
           speed_min = $7,
           speed_max = $8,
           speed_avg = $9,
           speed_stddev = $10,
           hourly_activity = $11,
           daily_activity = $12,
           sample_count = $13,
           is_trained = $14,
           last_flight_at = $15,
           updated_at = NOW()
         WHERE aircraft_id = $16`,
        [
          JSON.stringify(newPatterns),
          JSON.stringify(newRegions),
          newAltitude.min,
          newAltitude.max,
          newAltitude.avg,
          newAltitude.stddev,
          newSpeed.min,
          newSpeed.max,
          newSpeed.avg,
          newSpeed.stddev,
          JSON.stringify(newHourly),
          JSON.stringify(newDaily),
          newSampleCount,
          isTrained,
          input.flight_time?.departure || new Date().toISOString(),
          input.aircraft_id,
        ]
      );

      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  }

  /**
   * Calculate statistics from position data
   */
  private calculatePositionStats(positions: PositionData[]): {
    centerLat: number;
    centerLon: number;
    radiusNm: number;
    altitudes: number[];
    speeds: number[];
  } {
    const altitudes: number[] = [];
    const speeds: number[] = [];
    let totalLat = 0;
    let totalLon = 0;

    for (const pos of positions) {
      totalLat += pos.latitude;
      totalLon += pos.longitude;
      if (pos.altitude !== null) {
        altitudes.push(pos.altitude);
      }
      if (pos.ground_speed !== null) {
        speeds.push(pos.ground_speed);
      }
    }

    const centerLat = totalLat / positions.length;
    const centerLon = totalLon / positions.length;

    // Calculate max distance from center (radius)
    let maxDist = 0;
    for (const pos of positions) {
      const dist = distanceNm(centerLat, centerLon, pos.latitude, pos.longitude);
      maxDist = Math.max(maxDist, dist);
    }

    return {
      centerLat,
      centerLon,
      radiusNm: maxDist,
      altitudes,
      speeds,
    };
  }

  /**
   * Update pattern distribution using exponential moving average
   */
  private updatePatternDistribution(
    current: PatternDistribution,
    newPattern: string,
    sampleCount: number,
    learningRate: number
  ): PatternDistribution {
    const patterns = { ...current };
    const validPattern = (
      ['orbit', 'racetrack', 'holding', 'tanker_track', 'straight'].includes(newPattern)
        ? newPattern
        : 'straight'
    ) as keyof PatternDistribution;

    // Apply learning rate (higher impact for fewer samples)
    const effectiveLR = sampleCount < 5 ? 0.3 : learningRate;

    for (const key of Object.keys(patterns) as Array<keyof PatternDistribution>) {
      if (key === validPattern) {
        patterns[key] = patterns[key] * (1 - effectiveLR) + effectiveLR;
      } else {
        patterns[key] = patterns[key] * (1 - effectiveLR);
      }
    }

    // Normalize to sum to 1
    const total = Object.values(patterns).reduce((a, b) => a + b, 0);
    if (total > 0) {
      for (const key of Object.keys(patterns) as Array<keyof PatternDistribution>) {
        patterns[key] = Math.round((patterns[key] / total) * 100) / 100;
      }
    }

    return patterns;
  }

  /**
   * Update typical regions, merging nearby regions
   */
  private updateTypicalRegions(
    current: TypicalRegion[],
    newLat: number,
    newLon: number,
    radiusNm: number,
    sampleCount: number
  ): TypicalRegion[] {
    const regions = [...current];

    // Find if there's a nearby region to merge with
    let mergedIndex = -1;
    for (let i = 0; i < regions.length; i++) {
      const dist = distanceNm(regions[i].center_lat, regions[i].center_lon, newLat, newLon);
      if (dist < CONFIG.regionMergeThresholdNm) {
        mergedIndex = i;
        break;
      }
    }

    if (mergedIndex >= 0) {
      // Update existing region with weighted average
      const region = regions[mergedIndex];
      const weight = region.frequency / (region.frequency + 1);
      region.center_lat = region.center_lat * weight + newLat * (1 - weight);
      region.center_lon = region.center_lon * weight + newLon * (1 - weight);
      region.radius_nm = Math.max(region.radius_nm, radiusNm);
      region.frequency += 1;
    } else if (regions.length < CONFIG.maxRegions) {
      // Add new region
      regions.push({
        center_lat: newLat,
        center_lon: newLon,
        radius_nm: radiusNm,
        frequency: 1,
      });
    } else {
      // Replace least frequent region
      const minIndex = regions.reduce(
        (minI, r, i, arr) => (r.frequency < arr[minI].frequency ? i : minI),
        0
      );
      regions[minIndex] = {
        center_lat: newLat,
        center_lon: newLon,
        radius_nm: radiusNm,
        frequency: 1,
      };
    }

    // Normalize frequencies to sum to 1
    const totalFreq = regions.reduce((sum, r) => sum + r.frequency, 0);
    if (totalFreq > 0) {
      for (const region of regions) {
        region.frequency = Math.round((region.frequency / totalFreq) * 100) / 100;
      }
    }

    return regions;
  }

  /**
   * Update statistics using exponential moving average
   */
  private updateStatistics(
    currentMin: number | null,
    currentMax: number | null,
    currentAvg: number | null,
    currentStddev: number | null,
    newValues: number[],
    decayFactor: number
  ): { min: number | null; max: number | null; avg: number | null; stddev: number | null } {
    if (newValues.length === 0) {
      return {
        min: currentMin,
        max: currentMax,
        avg: currentAvg,
        stddev: currentStddev,
      };
    }

    const newMin = Math.min(...newValues);
    const newMax = Math.max(...newValues);
    const newAvg = newValues.reduce((a, b) => a + b, 0) / newValues.length;
    const newStddev = Math.sqrt(
      newValues.reduce((sum, v) => sum + Math.pow(v - newAvg, 2), 0) / newValues.length
    );

    return {
      min: currentMin === null ? newMin : Math.min(currentMin, newMin),
      max: currentMax === null ? newMax : Math.max(currentMax, newMax),
      avg: currentAvg === null ? newAvg : currentAvg * decayFactor + newAvg * (1 - decayFactor),
      stddev:
        currentStddev === null
          ? newStddev
          : currentStddev * decayFactor + newStddev * (1 - decayFactor),
    };
  }

  /**
   * Update activity schedule distribution
   */
  private updateActivitySchedule(
    current: Record<string, number>,
    newIndex: number,
    totalSlots: number,
    labels?: string[]
  ): Record<string, number> {
    const schedule = { ...current };
    const key = labels ? labels[newIndex] : String(newIndex);

    // Initialize all slots if empty
    for (let i = 0; i < totalSlots; i++) {
      const slotKey = labels ? labels[i] : String(i);
      if (!(slotKey in schedule)) {
        schedule[slotKey] = 1 / totalSlots; // Equal initial distribution
      }
    }

    // Apply learning rate update
    const lr = CONFIG.learningRate;
    for (const k of Object.keys(schedule)) {
      if (k === key) {
        schedule[k] = schedule[k] * (1 - lr) + lr;
      } else {
        schedule[k] = schedule[k] * (1 - lr);
      }
    }

    // Normalize
    const total = Object.values(schedule).reduce((a, b) => a + b, 0);
    if (total > 0) {
      for (const k of Object.keys(schedule)) {
        schedule[k] = Math.round((schedule[k] / total) * 1000) / 1000;
      }
    }

    return schedule;
  }

  /**
   * Check if current behavior deviates from profile
   */
  async checkDeviation(
    aircraftId: string,
    positions: PositionData[],
    pattern?: string
  ): Promise<{
    hasDeviation: boolean;
    deviations: Array<{
      type: string;
      severity: number;
      detected: unknown;
      expected: unknown;
    }>;
  }> {
    const deviations: Array<{
      type: string;
      severity: number;
      detected: unknown;
      expected: unknown;
    }> = [];

    const profile = await this.getOrCreateProfile(aircraftId);
    if (!profile || !profile.is_trained) {
      return { hasDeviation: false, deviations: [] };
    }

    const stats = this.calculatePositionStats(positions);

    // Check altitude deviation
    if (profile.altitude_avg !== null && profile.altitude_stddev !== null) {
      const avgAlt = stats.altitudes.length > 0
        ? stats.altitudes.reduce((a, b) => a + b, 0) / stats.altitudes.length
        : null;

      if (avgAlt !== null) {
        const zScore = Math.abs(avgAlt - profile.altitude_avg) / (profile.altitude_stddev || 1);
        if (zScore > 2) {
          deviations.push({
            type: 'altitude',
            severity: Math.min(zScore / 5, 1),
            detected: { avgAltitude: avgAlt },
            expected: {
              avg: profile.altitude_avg,
              stddev: profile.altitude_stddev,
              range: [profile.altitude_min, profile.altitude_max],
            },
          });
        }
      }
    }

    // Check speed deviation
    if (profile.speed_avg !== null && profile.speed_stddev !== null) {
      const avgSpeed = stats.speeds.length > 0
        ? stats.speeds.reduce((a, b) => a + b, 0) / stats.speeds.length
        : null;

      if (avgSpeed !== null) {
        const zScore = Math.abs(avgSpeed - profile.speed_avg) / (profile.speed_stddev || 1);
        if (zScore > 2) {
          deviations.push({
            type: 'speed',
            severity: Math.min(zScore / 5, 1),
            detected: { avgSpeed },
            expected: {
              avg: profile.speed_avg,
              stddev: profile.speed_stddev,
              range: [profile.speed_min, profile.speed_max],
            },
          });
        }
      }
    }

    // Check pattern deviation
    if (pattern && pattern !== 'straight') {
      const patternKey = pattern as keyof PatternDistribution;
      const expectedFreq = profile.typical_patterns[patternKey] || 0;

      // If this pattern is rarely seen (<10% of the time), it's unusual
      if (expectedFreq < 0.1) {
        deviations.push({
          type: 'pattern',
          severity: 1 - expectedFreq,
          detected: { pattern },
          expected: { typical_patterns: profile.typical_patterns },
        });
      }
    }

    // Check region deviation
    if (profile.typical_regions.length > 0) {
      let inKnownRegion = false;
      for (const region of profile.typical_regions) {
        const dist = distanceNm(
          region.center_lat,
          region.center_lon,
          stats.centerLat,
          stats.centerLon
        );
        if (dist < region.radius_nm + 20) {
          // 20nm buffer
          inKnownRegion = true;
          break;
        }
      }

      if (!inKnownRegion) {
        deviations.push({
          type: 'route',
          severity: 0.7,
          detected: { center: [stats.centerLat, stats.centerLon] },
          expected: { typical_regions: profile.typical_regions },
        });
      }
    }

    // Check timing deviation
    const currentHour = new Date().getUTCHours();
    const hourlyActivity = profile.hourly_activity[String(currentHour)] || 0;
    if (hourlyActivity < 0.02) {
      // Very unusual time
      deviations.push({
        type: 'timing',
        severity: 0.5,
        detected: { hour: currentHour },
        expected: { hourly_activity: profile.hourly_activity },
      });
    }

    return {
      hasDeviation: deviations.length > 0,
      deviations,
    };
  }

  /**
   * Get profile statistics
   */
  async getStats(): Promise<{
    total_profiles: number;
    trained_profiles: number;
    avg_sample_count: number;
  }> {
    try {
      const result = await queryOne<{
        total_profiles: string;
        trained_profiles: string;
        avg_sample_count: string;
      }>(
        `SELECT
           COUNT(*) as total_profiles,
           COUNT(*) FILTER (WHERE is_trained = true) as trained_profiles,
           AVG(sample_count) as avg_sample_count
         FROM aircraft_behavioral_profiles`
      );

      return {
        total_profiles: parseInt(result?.total_profiles || '0', 10),
        trained_profiles: parseInt(result?.trained_profiles || '0', 10),
        avg_sample_count: parseFloat(result?.avg_sample_count || '0'),
      };
    } catch {
      return { total_profiles: 0, trained_profiles: 0, avg_sample_count: 0 };
    }
  }

  /**
   * Batch update profiles from recent flights
   */
  async batchUpdateFromFlights(hoursSince: number = 24): Promise<number> {
    try {
      // Get recent flights with their positions
      const flights = await query<{
        aircraft_id: string;
        flight_id: string;
        pattern_detected: string | null;
        departure_time: string | null;
      }>(
        `SELECT f.aircraft_id, f.id as flight_id, f.pattern_detected, f.departure_time
         FROM flights f
         WHERE f.departure_time >= NOW() - INTERVAL '${hoursSince} hours'
         AND f.aircraft_id IS NOT NULL`,
        []
      );

      let updatedCount = 0;

      for (const flight of flights) {
        // Get positions for this flight
        const positions = await query<{
          latitude: number;
          longitude: number;
          altitude: number | null;
          ground_speed: number | null;
          track: number | null;
          timestamp: string;
        }>(
          `SELECT latitude, longitude, altitude, ground_speed, track, timestamp
           FROM positions
           WHERE aircraft_id = $1
           AND timestamp >= $2
           AND timestamp <= COALESCE($3, NOW())
           ORDER BY timestamp`,
          [
            flight.aircraft_id,
            flight.departure_time || new Date(Date.now() - hoursSince * 60 * 60 * 1000).toISOString(),
            null,
          ]
        );

        if (positions.length >= 5) {
          const success = await this.updateProfile({
            aircraft_id: flight.aircraft_id,
            pattern: flight.pattern_detected || undefined,
            positions: positions.map((p) => ({
              ...p,
              altitude: p.altitude,
              ground_speed: p.ground_speed,
              track: p.track,
            })),
            flight_time: { departure: flight.departure_time || new Date().toISOString() },
          });

          if (success) {
            updatedCount++;
          }
        }
      }

      return updatedCount;
    } catch (error) {
      console.error('Error in batch profile update:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const behavioralProfiler = new BehavioralProfiler();
