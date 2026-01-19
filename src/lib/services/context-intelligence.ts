import { execute, queryOne, query } from '@/lib/db';
import { distanceNm, bearing } from '@/lib/utils/geo';
import type {
  PositionContext,
  Infrastructure,
  Airspace,
  ActivityZone,
  InfrastructureType,
  StrategicImportance,
  AirspaceClass,
  ActivityLevel,
  NearestInfrastructure,
  ContainingAirspace,
  ActivityZoneContext,
  IntelligenceValue,
  PositionContextCache,
} from '@/lib/types/context';

// Configuration
const CONFIG = {
  // Context score weights
  weights: {
    infrastructure: 0.35,
    airspace: 0.35,
    activity: 0.30,
  },
  // Infrastructure scoring
  infrastructureImportanceScores: {
    critical: 1.0,
    high: 0.8,
    medium: 0.5,
    low: 0.3,
  } as Record<StrategicImportance, number>,
  // Infrastructure distance decay (score drops to 0 at this distance)
  infrastructureMaxDistance: 100, // nm
  // Airspace class scores
  airspaceClassScores: {
    prohibited: 1.0,
    restricted: 0.9,
    danger: 0.8,
    moa: 0.7,
    warning: 0.6,
    alert: 0.5,
    tfr: 0.7,
    A: 0.3,
    B: 0.3,
    C: 0.2,
    D: 0.2,
    E: 0.1,
    G: 0.0,
  } as Record<AirspaceClass, number>,
  // Activity level scores
  activityLevelScores: {
    intense: 1.0,
    high: 0.8,
    moderate: 0.5,
    low: 0.2,
  } as Record<ActivityLevel, number>,
  // Cache settings
  cacheTtlMinutes: 60,
  gridCellPrecision: 4, // Geohash precision for caching
  // Activity zone settings
  activityZoneMinAircraft: 3,
  activityZoneClusterRadius: 30, // nm
  activityZonePeriodHours: 24,
};

export class ContextIntelligence {
  /**
   * Get context for a position
   */
  async getPositionContext(
    latitude: number,
    longitude: number,
    altitude?: number
  ): Promise<PositionContext> {
    try {
      // Try database function first (most efficient)
      const dbContext = await queryOne<{
        infrastructure_score: number;
        airspace_score: number;
        activity_score: number;
        combined_score: number;
        nearest_infrastructure_name: string | null;
        nearest_infrastructure_distance_nm: number | null;
        containing_airspace: string[] | null;
        activity_zone_level: string | null;
      }>(
        `SELECT * FROM calculate_position_context($1, $2, $3)`,
        [latitude, longitude, altitude ?? null]
      );

      if (dbContext) {
        // Get additional details
        const nearestInfra = await this.getNearestInfrastructure(latitude, longitude);
        const containingAirspace = await this.getContainingAirspace(
          latitude,
          longitude,
          altitude
        );
        const activityZone = await this.getActivityZone(latitude, longitude);

        return {
          infrastructure_score: dbContext.infrastructure_score,
          airspace_score: dbContext.airspace_score,
          activity_score: dbContext.activity_score,
          combined_score: dbContext.combined_score,
          nearest_infrastructure: nearestInfra,
          containing_airspace: containingAirspace,
          activity_zone: activityZone,
          context_summary: this.generateContextSummary(
            nearestInfra,
            containingAirspace,
            activityZone
          ),
          intelligence_value: this.getIntelligenceValue(dbContext.combined_score),
        };
      }

      // Fallback to manual calculation
      return await this.calculateContext(latitude, longitude, altitude);
    } catch (error) {
      console.error('Error getting position context:', error);
      return this.getDefaultContext();
    }
  }

  /**
   * Calculate context manually (fallback)
   */
  private async calculateContext(
    latitude: number,
    longitude: number,
    altitude?: number
  ): Promise<PositionContext> {
    const [nearestInfra, containingAirspace, activityZone] = await Promise.all([
      this.getNearestInfrastructure(latitude, longitude),
      this.getContainingAirspace(latitude, longitude, altitude),
      this.getActivityZone(latitude, longitude),
    ]);

    // Calculate scores
    const infraScore = this.calculateInfrastructureScore(nearestInfra);
    const airspaceScore = this.calculateAirspaceScore(containingAirspace);
    const activityScore = this.calculateActivityScore(activityZone);

    const combinedScore =
      infraScore * CONFIG.weights.infrastructure +
      airspaceScore * CONFIG.weights.airspace +
      activityScore * CONFIG.weights.activity;

    return {
      infrastructure_score: infraScore,
      airspace_score: airspaceScore,
      activity_score: activityScore,
      combined_score: combinedScore,
      nearest_infrastructure: nearestInfra,
      containing_airspace: containingAirspace,
      activity_zone: activityZone,
      context_summary: this.generateContextSummary(
        nearestInfra,
        containingAirspace,
        activityZone
      ),
      intelligence_value: this.getIntelligenceValue(combinedScore),
    };
  }

