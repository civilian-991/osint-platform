import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { adsbService } from '@/lib/services/adsb';
import { detectMilitary } from '@/lib/utils/military-db';
import type { ADSBAircraft } from '@/lib/types/aircraft';

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
    const supabase = await createServiceClient();

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

        const aircraftData = {
          icao_hex: ac.hex.toUpperCase(),
          registration: ac.r || null,
          type_code: ac.t || null,
          type_description: ac.desc || null,
          operator: ac.ownOp || null,
          is_military: detection.isMilitary,
          military_category: detection.category,
          updated_at: new Date().toISOString(),
        };

        const { data: aircraftRecord, error: aircraftError } = await supabase
          .from('aircraft')
          .upsert(aircraftData, {
            onConflict: 'icao_hex',
          })
          .select('id')
          .single();

        if (aircraftError) {
          console.error(`Error upserting aircraft ${ac.hex}:`, aircraftError);
          continue;
        }

        upsertedAircraft++;

        // Insert position record
        if (ac.lat !== undefined && ac.lon !== undefined) {
          const positionData = {
            aircraft_id: aircraftRecord.id,
            icao_hex: ac.hex.toUpperCase(),
            callsign: ac.flight?.trim() || null,
            latitude: ac.lat,
            longitude: ac.lon,
            altitude: typeof ac.alt_baro === 'number' ? ac.alt_baro : null,
            ground_speed: ac.gs ? Math.round(ac.gs) : null,
            track: ac.track ? Math.round(ac.track) : null,
            vertical_rate: ac.baro_rate || null,
            squawk: ac.squawk || null,
            on_ground: ac.alt_baro === 'ground',
            timestamp: new Date().toISOString(),
            source: 'adsb.lol',
          };

          const { error: positionError } = await supabase
            .from('positions')
            .insert(positionData);

          if (positionError) {
            console.error(`Error inserting position for ${ac.hex}:`, positionError);
          } else {
            insertedPositions++;
          }
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
