import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { fetchMiddleEastMilitary } from '@/lib/services/adsb';
import type { Aircraft } from '@/lib/types/aircraft';

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
    let queryText = `
      SELECT * FROM aircraft
      ${military ? 'WHERE is_military = true' : ''}
      ORDER BY updated_at DESC
      LIMIT $1
    `;

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