  /**
   * Get nearest infrastructure
   */
  private async getNearestInfrastructure(
    latitude: number,
    longitude: number
  ): Promise<NearestInfrastructure | null> {
    try {
      const result = await queryOne<{
        id: string;
        name: string;
        infrastructure_type: InfrastructureType;
        strategic_importance: StrategicImportance;
        lat: number;
        lon: number;
        distance_nm: number;
      }>(
        `SELECT
           i.id,
           i.name,
           i.infrastructure_type,
           i.strategic_importance,
           ST_Y(i.location::geometry) as lat,
           ST_X(i.location::geometry) as lon,
           ST_Distance(i.location::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) / 1852 as distance_nm
         FROM infrastructure i
         WHERE i.is_active = true
         ORDER BY i.location <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)
         LIMIT 1`,
        [latitude, longitude]
      );

      if (!result) return null;

      return {
        id: result.id,
        name: result.name,
        type: result.infrastructure_type,
        distance_nm: result.distance_nm,
        bearing: bearing(latitude, longitude, result.lat, result.lon),
        strategic_importance: result.strategic_importance,
      };
    } catch (error) {
      console.error('Error getting nearest infrastructure:', error);
      return null;
    }
  }

  /**
   * Get containing airspace polygons
   */
  private async getContainingAirspace(
    latitude: number,
    longitude: number,
    altitude?: number
  ): Promise<ContainingAirspace[]> {
    try {
      let altitudeClause = '';
      if (altitude !== undefined) {
        altitudeClause = `
          AND (a.lower_limit_ft IS NULL OR $3 >= a.lower_limit_ft)
          AND (a.upper_limit_ft IS NULL OR $3 <= a.upper_limit_ft)`;
      }

      const results = await query<{
        id: string;
        name: string;
        airspace_class: AirspaceClass;
        airspace_type: string | null;
        military_significance: string;
        lower_limit_ft: number | null;
        upper_limit_ft: number | null;
      }>(
        `SELECT
           a.id,
           a.name,
           a.airspace_class,
           a.airspace_type,
           a.military_significance,
           a.lower_limit_ft,
           a.upper_limit_ft
         FROM airspace a
         WHERE a.is_active = true
         AND ST_Contains(a.geom, ST_SetSRID(ST_MakePoint($2, $1), 4326))
         ${altitudeClause}
         ORDER BY
           CASE a.airspace_class
             WHEN 'prohibited' THEN 0
             WHEN 'restricted' THEN 1
             WHEN 'danger' THEN 2
             WHEN 'moa' THEN 3
             ELSE 10
           END`,
        altitude !== undefined
          ? [latitude, longitude, altitude]
          : [latitude, longitude]
      );

      return results.map((r) => ({
        id: r.id,
        name: r.name,
        class: r.airspace_class,
        type: r.airspace_type,
        military_significance: r.military_significance as 'low' | 'medium' | 'high',
        lower_limit_ft: r.lower_limit_ft,
        upper_limit_ft: r.upper_limit_ft,
      }));
    } catch (error) {
      console.error('Error getting containing airspace:', error);
      return [];
    }
  }

  /**
   * Get activity zone at position
   */
  private async getActivityZone(
    latitude: number,
    longitude: number
  ): Promise<ActivityZoneContext | null> {
    try {
      const result = await queryOne<{
        id: string;
        activity_level: ActivityLevel;
        dominant_activity: string | null;
        aircraft_count: number;
      }>(
        `SELECT
           az.id,
           az.activity_level,
           az.dominant_activity,
           az.aircraft_count
         FROM activity_zones az
         WHERE az.is_active = true
         AND ST_Contains(az.geom, ST_SetSRID(ST_MakePoint($2, $1), 4326))
         ORDER BY
           CASE az.activity_level
             WHEN 'intense' THEN 0
             WHEN 'high' THEN 1
             WHEN 'moderate' THEN 2
             ELSE 3
           END
         LIMIT 1`,
        [latitude, longitude]
      );

      if (!result) return null;

      return {
        id: result.id,
        activity_level: result.activity_level,
        dominant_activity: result.dominant_activity,
        aircraft_count: result.aircraft_count,
      };
    } catch (error) {
      console.error('Error getting activity zone:', error);
      return null;
    }
  }

