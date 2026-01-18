import { NextRequest, NextResponse } from 'next/server';
import { behavioralProfiler } from '@/lib/services/behavioral-profiler';

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  if (!cronSecret) {
    console.warn('CRON_SECRET not set');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check if ML processing is enabled
  if (process.env.ENABLE_ML_PROCESSING !== 'true') {
    return NextResponse.json({
      success: true,
      message: 'ML processing is disabled',
      updated: 0,
    });
  }

  try {
    // Update profiles from flights in the last 24 hours
    const updatedCount = await behavioralProfiler.batchUpdateFromFlights(24);

    // Get profile statistics
    const stats = await behavioralProfiler.getStats();

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} behavioral profiles`,
      stats: {
        profilesUpdated: updatedCount,
        totalProfiles: stats.total_profiles,
        trainedProfiles: stats.trained_profiles,
        avgSampleCount: Math.round(stats.avg_sample_count * 100) / 100,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in update-profiles cron:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Support POST for Vercel cron
export async function POST(request: NextRequest) {
  return GET(request);
}
