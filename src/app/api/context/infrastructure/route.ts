import { NextRequest, NextResponse } from 'next/server';
import { contextIntelligence } from '@/lib/services/context-intelligence';
import type { InfrastructureType } from '@/lib/types/context';

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

    // Parse types
    const typesParam = searchParams.get('types');
    const types = typesParam
      ? typesParam.split(',') as InfrastructureType[]
      : undefined;

    const infrastructure = await contextIntelligence.getInfrastructure(bounds, types);

    return NextResponse.json({
      success: true,
      data: infrastructure,
    });
  } catch (error) {
    console.error('Error getting infrastructure:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get infrastructure' },
      { status: 500 }
    );
  }
}
