import { NextRequest, NextResponse } from 'next/server';
import { contextIntelligence } from '@/lib/services/context-intelligence';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse bounds
    const north = searchParams.get('north') ? parseFloat(searchParams.get('north')!) : undefined;
    const south = searchParams.get('south') ? parseFloat(searchParams.get('south')!) : undefined;
    const east = searchParams.get('east') ? parseFloat(searchParams.get('east')!) : undefined;
    const west = searchParams.get('west') ? parseFloat(searchParams.get('west')!) : undefined;

    const bounds = north && south && east && west
      ? { north, south, east, west }
      : undefined;

    const zones = await contextIntelligence.getActivityZones(bounds);

    return NextResponse.json({
      success: true,
      data: zones,
    });
  } catch (error) {
    console.error('Error getting activity zones:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get zones' },
      { status: 500 }
    );
  }
}
