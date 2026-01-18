/**
 * Geofence Monitor Service
 * Handles entry/exit/dwell detection for aircraft in geofences
 */

import { query, queryOne, execute } from '@/lib/db';
import type {
  Geofence,
  GeofenceWithStats,
  GeofenceAircraftState,
  GeofenceAlert,
  GeofenceAlertWithGeofence,
  AircraftPositionForGeofence,
  GeofenceCheckResult,
  GeofenceStateChange,
  CreateGeofenceRequest,
  UpdateGeofenceRequest,
  coordinatesToPolygon,
} from '@/lib/types/geofence';

// ================================================
// Geofence CRUD Operations
// ================================================

export async function getGeofences(userId: string): Promise<GeofenceWithStats[]> {
  return query<GeofenceWithStats>(
    `SELECT * FROM geofences_with_stats WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
}

export async function getGeofenceById(
  id: string,
  userId: string
): Promise<GeofenceWithStats | null> {
  return queryOne<GeofenceWithStats>(
    `SELECT * FROM geofences_with_stats WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
}

export async function createGeofence(
  userId: string,
  data: CreateGeofenceRequest
): Promise<Geofence> {
  // Convert coordinates to PostGIS geometry
  const polygon = coordinatesToPolygonSQL(data.coordinates);

  const result = await queryOne<Geofence>(
    `INSERT INTO geofences (
      user_id, name, description, geom,
      alert_on_entry, alert_on_exit, alert_on_dwell, dwell_threshold_seconds,
      fill_color, fill_opacity, stroke_color, stroke_width,
      military_only, aircraft_types, is_active
    ) VALUES (
      $1, $2, $3, ST_GeomFromText($4, 4326),
      $5, $6, $7, $8,
      $9, $10, $11, $12,
      $13, $14, $15
    )
    RETURNING *, ST_AsGeoJSON(geom)::jsonb as geom_geojson`,
    [
      userId,
      data.name,
      data.description || null,
      polygon,
      data.alert_on_entry ?? true,
      data.alert_on_exit ?? true,
      data.alert_on_dwell ?? true,
      data.dwell_threshold_seconds ?? 300,
      data.fill_color ?? '#3b82f6',
      data.fill_opacity ?? 0.2,
      data.stroke_color ?? '#3b82f6',
      data.stroke_width ?? 2,
      data.military_only ?? true,
      data.aircraft_types || null,
      data.is_active ?? true,
    ]
  );

  if (!result) {
    throw new Error('Failed to create geofence');
  }

  return result;
}

export async function updateGeofence(
  id: string,
  userId: string,
  data: UpdateGeofenceRequest
): Promise<Geofence | null> {
  // Build dynamic update query
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.coordinates !== undefined) {
    updates.push(`geom = ST_GeomFromText($${paramIndex++}, 4326)`);
    values.push(coordinatesToPolygonSQL(data.coordinates));
  }
  if (data.alert_on_entry !== undefined) {
    updates.push(`alert_on_entry = $${paramIndex++}`);
    values.push(data.alert_on_entry);
  }
  if (data.alert_on_exit !== undefined) {
    updates.push(`alert_on_exit = $${paramIndex++}`);
    values.push(data.alert_on_exit);
  }
  if (data.alert_on_dwell !== undefined) {
    updates.push(`alert_on_dwell = $${paramIndex++}`);
    values.push(data.alert_on_dwell);
  }
  if (data.dwell_threshold_seconds !== undefined) {
    updates.push(`dwell_threshold_seconds = $${paramIndex++}`);
    values.push(data.dwell_threshold_seconds);
  }
  if (data.fill_color !== undefined) {
    updates.push(`fill_color = $${paramIndex++}`);
    values.push(data.fill_color);
  }
  if (data.fill_opacity !== undefined) {
    updates.push(`fill_opacity = $${paramIndex++}`);
    values.push(data.fill_opacity);
  }
  if (data.stroke_color !== undefined) {
    updates.push(`stroke_color = $${paramIndex++}`);
    values.push(data.stroke_color);
  }
  if (data.stroke_width !== undefined) {
    updates.push(`stroke_width = $${paramIndex++}`);
    values.push(data.stroke_width);
  }
  if (data.military_only !== undefined) {
    updates.push(`military_only = $${paramIndex++}`);
    values.push(data.military_only);
  }
  if (data.aircraft_types !== undefined) {
    updates.push(`aircraft_types = $${paramIndex++}`);
    values.push(data.aircraft_types);
  }
  if (data.is_active !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(data.is_active);
  }

  if (updates.length === 0) {
    // Nothing to update, return existing
    return getGeofenceById(id, userId);
  }

  values.push(id, userId);

  return queryOne<Geofence>(
    `UPDATE geofences
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
     RETURNING *, ST_AsGeoJSON(geom)::jsonb as geom_geojson`,
    values
  );
}

