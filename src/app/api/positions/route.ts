import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface PositionWithAircraft {
  id: string;
  aircraft_id: string;
  icao_hex: string;
  callsign: string | null;
  latitude: number;
  longitude: number;
  altitude: number | null;
  ground_speed: number | null;
  track: number | null;
  vertical_rate: number | null;
  squawk: string | null;
  on_ground: boolean;
  timestamp: string;
  source: string;
  aircraft?: {
    id: string;
    icao_hex: string;
    registration: string | null;
    type_code: string | null;
    type_description: string | null;
    operator: string | null;
    country: string | null;
    is_military: boolean;
    military_category: string | null;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const latest = searchParams.get('latest') === 'true';
    const icao = searchParams.get('icao');
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const radiusNm = searchParams.get('radius');
    const limit = parseInt(searchParams.get('limit') || '500', 10);

    // If requesting latest positions
    if (latest) {
      let queryText = `
        SELECT
          p.*,
          json_build_object(
            'id', a.id,
            'icao_hex', a.icao_hex,
            'registration', a.registration,
            'type_code', a.type_code,
            'type_description', a.type_description,
            'operator', a.operator,
            'country', a.country,
            'is_military', a.is_military,
            'military_category', a.military_category
          ) as aircraft
        FROM positions_latest p
        LEFT JOIN aircraft a ON p.aircraft_id = a.id
        ${icao ? 'WHERE p.icao_hex = $2' : ''}
        ORDER BY p.timestamp DESC
        LIMIT $1
      `;

      const params = icao ? [limit, icao.toUpperCase()] : [limit];
      const data = await query<PositionWithAircraft>(queryText, params);

      return NextResponse.json({
        success: true,
        data,
        count: data.length,
      });
    }

    // If requesting positions within radius (uses PostGIS function)
    if (lat && lon && radiusNm) {
      const queryText = `
        SELECT * FROM get_aircraft_in_radius($1, $2, $3)
      `;

      const data = await query<PositionWithAircraft>(queryText, [
        parseFloat(lat),
        parseFloat(lon),
        parseFloat(radiusNm),
      ]);

      return NextResponse.json({
        success: true,
        data,
        count: data.length,
      });
    }

    // Default: Get historical positions for specific aircraft
    if (icao) {
      const queryText = `
        SELECT * FROM positions
        WHERE icao_hex = $1
        ORDER BY timestamp DESC
        LIMIT $2
      `;

      const data = await query<PositionWithAircraft>(queryText, [
        icao.toUpperCase(),
        limit,
      ]);

      return NextResponse.json({
        success: true,
        data,
        count: data.length,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Missing required parameters' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in positions API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
