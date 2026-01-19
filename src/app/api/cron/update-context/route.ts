import { NextRequest, NextResponse } from 'next/server';
import { contextIntelligence } from '@/lib/services/context-intelligence';

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
    console.log('[CRON] Starting context update...');

    // Update activity zones based on recent position data
    const zonesResult = await contextIntelligence.updateActivityZones();

    console.log('[CRON] Context update complete:', zonesResult);

    return NextResponse.json({
      success: true,
      data: {
        activity_zones: zonesResult,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Context update error:', error);
    return NextResponse.json(
      { success: false, error: 'Context update failed' },
      { status: 500 }
    );
  }
}