export async function deleteGeofence(id: string, userId: string): Promise<boolean> {
  const result = await execute(
    `DELETE FROM geofences WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rowCount > 0;
}

// ================================================
// Geofence Alert Operations
// ================================================

export async function getGeofenceAlerts(
  userId: string,
  options: {
    geofenceId?: string;
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ alerts: GeofenceAlertWithGeofence[]; total: number; unread_count: number }> {
  const { geofenceId, unreadOnly = false, limit = 50, offset = 0 } = options;

  let whereClause = 'ga.user_id = $1';
  const params: unknown[] = [userId];
  let paramIndex = 2;

  if (geofenceId) {
    whereClause += ` AND ga.geofence_id = $${paramIndex++}`;
    params.push(geofenceId);
  }
  if (unreadOnly) {
    whereClause += ` AND ga.is_read = false`;
  }

  // Get total counts
  const countResult = await queryOne<{ total: number; unread_count: number }>(
    `SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE is_read = false)::int as unread_count
     FROM geofence_alerts ga
     WHERE ${whereClause.replace(' AND ga.is_read = false', '')}`,
    params.slice(0, paramIndex - 1 - (unreadOnly ? 0 : 0))
  );

  // Get alerts with geofence info
  const alerts = await query<GeofenceAlertWithGeofence>(
    `SELECT ga.*,
      row_to_json(g.*) as geofence
     FROM geofence_alerts ga
     LEFT JOIN geofences g ON ga.geofence_id = g.id
     WHERE ${whereClause}
     ORDER BY ga.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return {
    alerts,
    total: countResult?.total ?? 0,
    unread_count: countResult?.unread_count ?? 0,
  };
}

export async function markAlertRead(
  alertId: string,
  userId: string
): Promise<boolean> {
  const result = await execute(
    `UPDATE geofence_alerts SET is_read = true WHERE id = $1 AND user_id = $2`,
    [alertId, userId]
  );
  return result.rowCount > 0;
}

