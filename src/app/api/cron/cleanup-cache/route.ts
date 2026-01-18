import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { geminiClient } from '@/lib/services/gemini-client';

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

  try {
    // Clean expired Gemini cache
    const deletedCacheEntries = await geminiClient.cleanExpiredCache();

    // Get cache stats
    const cacheStats = await geminiClient.getCacheStats();

    // Clean old completed/failed ML tasks (older than 7 days)
    const deletedTasksResult = await queryOne<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM ml_processing_queue
         WHERE status IN ('completed', 'failed')
         AND completed_at < NOW() - INTERVAL '7 days'
         RETURNING id
       )
       SELECT COUNT(*) as count FROM deleted`
    );
    const deletedTasks = parseInt(deletedTasksResult?.count || '0', 10);

    // Clean old alert interactions (older than 90 days)
    const deletedInteractionsResult = await queryOne<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM alert_interactions
         WHERE created_at < NOW() - INTERVAL '90 days'
         RETURNING id
       )
       SELECT COUNT(*) as count FROM deleted`
    );
    const deletedInteractions = parseInt(deletedInteractionsResult?.count || '0', 10);

    // Clean old acknowledged anomalies (older than 30 days)
    const deletedAnomaliesResult = await queryOne<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM anomaly_detections
         WHERE is_acknowledged = TRUE
         AND created_at < NOW() - INTERVAL '30 days'
         RETURNING id
       )
       SELECT COUNT(*) as count FROM deleted`
    );
    const deletedAnomalies = parseInt(deletedAnomaliesResult?.count || '0', 10);

    // Clean old inactive formations (older than 7 days)
    const deletedFormationsResult = await queryOne<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM formation_detections
         WHERE is_active = FALSE
         AND last_seen_at < NOW() - INTERVAL '7 days'
         RETURNING id
       )
       SELECT COUNT(*) as count FROM deleted`
    );
    const deletedFormations = parseInt(deletedFormationsResult?.count || '0', 10);

    return NextResponse.json({
      success: true,
      message: 'Cache and old data cleanup completed',
      stats: {
        deletedCacheEntries,
        deletedTasks,
        deletedInteractions,
        deletedAnomalies,
        deletedFormations,
        cacheStats: {
          totalEntries: cacheStats.total_entries,
          totalHits: cacheStats.total_hits,
          avgHits: Math.round(cacheStats.avg_hits * 100) / 100,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in cleanup-cache cron:', error);
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
