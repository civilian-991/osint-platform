import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne, query } from '@/lib/db';
import { multiSourceADSB } from '@/lib/services/multi-source-adsb';
import { detectMilitary } from '@/lib/utils/military-db';
import type { WatchlistMatch } from '@/lib/types/watchlist';

// Helper to queue ML tasks
async function queueMLTask(
  taskType: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>,
  priority: number = 5
): Promise<void> {
  if (process.env.ENABLE_ML_PROCESSING !== 'true') {
    return;
  }

  try {
    await execute(
      `SELECT queue_ml_task($1, $2, $3, $4, $5)`,
      [taskType, entityType, entityId, JSON.stringify(payload), priority]
    );
  } catch (error) {
    console.error('Error queueing ML task:', error);
  }
}

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without secret
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  if (!cronSecret) {
    console.warn('CRON_SECRET not set');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Fetch military aircraft from multiple sources
    const aircraft = await multiSourceADSB.fetchMiddleEastMilitary();
    const withPositions = aircraft.filter(ac => ac.lat !== undefined && ac.lon !== undefined);
    const sources = multiSourceADSB.getSourceStats().map(s => s.name).join(', ');

    console.log(`Fetched ${aircraft.length} military aircraft from [${sources}], ${withPositions.length} with positions`);

    let upsertedAircraft = 0;
    let insertedPositions = 0;
    let watchlistAlerts = 0;

    // Process each aircraft
    for (const ac of withPositions) {
      try {
        // Upsert aircraft record
        const detection = detectMilitary(ac);

        const aircraftRecord = await queryOne<{ id: string }>(
          `INSERT INTO aircraft (icao_hex, registration, type_code, type_description, operator, is_military, military_category, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (icao_hex) DO UPDATE SET
             registration = EXCLUDED.registration,
             type_code = EXCLUDED.type_code,
             type_description = EXCLUDED.type_description,
             operator = EXCLUDED.operator,
             is_military = EXCLUDED.is_military,
             military_category = EXCLUDED.military_category,
             updated_at = NOW()
           RETURNING id`,
          [
            ac.hex.toUpperCase(),
            ac.r || null,
            ac.t || null,
            ac.desc || null,
            ac.ownOp || null,
            detection.isMilitary,
            detection.category,
          ]
        );

        if (!aircraftRecord) {
          console.error(`Failed to upsert aircraft ${ac.hex}`);
          continue;
        }

        upsertedAircraft++;

        // Insert position record
        if (ac.lat !== undefined && ac.lon !== undefined) {
          await execute(
            `INSERT INTO positions (aircraft_id, icao_hex, callsign, latitude, longitude, altitude, ground_speed, track, vertical_rate, squawk, on_ground, timestamp, source)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12)`,
            [
              aircraftRecord.id,
              ac.hex.toUpperCase(),
              ac.flight?.trim() || null,
              ac.lat,
              ac.lon,
              typeof ac.alt_baro === 'number' ? ac.alt_baro : null,
              ac.gs ? Math.round(ac.gs) : null,
              ac.track ? Math.round(ac.track) : null,
              ac.baro_rate || null,
              ac.squawk || null,
              ac.alt_baro === 'ground',
              (ac as any)._source || 'multi-source',
            ]
          );
          insertedPositions++;

          // Queue ML tasks for anomaly detection and profile update
          const positionData = {
            latitude: ac.lat,
            longitude: ac.lon,
            altitude: typeof ac.alt_baro === 'number' ? ac.alt_baro : null,
            ground_speed: ac.gs ? Math.round(ac.gs) : null,
            track: ac.track ? Math.round(ac.track) : null,
            timestamp: new Date().toISOString(),
          };

          // Queue anomaly detection (lower priority for real-time)
          await queueMLTask('anomaly_detection', 'aircraft', aircraftRecord.id, {
            positions: [positionData],
          }, 7);

          // Queue profile update (lower priority)
          await queueMLTask('profile_update', 'aircraft', aircraftRecord.id, {
            positions: [positionData],
          }, 8);
        }

        // Check watchlists for this aircraft
        const watchlistMatches = await query<WatchlistMatch>(
          `SELECT * FROM check_aircraft_watchlist($1, $2, $3, $4)`,
          [
            ac.hex.toUpperCase(),
            ac.r || null,
            ac.flight?.trim() || null,
            ac.t || null,
          ]
        );

        // Create alerts for watchlist matches
        for (const match of watchlistMatches) {
          // Check if we already created an alert for this aircraft recently (within 1 hour)
          const recentAlert = await queryOne<{ id: string }>(
            `SELECT id FROM alerts
             WHERE user_id = $1
             AND alert_type = 'watchlist_aircraft'
             AND (data->>'icao_hex')::text = $2
             AND created_at > NOW() - INTERVAL '1 hour'`,
            [match.user_id, ac.hex.toUpperCase()]
          );

          if (!recentAlert) {
            await execute(
              `INSERT INTO alerts (user_id, alert_type, severity, title, description, data)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                match.user_id,
                'watchlist_aircraft',
                match.priority === 'critical' ? 'critical' : match.priority === 'high' ? 'high' : 'medium',
                `Watchlist Aircraft Detected: ${ac.flight?.trim() || ac.hex.toUpperCase()}`,
                `Aircraft ${ac.r || ac.hex} matched "${match.match_value}" in watchlist "${match.watchlist_name}". ${match.notes || ''}`,
                {
                  icao_hex: ac.hex.toUpperCase(),
                  registration: ac.r || null,
                  callsign: ac.flight?.trim() || null,
                  type_code: ac.t || null,
                  watchlist_id: match.watchlist_id,
                  watchlist_name: match.watchlist_name,
                  match_type: match.match_type,
                  match_value: match.match_value,
                  priority: match.priority,
                  latitude: ac.lat,
                  longitude: ac.lon,
                  altitude: typeof ac.alt_baro === 'number' ? ac.alt_baro : null,
                },
              ]
            );
            watchlistAlerts++;
          }
        }
      } catch (acError) {
        console.error(`Error processing aircraft ${ac.hex}:`, acError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${withPositions.length} aircraft from ${sources}`,
      stats: {
        fetched: aircraft.length,
        withPositions: withPositions.length,
        upsertedAircraft,
        insertedPositions,
        watchlistAlerts,
        sources: multiSourceADSB.getSourceStats(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in fetch-aircraft cron:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Support POST for Vercel cron
export async function POST(request: NextRequest) {
  return GET(request);
}