  /**
   * Calculate infrastructure score
   */
  private calculateInfrastructureScore(
    nearest: NearestInfrastructure | null
  ): number {
    if (!nearest) return 0;

    const importanceScore =
      CONFIG.infrastructureImportanceScores[nearest.strategic_importance] || 0.3;

    // Distance decay (linear from 100% at 0nm to 0% at max distance)
    const distanceDecay = Math.max(
      0,
      1 - nearest.distance_nm / CONFIG.infrastructureMaxDistance
    );

    return importanceScore * distanceDecay;
  }

  /**
   * Calculate airspace score
   */
  private calculateAirspaceScore(airspaces: ContainingAirspace[]): number {
    if (airspaces.length === 0) return 0;

    // Take highest score from containing airspaces
    return Math.max(
      ...airspaces.map((a) => CONFIG.airspaceClassScores[a.class] || 0)
    );
  }

  /**
   * Calculate activity score
   */
  private calculateActivityScore(zone: ActivityZoneContext | null): number {
    if (!zone) return 0;
    return CONFIG.activityLevelScores[zone.activity_level] || 0;
  }

  /**
   * Generate human-readable context summary
   */
  private generateContextSummary(
    nearest: NearestInfrastructure | null,
    airspaces: ContainingAirspace[],
    zone: ActivityZoneContext | null
  ): string {
    const parts: string[] = [];

    if (nearest && nearest.distance_nm < 50) {
      parts.push(
        `${nearest.distance_nm.toFixed(1)}nm from ${nearest.name} (${nearest.strategic_importance} importance)`
      );
    }

    const significantAirspace = airspaces.filter(
      (a) =>
        a.class === 'prohibited' ||
        a.class === 'restricted' ||
        a.class === 'danger' ||
        a.class === 'moa'
    );
    if (significantAirspace.length > 0) {
      parts.push(
        `Inside ${significantAirspace.map((a) => a.name).join(', ')}`
      );
    }

    if (zone) {
      parts.push(
        `${zone.activity_level} activity area (${zone.aircraft_count} aircraft)`
      );
    }

    return parts.length > 0 ? parts.join('; ') : 'No significant context';
  }

  /**
   * Get intelligence value from score
   */
  private getIntelligenceValue(score: number): IntelligenceValue {
    if (score >= 0.8) return 'critical';
    if (score >= 0.6) return 'high';
    if (score >= 0.3) return 'moderate';
    return 'low';
  }

  /**
   * Get default empty context
   */
  private getDefaultContext(): PositionContext {
    return {
      infrastructure_score: 0,
      airspace_score: 0,
      activity_score: 0,
      combined_score: 0,
      nearest_infrastructure: null,
      containing_airspace: [],
      activity_zone: null,
      context_summary: 'Context unavailable',
      intelligence_value: 'low',
    };
  }