export async function markAllAlertsRead(userId: string): Promise<number> {
  const result = await execute(
    `UPDATE geofence_alerts SET is_read = true WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
  return result.rowCount;
}

export async function dismissAlert(
  alertId: string,
  userId: string
): Promise<boolean> {
  const result = await execute(
    `UPDATE geofence_alerts SET is_dismissed = true WHERE id = $1 AND user_id = $2`,
    [alertId, userId]
  );
  return result.rowCount > 0;
}

// ================================================
// Geofence Monitoring Core
// ================================================

/**
 * Check aircraft positions against all active geofences
 * Returns which aircraft are inside which geofences
 */
export async function checkAircraftInGeofences(
  positions: AircraftPositionForGeofence[]
): Promise<GeofenceCheckResult[]> {
  if (positions.length === 0) {
    return [];
  }

  // Convert positions to JSONB format for the function
  const positionsJson = JSON.stringify(positions);

  return query<GeofenceCheckResult>(
    `SELECT * FROM check_aircraft_in_geofences($1::jsonb)`,
    [positionsJson]
  );
}

/**
 * Process geofence state changes and generate alerts
 * This is the main entry point for the cron job
 */
export async function processGeofenceUpdates(
  positions: AircraftPositionForGeofence[]
): Promise<GeofenceStateChange[]> {
  if (positions.length === 0) {
    return [];
  }

  const stateChanges: GeofenceStateChange[] = [];
  const now = new Date().toISOString();

  // Get current aircraft in geofences
  const currentInside = await checkAircraftInGeofences(positions);

  // Build lookup maps
  const insideMap = new Map<string, GeofenceCheckResult[]>();
  for (const result of currentInside) {
    const key = `${result.geofence_id}:${result.icao_hex}`;
    if (!insideMap.has(key)) {
      insideMap.set(key, []);
    }
    insideMap.get(key)!.push(result);
  }

  // Get all current states for geofences that have aircraft
  const geofenceIds = [...new Set(currentInside.map((r) => r.geofence_id))];
  let existingStates: GeofenceAircraftState[] = [];

  if (geofenceIds.length > 0) {
    existingStates = await query<GeofenceAircraftState>(
      `SELECT * FROM geofence_aircraft_state WHERE geofence_id = ANY($1)`,
      [geofenceIds]
    );
  }

  // Also get states for aircraft that might have exited
  const icaoHexes = [...new Set(positions.map((p) => p.icao_hex))];
  const activeStates = await query<GeofenceAircraftState>(
    `SELECT * FROM geofence_aircraft_state
     WHERE icao_hex = ANY($1) AND state != 'outside'`,
    [icaoHexes]
  );

  // Merge all states
  const stateMap = new Map<string, GeofenceAircraftState>();
  for (const state of [...existingStates, ...activeStates]) {
    stateMap.set(`${state.geofence_id}:${state.icao_hex}`, state);
  }

  // Process each geofence result
  const processed = new Set<string>();
  for (const result of currentInside) {
    const key = `${result.geofence_id}:${result.icao_hex}`;
    if (processed.has(key)) continue;
    processed.add(key);

    const existingState = stateMap.get(key);
    const position: AircraftPositionForGeofence = {
      icao_hex: result.icao_hex,
      lat: result.lat,
      lon: result.lon,
      altitude: result.altitude,
      callsign: result.callsign,
      aircraft_type: result.aircraft_type,
      registration: result.registration,
      speed: result.speed,
      heading: result.heading,
    };

    if (!existingState || existingState.state === 'outside') {
      // New entry
      if (result.alert_on_entry) {
        stateChanges.push({
          type: 'entry',
          geofence_id: result.geofence_id,
          geofence_name: result.geofence_name,
          user_id: result.user_id,
          icao_hex: result.icao_hex,
          position,
          previous_state: 'outside',
          new_state: 'inside',
        });
      }

      // Upsert state
      await execute(
        `INSERT INTO geofence_aircraft_state (
          geofence_id, icao_hex, state, entered_at, last_seen_at,
          entry_lat, entry_lon, entry_altitude,
          last_lat, last_lon, last_altitude
        ) VALUES ($1, $2, 'inside', $3, $3, $4, $5, $6, $4, $5, $6)
        ON CONFLICT (geofence_id, icao_hex) DO UPDATE SET
          state = 'inside',
          entered_at = COALESCE(geofence_aircraft_state.entered_at, $3),
          last_seen_at = $3,
          entry_lat = COALESCE(geofence_aircraft_state.entry_lat, $4),
          entry_lon = COALESCE(geofence_aircraft_state.entry_lon, $5),
          entry_altitude = COALESCE(geofence_aircraft_state.entry_altitude, $6),
          last_lat = $4,
          last_lon = $5,
          last_altitude = $6`,
        [
          result.geofence_id,
          result.icao_hex,
          now,
          result.lat,
          result.lon,
          result.altitude,
        ]
      );
    } else if (existingState.state === 'inside') {
      // Already inside - check for dwell threshold
      const enteredAt = existingState.entered_at
        ? new Date(existingState.entered_at)
        : new Date();
      const dwellSeconds = Math.floor((Date.now() - enteredAt.getTime()) / 1000);

      if (dwellSeconds >= result.dwell_threshold_seconds) {
        // Transition to dwelling
        if (result.alert_on_dwell && existingState.state !== 'dwelling') {
          stateChanges.push({
            type: 'dwell',
            geofence_id: result.geofence_id,
            geofence_name: result.geofence_name,
            user_id: result.user_id,
            icao_hex: result.icao_hex,
            position,
            dwell_seconds: dwellSeconds,
            previous_state: 'inside',
            new_state: 'dwelling',
          });

          await execute(
            `UPDATE geofence_aircraft_state
             SET state = 'dwelling', dwell_start_at = $1, last_seen_at = $1,
                 last_lat = $2, last_lon = $3, last_altitude = $4
             WHERE geofence_id = $5 AND icao_hex = $6`,
            [now, result.lat, result.lon, result.altitude, result.geofence_id, result.icao_hex]
          );
        }
      } else {
        // Still inside, update position
        await execute(
          `UPDATE geofence_aircraft_state
           SET last_seen_at = $1, last_lat = $2, last_lon = $3, last_altitude = $4
           WHERE geofence_id = $5 AND icao_hex = $6`,
          [now, result.lat, result.lon, result.altitude, result.geofence_id, result.icao_hex]
        );
      }
    } else {
      // dwelling - just update position
      await execute(
        `UPDATE geofence_aircraft_state
         SET last_seen_at = $1, last_lat = $2, last_lon = $3, last_altitude = $4
         WHERE geofence_id = $5 AND icao_hex = $6`,
        [now, result.lat, result.lon, result.altitude, result.geofence_id, result.icao_hex]
      );
    }
  }

  // Check for exits - aircraft that were inside but are no longer
  for (const state of activeStates) {
    const key = `${state.geofence_id}:${state.icao_hex}`;
    if (!insideMap.has(key)) {
      // Aircraft has exited
      const position = positions.find((p) => p.icao_hex === state.icao_hex);
      if (position) {
        // Get geofence details for alert
        const geofence = await queryOne<Geofence>(
          `SELECT * FROM geofences WHERE id = $1`,
          [state.geofence_id]
        );

        if (geofence?.alert_on_exit) {
          stateChanges.push({
            type: 'exit',
            geofence_id: state.geofence_id,
            geofence_name: geofence.name,
            user_id: geofence.user_id,
            icao_hex: state.icao_hex,
            position,
            previous_state: state.state,
            new_state: 'outside',
          });
        }

        // Update state to outside
        await execute(
          `UPDATE geofence_aircraft_state
           SET state = 'outside', last_seen_at = $1
           WHERE geofence_id = $2 AND icao_hex = $3`,
          [now, state.geofence_id, state.icao_hex]
        );
      }
    }
  }

  // Create alerts for all state changes
  for (const change of stateChanges) {
    await createGeofenceAlert(change);
  }

  return stateChanges;
}

/**
 * Create a geofence alert record
 */
async function createGeofenceAlert(change: GeofenceStateChange): Promise<GeofenceAlert> {
  const severity = determineSeverity(change);

  const result = await queryOne<GeofenceAlert>(
    `INSERT INTO geofence_alerts (
      geofence_id, user_id, icao_hex, alert_type, severity,
      callsign, aircraft_type, registration,
      lat, lon, altitude, speed, heading, dwell_seconds
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      change.geofence_id,
      change.user_id,
      change.icao_hex,
      change.type,
      severity,
      change.position.callsign,
      change.position.aircraft_type,
      change.position.registration,
      change.position.lat,
      change.position.lon,
      change.position.altitude,
      change.position.speed,
      change.position.heading,
      change.dwell_seconds || null,
    ]
  );

  if (!result) {
    throw new Error('Failed to create geofence alert');
  }

  return result;
}

