import { NextRequest, NextResponse } from 'next/server';
import { contextIntelligence } from '@/lib/services/context-intelligence';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '');
    const lon = parseFloat(searchParams.get('lon') || '');
    const alt = searchParams.get('alt') ? parseInt(searchParams.get('alt')!, 10) : undefined;

    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json(
        { success: false, error: 'lat and lon are required' },
        { status: 400 }
      );
    }

    const context = await contextIntelligence.getPositionContext(lat, lon, alt);

    return NextResponse.json({
      success: true,
      data: context,
    });
  } catch (error) {
    console.error('Error getting position context:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get context' },
      { status: 500 }
    );
  }
}
