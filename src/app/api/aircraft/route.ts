import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { multiSourceADSB } from '@/lib/services/multi-source-adsb';
import type { Aircraft } from '@/lib/types/aircraft';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const militaryOnly = searchParams.get('military') !== 'false'; // Default to military only
    const live = searchParams.get('live') === 'true';
    const all = searchParams.get('all') === 'true'; // New: fetch all aircraft like ADSBexchange
    const limit = parseInt(searchParams.get('limit') || '500', 10);

    // If live mode, fetch directly from multi-source aggregator
    if (live) {
      let aircraft;
      let source;

      if (all || !militaryOnly) {
        // Fetch ALL aircraft (military + civilian) - like ADSBexchange globe
        aircraft = await multiSourceADSB.fetchAllAircraftInRegion();
        source = 'multi-source-all';
      } else {
        // Military only
        aircraft = await multiSourceADSB.fetchMiddleEastMilitary();
        source = 'multi-source-military';
      }

      // Get source stats for debugging
      const sources = multiSourceADSB.getSourceStats();

      return NextResponse.json({
        success: true,
        data: aircraft.slice(0, limit),
        count: aircraft.length,
        militaryCount: aircraft.filter(a => a.mil).length,
        civilianCount: aircraft.filter(a => !a.mil).length,
        source,
        sources: sources.filter(s => s.enabled).map(s => s.name),
      });
    }

    // Otherwise fetch from database
    let queryText: string;
    if (all) {
      queryText = `
        SELECT a.*, p.latitude, p.longitude, p.altitude, p.ground_speed, p.track, p.callsign
        FROM aircraft a
        LEFT JOIN LATERAL (
          SELECT latitude, longitude, altitude, ground_speed, track, callsign
          FROM positions
          WHERE aircraft_id = a.id
          ORDER BY timestamp DESC
          LIMIT 1
        ) p ON true
        WHERE p.latitude IS NOT NULL
        ORDER BY a.updated_at DESC
        LIMIT $1
      `;
    } else {
      queryText = `
        SELECT a.*, p.latitude, p.longitude, p.altitude, p.ground_speed, p.track, p.callsign
        FROM aircraft a
        LEFT JOIN LATERAL (
          SELECT latitude, longitude, altitude, ground_speed, track, callsign
          FROM positions
          WHERE aircraft_id = a.id
          ORDER BY timestamp DESC
          LIMIT 1
        ) p ON true
        WHERE p.latitude IS NOT NULL
        ${militaryOnly ? 'AND a.is_military = true' : ''}
        ORDER BY a.updated_at DESC
        LIMIT $1
      `;
    }

    const data = await query<Aircraft>(queryText, [limit]);

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
      source: 'database',
    });
  } catch (error) {
    console.error('Error in aircraft API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
