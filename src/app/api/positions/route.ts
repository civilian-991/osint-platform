import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const latest = searchParams.get('latest') === 'true';
    const icao = searchParams.get('icao');
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const radiusNm = searchParams.get('radius');
    const limit = parseInt(searchParams.get('limit') || '500', 10);

    const supabase = await createClient();

    // If requesting latest positions
    if (latest) {
      let query = supabase
        .from('positions_latest')
        .select(`
          *,
          aircraft (
            id,
            icao_hex,
            registration,
            type_code,
            type_description,
            operator,
            country,
            is_military,
            military_category
          )
        `)
        .order('timestamp', { ascending: false })
        .limit(limit);

      // Filter by ICAO if provided
      if (icao) {
        query = query.eq('icao_hex', icao.toUpperCase());
      }

      const { data, error } = await query;

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
        count: data?.length || 0,
      });
    }

    // If requesting positions within radius (uses PostGIS function)
    if (lat && lon && radiusNm) {
      const { data, error } = await supabase.rpc('get_aircraft_in_radius', {
        center_lat: parseFloat(lat),
        center_lon: parseFloat(lon),
        radius_nm: parseFloat(radiusNm),
      });

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
        count: data?.length || 0,
      });
    }

    // Default: Get historical positions for specific aircraft
    if (icao) {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .eq('icao_hex', icao.toUpperCase())
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
        count: data?.length || 0,
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
