import { NextRequest, NextResponse } from 'next/server';
import { networkIntelligence } from '@/lib/services/network-intelligence';
import { networkGraphService } from '@/lib/services/network-graph';

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
    console.log('[CRON] Starting network update...');

    // Apply daily score decay
    const decayResult = await networkIntelligence.applyScoreDecay();

    // Infer relationships from co-occurrence data
    const inferResult = await networkIntelligence.inferRelationships();

    // Detect communities
    const communities = await networkGraphService.detectCommunities();

    // Get network stats
    const stats = await networkIntelligence.getStats();

    console.log('[CRON] Network update complete:', {
      decay: decayResult,
      inferred: inferResult,
      communities: communities.length,
      stats,
    });

    return NextResponse.json({
      success: true,
      data: {
        scores_decayed: decayResult,
        relationships_inferred: inferResult,
        communities_detected: communities.length,
        network_stats: stats,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Network update error:', error);
    return NextResponse.json(
      { success: false, error: 'Network update failed' },
      { status: 500 }
    );
  }
}
