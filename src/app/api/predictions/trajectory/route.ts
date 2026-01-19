import { NextRequest, NextResponse } from 'next/server';
import { trajectoryPredictor } from '@/lib/services/trajectory-predictor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const aircraftId = searchParams.get('aircraftId');
    const icaoHex = searchParams.get('icaoHex');

    if (!aircraftId && !icaoHex) {
      return NextResponse.json(
        { success: false, error: 'aircraftId or icaoHex is required' },
        { status: 400 }
      );
    }

    let predictions;
    if (aircraftId) {
      predictions = await trajectoryPredictor.getPredictions(aircraftId);
    } else if (icaoHex) {
      predictions = await trajectoryPredictor.getPredictionsByIcao(icaoHex);
    }

    return NextResponse.json({
      success: true,
      data: predictions,
    });
  } catch (error) {
    console.error('Error getting trajectory predictions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get predictions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      aircraft_id,
      icao_hex,
      latitude,
      longitude,
      altitude,
      heading,
      ground_speed,
      turn_rate,
      vertical_rate,
    } = body;

    if (!aircraft_id || !icao_hex || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const predictions = await trajectoryPredictor.predictTrajectory({
      aircraft_id,
      icao_hex,
      latitude,
      longitude,
      altitude: altitude ?? null,
      heading: heading ?? null,
      ground_speed: ground_speed ?? null,
      turn_rate: turn_rate ?? null,
      vertical_rate: vertical_rate ?? null,
    });

    return NextResponse.json({
      success: true,
      data: predictions,
    });
  } catch (error) {
    console.error('Error creating trajectory prediction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create prediction' },
      { status: 500 }
    );
  }
}
