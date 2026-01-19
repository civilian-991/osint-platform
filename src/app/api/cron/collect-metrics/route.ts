import { NextRequest, NextResponse } from 'next/server';
import { metricsService } from '@/lib/services/metrics-service';

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
    console.log('[CRON] Starting metrics collection...');

    // Collect metrics for yesterday (to ensure complete data)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const metrics = await metricsService.collectDailyMetrics(yesterday);

    console.log('[CRON] Metrics collection complete:', {
      date: yesterday.toISOString().split('T')[0],
      collected: !!metrics,
    });

    return NextResponse.json({
      success: true,
      data: {
        date: yesterday.toISOString().split('T')[0],
        metrics: metrics ? {
          total_aircraft: metrics.total_aircraft,
          unique_aircraft: metrics.unique_aircraft,
          military_aircraft: metrics.military_aircraft,
          formations_detected: metrics.formations_detected,
          anomalies_detected: metrics.anomalies_detected,
          alerts_generated: metrics.alerts_generated,
        } : null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Metrics collection error:', error);
    return NextResponse.json(
      { success: false, error: 'Metrics collection failed' },
      { status: 500 }
    );
  }
}