  /**
   * Update activity zones from recent position data
   */
  async updateActivityZones(): Promise<{
    created: number;
    updated: number;
    deactivated: number;
  }> {
    const stats = { created: 0, updated: 0, deactivated: 0 };

    try {
      // Cluster recent positions to identify activity zones
      const clusters = await query<{
        center_lat: number;
        center_lon: number;
        aircraft_count: number;
        unique_count: number;
        military_count: number;
        formation_count: number;
      }>(
        `WITH position_clusters AS (
           SELECT
             ROUND(latitude::numeric, 1) as lat_bucket,
             ROUND(longitude::numeric, 1) as lon_bucket,
             COUNT(*) as position_count,
             COUNT(DISTINCT pl.icao_hex) as unique_aircraft,
             COUNT(DISTINCT CASE WHEN a.is_military THEN pl.icao_hex END) as military_aircraft
           FROM positions_latest pl
           JOIN aircraft a ON a.id = pl.aircraft_id
           WHERE pl.timestamp >= NOW() - INTERVAL '${CONFIG.activityZonePeriodHours} hours'
           GROUP BY lat_bucket, lon_bucket
           HAVING COUNT(DISTINCT pl.icao_hex) >= ${CONFIG.activityZoneMinAircraft}
         )
         SELECT
           lat_bucket as center_lat,
           lon_bucket as center_lon,
           position_count as aircraft_count,
           unique_aircraft as unique_count,
           military_aircraft as military_count,
           0 as formation_count
         FROM position_clusters
         ORDER BY unique_aircraft DESC
         LIMIT 100`
      );

      for (const cluster of clusters) {
        // Determine activity level
        let activityLevel: ActivityLevel = 'low';
        if (cluster.unique_count >= 15) {
          activityLevel = 'intense';
        } else if (cluster.unique_count >= 10) {
          activityLevel = 'high';
        } else if (cluster.unique_count >= 5) {
          activityLevel = 'moderate';
        }

        // Create or update zone
        const existing = await queryOne<{ id: string }>(
          `SELECT id FROM activity_zones
           WHERE is_active = true
           AND ST_DWithin(
             geom,
             ST_SetSRID(ST_MakePoint($2, $1), 4326),
             ${CONFIG.activityZoneClusterRadius * 1852} -- meters
           )
           LIMIT 1`,
          [cluster.center_lat, cluster.center_lon]
        );

        if (existing) {
          await execute(
            `UPDATE activity_zones SET
               activity_level = $1,
               aircraft_count = $2,
               unique_aircraft_count = $3,
               military_aircraft_count = $4,
               period_end = NOW(),
               updated_at = NOW()
             WHERE id = $5`,
            [
              activityLevel,
              cluster.aircraft_count,
              cluster.unique_count,
              cluster.military_count,
              existing.id,
            ]
          );
          stats.updated++;
        } else {
          // Create circle geometry for zone
          await execute(
            `INSERT INTO activity_zones (
               geom, center_lat, center_lon, radius_nm,
               activity_level, aircraft_count, unique_aircraft_count,
               military_aircraft_count, formation_count,
               period_start, period_end, confidence
             )
             VALUES (
               ST_Buffer(
                 ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
                 ${CONFIG.activityZoneClusterRadius * 1852}
               )::geometry,
               $1, $2, $3, $4, $5, $6, $7, $8, NOW() - INTERVAL '${CONFIG.activityZonePeriodHours} hours', NOW(), 0.7
             )`,
            [
              cluster.center_lat,
              cluster.center_lon,
              CONFIG.activityZoneClusterRadius,
              activityLevel,
              cluster.aircraft_count,
              cluster.unique_count,
              cluster.military_count,
              cluster.formation_count,
            ]
          );
          stats.created++;
        }
      }

      // Deactivate stale zones
      const deactivated = await queryOne<{ count: string }>(
        `WITH deactivated AS (
           UPDATE activity_zones
           SET is_active = false, updated_at = NOW()
           WHERE is_active = true
           AND period_end < NOW() - INTERVAL '2 hours'
           RETURNING id
         )
         SELECT COUNT(*) as count FROM deactivated`
      );
      stats.deactivated = parseInt(deactivated?.count || '0', 10);

      return stats;
    } catch (error) {
      console.error('Error updating activity zones:', error);
      return stats;
    }
  }

  /**
   * Get infrastructure points for map display
   */
  async getInfrastructure(
    bounds?: {
      north: number;
      south: number;
      east: number;
      west: number;
    },
    types?: InfrastructureType[]
  ): Promise<Infrastructure[]> {
    try {
      let whereClause = 'WHERE i.is_active = true';
      const params: unknown[] = [];
      let paramIndex = 1;

      if (bounds) {
        whereClause += ` AND ST_Intersects(
          i.location,
          ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326)
        )`;
        params.push(bounds.west, bounds.south, bounds.east, bounds.north);
        paramIndex += 4;
      }

      if (types && types.length > 0) {
        whereClause += ` AND i.infrastructure_type = ANY($${paramIndex})`;
        params.push(types);
      }

      return await query<Infrastructure>(
        `SELECT
           i.*,
           ST_AsGeoJSON(i.location)::json as location,
           ST_AsGeoJSON(i.boundary)::json as boundary
         FROM infrastructure i
         ${whereClause}
         ORDER BY strategic_importance DESC, name`,
        params
      );
    } catch (error) {
      console.error('Error getting infrastructure:', error);
      return [];
    }
  }

