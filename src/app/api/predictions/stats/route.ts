import { NextRequest, NextResponse } from 'next/server';
import { trajectoryPredictor } from '@/lib/services/trajectory-predictor';
import { proximityAnalyzer } from '@/lib/services/proximity-analyzer';

export async function GET(request: NextRequest) {
  try {
    const [trajectoryStats, proximityStats] = await Promise.all([
      trajectoryPredictor.getAccuracyStats(),
      proximityAnalyzer.getStats(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        trajectory: {
          accuracy_stats: trajectoryStats,
        },
        proximity: proximityStats,
      },
    });
  } catch (error) {
    console.error('Error getting prediction stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}
