import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { adsbService } from '@/lib/services/adsb';
import { detectMilitary } from '@/lib/utils/military-db';

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
    // Fetch military aircraft from ADSB.lol
    const aircraft = await adsbService.fetchMiddleEastMilitary();
    const withPositions = adsbService.filterWithPosition(aircraft);

    console.log(`Fetched ${aircraft.length} military aircraft, ${withPositions.length} with positions`);

    let upsertedAircraft = 0;
    let insertedPositions = 0;

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
              'adsb.lol',
            ]
          );
          insertedPositions++;
        }
      } catch (acError) {
        console.error(`Error processing aircraft ${ac.hex}:`, acError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${withPositions.length} aircraft`,
      stats: {
        fetched: aircraft.length,
        withPositions: withPositions.length,
        upsertedAircraft,
        insertedPositions,
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
