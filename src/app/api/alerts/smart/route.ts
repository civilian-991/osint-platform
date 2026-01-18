import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { getServerSession } from '@/lib/auth/server';

interface SmartAlert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  data: Record<string, unknown>;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
  priority_score: number;
  relevance_score: number;
}

interface AlertsSummary {
  total: number;
  unread: number;
  critical: number;
  high: number;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const includeRead = searchParams.get('includeRead') === 'true';
    const severity = searchParams.get('severity');

    // Get user's alert model if it exists (only for authenticated users)
    let userModel = null;
    if (userId) {
      userModel = await queryOne<{
        preferred_types: Record<string, number>;
        preferred_regions: string[];
        preferred_aircraft_types: string[];
        activity_hours: number[];
      }>(
        `SELECT preferred_types, preferred_regions, preferred_aircraft_types, activity_hours
         FROM user_alert_models
         WHERE user_id = $1`,
        [userId]
      );
    }

    // Build base query conditions
    let conditions: string[] = [];
    const params: (string | boolean)[] = [];
    let paramIndex = 1;

    // Filter by user or show global alerts
    if (userId) {
      conditions.push(`(user_id = $${paramIndex} OR user_id IS NULL)`);
      params.push(userId);
      paramIndex++;
    } else {
      conditions.push(`user_id IS NULL`);
    }

    if (!includeRead) {
      conditions.push(`is_read = $${paramIndex++}`);
      params.push(false);
    }

    conditions.push(`is_dismissed = $${paramIndex++}`);
    params.push(false);

    if (severity) {
      conditions.push(`severity = $${paramIndex++}`);
      params.push(severity);
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

    // Fetch alerts with computed priority
    const alerts = await query<SmartAlert>(
      `SELECT
         a.*,
         -- Base priority by severity
         CASE
           WHEN severity = 'critical' THEN 1.0
           WHEN severity = 'high' THEN 0.8
           WHEN severity = 'medium' THEN 0.6
           WHEN severity = 'low' THEN 0.4
           ELSE 0.3
         END as priority_score,
         -- Time decay (more recent = higher)
         GREATEST(0.1, 1.0 - EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400) as recency_score
       FROM alerts a
       WHERE ${whereClause}
       ORDER BY
         is_read ASC,
         CASE severity
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           ELSE 4
         END,
         created_at DESC
       LIMIT $${paramIndex}`,
      [...params, limit.toString()]
    );

    // Apply user preferences if model exists
    const scoredAlerts = alerts.map(alert => {
      let relevance = 1.0;

      if (userModel) {
        // Boost by preferred type
        const typeWeight = userModel.preferred_types?.[alert.alert_type] || 0.5;
        relevance *= (0.5 + typeWeight);

        // Boost by preferred region if alert has location data
        const alertData = alert.data as { region?: string };
        if (alertData?.region && userModel.preferred_regions?.includes(alertData.region)) {
          relevance *= 1.3;
        }

        // Boost by preferred aircraft type
        const aircraftData = alert.data as { type_code?: string };
        if (aircraftData?.type_code && userModel.preferred_aircraft_types?.includes(aircraftData.type_code)) {
          relevance *= 1.2;
        }
      }

      return {
        ...alert,
        relevance_score: relevance,
        final_score: (alert.priority_score * 0.6 + relevance * 0.4),
      };
    });

    // Sort by final score
    scoredAlerts.sort((a, b) => b.final_score - a.final_score);

    // Get summary counts
    const summaryParams = userId ? [userId] : [];
    const summaryCondition = userId ? `(user_id = $1 OR user_id IS NULL)` : `user_id IS NULL`;

    const summary = await queryOne<{
      total: string;
      unread: string;
      critical: string;
      high: string;
    }>(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE is_read = false AND is_dismissed = false) as unread,
         COUNT(*) FILTER (WHERE severity = 'critical' AND is_dismissed = false) as critical,
         COUNT(*) FILTER (WHERE severity = 'high' AND is_dismissed = false) as high
       FROM alerts
       WHERE ${summaryCondition}`,
      summaryParams
    );

    return NextResponse.json({
      success: true,
      data: scoredAlerts,
      count: scoredAlerts.length,
      summary: {
        total: parseInt(summary?.total || '0'),
        unread: parseInt(summary?.unread || '0'),
        critical: parseInt(summary?.critical || '0'),
        high: parseInt(summary?.high || '0'),
      },
    });
  } catch (error) {
    console.error('Error fetching smart alerts:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Record interaction with alert
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { alertId, interactionType } = body;

    if (!alertId || !interactionType) {
      return NextResponse.json(
        { success: false, error: 'Missing alertId or interactionType' },
        { status: 400 }
      );
    }

    // Record the interaction
    await execute(
      `INSERT INTO alert_interactions (user_id, alert_id, interaction_type, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [userId, alertId, interactionType]
    );

    // Update alert status based on interaction type
    if (interactionType === 'read' || interactionType === 'viewed') {
      await execute(
        `UPDATE alerts SET is_read = true WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`,
        [alertId, userId]
      );
    } else if (interactionType === 'dismissed') {
      await execute(
        `UPDATE alerts SET is_dismissed = true WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`,
        [alertId, userId]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording alert interaction:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
