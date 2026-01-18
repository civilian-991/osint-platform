import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/server';
import {
  getGeofenceAlerts,
  markAlertRead,
  markAllAlertsRead,
  dismissAlert,
} from '@/lib/services/geofence-monitor';

/**
 * GET /api/geofences/alerts
 * Get geofence alerts for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const geofenceId = searchParams.get('geofenceId') || undefined;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await getGeofenceAlerts(userId, {
      geofenceId,
      unreadOnly,
      limit: Math.min(limit, 100),
      offset,
    });

    return NextResponse.json({
      success: true,
      data: result.alerts,
      total: result.total,
      unread_count: result.unread_count,
    });
  } catch (error) {
    console.error('Error fetching geofence alerts:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/geofences/alerts
 * Mark alerts as read or dismissed
 */
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
    const { action, alertId } = body;

    if (!action || !['mark_read', 'mark_all_read', 'dismiss'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use: mark_read, mark_all_read, or dismiss' },
        { status: 400 }
      );
    }

    if (action === 'mark_all_read') {
      const count = await markAllAlertsRead(userId);
      return NextResponse.json({
        success: true,
        message: `Marked ${count} alerts as read`,
        count,
      });
    }

    if (!alertId) {
      return NextResponse.json(
        { success: false, error: 'Alert ID is required' },
        { status: 400 }
      );
    }

    if (action === 'mark_read') {
      const success = await markAlertRead(alertId, userId);
      if (!success) {
        return NextResponse.json(
          { success: false, error: 'Alert not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: 'Alert marked as read',
      });
    }

    if (action === 'dismiss') {
      const success = await dismissAlert(alertId, userId);
      if (!success) {
        return NextResponse.json(
          { success: false, error: 'Alert not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: 'Alert dismissed',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating geofence alert:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
