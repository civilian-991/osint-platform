import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchMiddleEastMilitary } from '@/lib/services/adsb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const military = searchParams.get('military') === 'true';
    const live = searchParams.get('live') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // If live mode, fetch directly from ADSB.lol
    if (live) {
      const aircraft = await fetchMiddleEastMilitary();
      return NextResponse.json({
        success: true,
        data: aircraft,
        count: aircraft.length,
        source: 'adsb.lol',
      });
    }

    // Otherwise fetch from database
    const supabase = await createClient();

    let query = supabase
      .from('aircraft')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (military) {
      query = query.eq('is_military', true);
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
