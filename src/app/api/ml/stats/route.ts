import { NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db';

interface MLStats {
  queue: {
    pending: number;
    processing: number;
    completed_24h: number;
    failed_24h: number;
    byType: Record<string, number>;
  };
  anomalies: {
    total_24h: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  };
  intents: {
    total: number;
    byIntent: Record<string, number>;
  };
  threats: {
    total: number;
    byLevel: Record<string, number>;
    avgScore: number;
  };
  formations: {
    active: number;
    total_24h: number;
    byType: Record<string, number>;
  };
  profiles: {
    total: number;
    trained: number;
  };
  cache: {
    total: number;
    hitRate24h: number;
  };
}

export async function GET() {
  try {
    // Queue stats
    const queueStats = await queryOne<{
      pending: string;
      processing: string;
      completed_24h: string;
      failed_24h: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending') as pending,
         COUNT(*) FILTER (WHERE status = 'processing') as processing,
         COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as completed_24h,
         COUNT(*) FILTER (WHERE status = 'failed' AND updated_at > NOW() - INTERVAL '24 hours') as failed_24h
       FROM ml_processing_queue`
    );

    const queueByType = await query<{ task_type: string; count: string }>(
      `SELECT task_type, COUNT(*) as count
       FROM ml_processing_queue
       WHERE status = 'pending'
       GROUP BY task_type`
    );

    // Anomaly stats (last 24h)
    const anomalyStats = await queryOne<{
      total: string;
    }>(
      `SELECT COUNT(*) as total
       FROM anomaly_detections
       WHERE detected_at > NOW() - INTERVAL '24 hours'`
    );

    const anomalyBySeverity = await query<{ severity_bucket: string; count: string }>(
      `SELECT
         CASE
           WHEN severity >= 0.8 THEN 'critical'
           WHEN severity >= 0.6 THEN 'high'
           WHEN severity >= 0.4 THEN 'medium'
           ELSE 'low'
         END as severity_bucket,
         COUNT(*) as count
       FROM anomaly_detections
       WHERE detected_at > NOW() - INTERVAL '24 hours'
       GROUP BY severity_bucket`
    );

    const anomalyByType = await query<{ anomaly_type: string; count: string }>(
      `SELECT anomaly_type, COUNT(*) as count
       FROM anomaly_detections
       WHERE detected_at > NOW() - INTERVAL '24 hours'
       GROUP BY anomaly_type`
    );

    // Intent stats
    const intentStats = await queryOne<{ total: string }>(
      `SELECT COUNT(DISTINCT aircraft_id) as total
       FROM intent_classifications`
    );

    const intentByType = await query<{ intent: string; count: string }>(
      `SELECT intent, COUNT(*) as count
       FROM intent_classifications
       WHERE created_at > NOW() - INTERVAL '24 hours'
       GROUP BY intent`
    );

    // Threat stats
    const threatStats = await queryOne<{ total: string; avg_score: string }>(
      `SELECT COUNT(*) as total, AVG(overall_score) as avg_score
       FROM threat_assessments
       WHERE assessed_at > NOW() - INTERVAL '24 hours'`
    );

    const threatByLevel = await query<{ threat_level: string; count: string }>(
      `SELECT threat_level, COUNT(*) as count
       FROM threat_assessments
       WHERE assessed_at > NOW() - INTERVAL '24 hours'
       GROUP BY threat_level`
    );

    // Formation stats
    const formationStats = await queryOne<{ active: string; total_24h: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE is_active = true) as active,
         COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '24 hours') as total_24h
       FROM formation_detections`
    );

    const formationByType = await query<{ formation_type: string; count: string }>(
      `SELECT formation_type, COUNT(*) as count
       FROM formation_detections
       WHERE is_active = true
       GROUP BY formation_type`
    );

    // Profile stats
    const profileStats = await queryOne<{ total: string; trained: string }>(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE sample_count >= 10) as trained
       FROM aircraft_behavioral_profiles`
    );

    // Cache stats
    const cacheStats = await queryOne<{ total: string }>(
      `SELECT COUNT(*) as total
       FROM gemini_cache
       WHERE expires_at > NOW()`
    );

    const stats: MLStats = {
      queue: {
        pending: parseInt(queueStats?.pending || '0'),
        processing: parseInt(queueStats?.processing || '0'),
        completed_24h: parseInt(queueStats?.completed_24h || '0'),
        failed_24h: parseInt(queueStats?.failed_24h || '0'),
        byType: Object.fromEntries(
          queueByType.map(r => [r.task_type, parseInt(r.count)])
        ),
      },
      anomalies: {
        total_24h: parseInt(anomalyStats?.total || '0'),
        bySeverity: Object.fromEntries(
          anomalyBySeverity.map(r => [r.severity_bucket, parseInt(r.count)])
        ),
        byType: Object.fromEntries(
          anomalyByType.map(r => [r.anomaly_type, parseInt(r.count)])
        ),
      },
      intents: {
        total: parseInt(intentStats?.total || '0'),
        byIntent: Object.fromEntries(
          intentByType.map(r => [r.intent, parseInt(r.count)])
        ),
      },
      threats: {
        total: parseInt(threatStats?.total || '0'),
        byLevel: Object.fromEntries(
          threatByLevel.map(r => [r.threat_level, parseInt(r.count)])
        ),
        avgScore: parseFloat(threatStats?.avg_score || '0'),
      },
      formations: {
        active: parseInt(formationStats?.active || '0'),
        total_24h: parseInt(formationStats?.total_24h || '0'),
        byType: Object.fromEntries(
          formationByType.map(r => [r.formation_type, parseInt(r.count)])
        ),
      },
      profiles: {
        total: parseInt(profileStats?.total || '0'),
        trained: parseInt(profileStats?.trained || '0'),
      },
      cache: {
        total: parseInt(cacheStats?.total || '0'),
        hitRate24h: 0, // Would need to track this separately
      },
    };

    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching ML stats:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
