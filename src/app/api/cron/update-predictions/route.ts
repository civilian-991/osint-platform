import { NextRequest, NextResponse } from 'next/server';
import { trajectoryPredictor } from '@/lib/services/trajectory-predictor';
import { proximityAnalyzer } from '@/lib/services/proximity-analyzer';

function verifyCronSecret(request: NextRequest): boolean {
  // Allow in development
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // Check Vercel cron header
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron === '1') {
    return true;
  }

  // Check CRON_SECRET
  const cronSecret = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && cronSecret === `Bearer ${expectedSecret}`) {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[CRON] Starting prediction update...');

    // Run trajectory predictions and proximity analysis in parallel
    const [trajectoryResult, proximityResult, validationResult, cleanupResult] = await Promise.all([
      trajectoryPredictor.predictAllActive(),
      proximityAnalyzer.analyzeAllProximity(),
      trajectoryPredictor.validatePredictions(),
      trajectoryPredictor.cleanupExpired(),
    ]);

    console.log('[CRON] Prediction update complete:', {
      trajectory: trajectoryResult,
      proximity: proximityResult,
      validation: validationResult,
      cleanup: cleanupResult,
    });

    return NextResponse.json({
      success: true,
      data: {
        trajectory: trajectoryResult,
        proximity: proximityResult,
        validation: validationResult,
        expired_cleaned: cleanupResult,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Prediction update error:', error);
    return NextResponse.json(
      { success: false, error: 'Prediction update failed' },
      { status: 500 }
    );
  }
}
