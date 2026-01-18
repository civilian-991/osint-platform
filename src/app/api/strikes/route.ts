import { NextRequest, NextResponse } from 'next/server';
import { strikeTracker } from '@/lib/services/strike-tracker';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');
    const maxAge = parseInt(searchParams.get('maxAge') || '4', 10);

    let strikes;
    if (region) {
      strikes = await strikeTracker.getStrikesByRegion(region);
    } else {
      strikes = await strikeTracker.getActiveStrikes(maxAge);
    }

    return NextResponse.json({
      success: true,
      data: strikes,
      count: strikes.length,
    });
  } catch (error) {
    console.error('Error fetching strikes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch strikes' },
      { status: 500 }
    );
  }
}

// Manually add a strike (for testing or manual entry)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventType, latitude, longitude, locationName, region, description, expireHours } = body;

    if (!eventType || !latitude || !longitude) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const id = await strikeTracker.addStrike(
      eventType,
      latitude,
      longitude,
      locationName || 'Unknown',
      region || 'Unknown',
      description || '',
      expireHours || 2
    );

    return NextResponse.json({
      success: true,
      id,
    });
  } catch (error) {
    console.error('Error adding strike:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add strike' },
      { status: 500 }
    );
  }
}
