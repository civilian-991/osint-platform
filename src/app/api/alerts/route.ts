import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { getServerSession } from '@/lib/auth/server';
import type { Alert } from '@/lib/types/correlation';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Build query - if user is authenticated, filter by user_id
    // If no user, return all alerts (for demo/testing)
    let queryText = `
      SELECT * FROM alerts
      WHERE is_dismissed = false
      ${userId ? 'AND (user_id = $1 OR user_id IS NULL)' : ''}
      ${unreadOnly ? `AND is_read = false` : ''}
      ORDER BY created_at DESC
      LIMIT ${userId ? '$2' : '$1'}
    `;

    const params = userId ? [userId, limit] : [limit];
    const data = await query<Alert>(queryText, params);

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
      unreadCount: data.filter((a) => !a.is_read).length,
    });
  } catch (error) {
    console.error('Error in alerts API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    const body = await request.json();
    const { id, is_read, is_dismissed, mark_all_read } = body;

    // Mark all as read
    if (mark_all_read) {
      const queryText = userId
        ? `UPDATE alerts SET is_read = true WHERE (user_id = $1 OR user_id IS NULL) AND is_read = false`
        : `UPDATE alerts SET is_read = true WHERE is_read = false`;

      await execute(queryText, userId ? [userId] : []);

      return NextResponse.json({ success: true });
    }

    // Update single alert
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing alert ID' },
        { status: 400 }
      );
    }

    const setClauses: string[] = [];
    const params: (string | boolean)[] = [id];
    let paramIndex = 2;

    if (is_read !== undefined) {
      setClauses.push(`is_read = $${paramIndex}`);
      params.push(is_read);
      paramIndex++;
    }

    if (is_dismissed !== undefined) {
      setClauses.push(`is_dismissed = $${paramIndex}`);
      params.push(is_dismissed);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const queryText = `
      UPDATE alerts
      SET ${setClauses.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await query<Alert>(queryText, params);

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    console.error('Error updating alert:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { alert_type, severity, title, description, data, correlation_id, user_id } = body;

    if (!alert_type || !title) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: alert_type, title' },
        { status: 400 }
      );
    }

    const queryText = `
      INSERT INTO alerts (user_id, correlation_id, alert_type, severity, title, description, data)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await query<Alert>(queryText, [
      user_id || null,
      correlation_id || null,
      alert_type,
      severity || 'medium',
      title,
      description || null,
      data || {},
    ]);

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    console.error('Error creating alert:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