  /**
   * Get active activity zones for map display
   */
  async getActivityZones(
    bounds?: {
      north: number;
      south: number;
      east: number;
      west: number;
    }
  ): Promise<ActivityZone[]> {
    try {
      let whereClause = 'WHERE az.is_active = true';
      const params: unknown[] = [];

      if (bounds) {
        whereClause += ` AND ST_Intersects(
          az.geom,
          ST_MakeEnvelope($1, $2, $3, $4, 4326)
        )`;
        params.push(bounds.west, bounds.south, bounds.east, bounds.north);
      }

      return await query<ActivityZone>(
        `SELECT
           az.*,
           ST_AsGeoJSON(az.geom)::json as geom
         FROM activity_zones az
         ${whereClause}
         ORDER BY
           CASE az.activity_level
             WHEN 'intense' THEN 0
             WHEN 'high' THEN 1
             WHEN 'moderate' THEN 2
             ELSE 3
           END`,
        params
      );
    } catch (error) {
      console.error('Error getting activity zones:', error);
      return [];
    }
  }

  /**
   * Get airspace polygons for map display
   */
  async getAirspace(
    bounds?: {
      north: number;
      south: number;
      east: number;
      west: number;
    },
    classes?: AirspaceClass[]
  ): Promise<Airspace[]> {
    try {
      let whereClause = 'WHERE a.is_active = true';
      const params: unknown[] = [];
      let paramIndex = 1;

      if (bounds) {
        whereClause += ` AND ST_Intersects(
          a.geom,
          ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326)
        )`;
        params.push(bounds.west, bounds.south, bounds.east, bounds.north);
        paramIndex += 4;
      }

      if (classes && classes.length > 0) {
        whereClause += ` AND a.airspace_class = ANY($${paramIndex})`;
        params.push(classes);
      }

      return await query<Airspace>(
        `SELECT
           a.*,
           ST_AsGeoJSON(a.geom)::json as geom
         FROM airspace a
         ${whereClause}
         ORDER BY airspace_class, name`,
        params
      );
    } catch (error) {
      console.error('Error getting airspace:', error);
      return [];
    }
  }

  /**
   * Get context statistics for a region
   */
  async getRegionContextStats(
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    }
  ): Promise<{
    infrastructure_count: number;
    airspace_count: number;
    activity_zone_count: number;
    avg_infrastructure_importance: number;
    dominant_airspace_class: AirspaceClass | null;
  }> {
    try {
      const infraCount = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM infrastructure
         WHERE is_active = true
         AND ST_Intersects(location, ST_MakeEnvelope($1, $2, $3, $4, 4326))`,
        [bounds.west, bounds.south, bounds.east, bounds.north]
      );

      const airspaceCount = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM airspace
         WHERE is_active = true
         AND ST_Intersects(geom, ST_MakeEnvelope($1, $2, $3, $4, 4326))`,
        [bounds.west, bounds.south, bounds.east, bounds.north]
      );

      const activityCount = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM activity_zones
         WHERE is_active = true
         AND ST_Intersects(geom, ST_MakeEnvelope($1, $2, $3, $4, 4326))`,
        [bounds.west, bounds.south, bounds.east, bounds.north]
      );

      const dominantAirspace = await queryOne<{ airspace_class: AirspaceClass }>(
        `SELECT airspace_class, COUNT(*) as cnt FROM airspace
         WHERE is_active = true
         AND ST_Intersects(geom, ST_MakeEnvelope($1, $2, $3, $4, 4326))
         GROUP BY airspace_class
         ORDER BY cnt DESC
         LIMIT 1`,
        [bounds.west, bounds.south, bounds.east, bounds.north]
      );

      return {
        infrastructure_count: parseInt(infraCount?.count || '0', 10),
        airspace_count: parseInt(airspaceCount?.count || '0', 10),
        activity_zone_count: parseInt(activityCount?.count || '0', 10),
        avg_infrastructure_importance: 0.5, // Would need aggregation query
        dominant_airspace_class: dominantAirspace?.airspace_class || null,
      };
    } catch (error) {
      console.error('Error getting region stats:', error);
      return {
        infrastructure_count: 0,
        airspace_count: 0,
        activity_zone_count: 0,
        avg_infrastructure_importance: 0,
        dominant_airspace_class: null,
      };
    }
  }
}

// Export singleton instance
export const contextIntelligence = new ContextIntelligence();