/**
 * Determine alert severity based on state change type and aircraft
 */
function determineSeverity(change: GeofenceStateChange): string {
  // Higher severity for certain aircraft types
  const highPriorityTypes = ['F16', 'F15', 'F18', 'F22', 'F35', 'RC135', 'RQ4', 'MQ9'];
  const isHighPriority = change.position.aircraft_type &&
    highPriorityTypes.includes(change.position.aircraft_type);

  if (change.type === 'dwell') {
    // Long dwell times are more significant
    if (change.dwell_seconds && change.dwell_seconds > 1800) {
      return 'high';
    }
    return isHighPriority ? 'high' : 'medium';
  }

  if (change.type === 'entry') {
    return isHighPriority ? 'high' : 'medium';
  }

  // Exit is usually lower severity
  return isHighPriority ? 'medium' : 'low';
}

// ================================================
// Utility Functions
// ================================================

/**
 * Convert coordinate array to PostGIS WKT polygon
 */
function coordinatesToPolygonSQL(coordinates: [number, number][]): string {
  // Ensure the polygon is closed
  const closed = [...coordinates];
  if (
    closed.length > 0 &&
    (closed[0][0] !== closed[closed.length - 1][0] ||
      closed[0][1] !== closed[closed.length - 1][1])
  ) {
    closed.push(closed[0]);
  }

  const coordString = closed.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
  return `POLYGON((${coordString}))`;
}

/**
 * Get aircraft currently inside a specific geofence
 */
export async function getAircraftInGeofence(
  geofenceId: string
): Promise<GeofenceAircraftState[]> {
  return query<GeofenceAircraftState>(
    `SELECT * FROM geofence_aircraft_state
     WHERE geofence_id = $1 AND state != 'outside'
     ORDER BY entered_at DESC`,
    [geofenceId]
  );
}

/**
 * Clean up stale state entries (aircraft not seen for a while)
 */
export async function cleanupStaleStates(maxAgeMinutes: number = 30): Promise<number> {
  const result = await execute(
    `UPDATE geofence_aircraft_state
     SET state = 'outside'
     WHERE state != 'outside'
     AND last_seen_at < NOW() - INTERVAL '1 minute' * $1`,
    [maxAgeMinutes]
  );
  return result.rowCount;
}

/**
 * Get all active geofences (for the cron job)
 */
export async function getAllActiveGeofences(): Promise<Geofence[]> {
  return query<Geofence>(
    `SELECT *, ST_AsGeoJSON(geom)::jsonb as geom_geojson
     FROM geofences WHERE is_active = true`
  );
}
