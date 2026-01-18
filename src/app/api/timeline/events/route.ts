import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface TimelineEvent {
  event_id: string;
  event_type: 'news' | 'correlation' | 'strike';
  event_time: string;
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high';
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, unknown>;
}

/**
 * GET /api/timeline/events
 * Get timeline events (news, correlations, strikes) for a time range
 *
 * Query parameters:
 * - startTime: ISO timestamp for start of range
 * - endTime: ISO timestamp for end of range
 * - limit: Maximum number of events (default 100)
 * - types: Comma-separated event types to include (news,correlation,strike)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const typesParam = searchParams.get('types');

    // Validate required parameters
    if (!startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: 'startTime and endTime are required' },
        { status: 400 }
      );
    }

    // Validate timestamps
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid timestamp format' },
        { status: 400 }
      );
    }

    // Limit range to 7 days max for timeline
    const rangeMs = end.getTime() - start.getTime();
    if (rangeMs > 7 * 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { success: false, error: 'Time range cannot exceed 7 days' },
        { status: 400 }
      );
    }

    if (rangeMs < 0) {
      return NextResponse.json(
        { success: false, error: 'endTime must be after startTime' },
        { status: 400 }
      );
    }

    // Parse event types filter
    const allowedTypes = new Set(['news', 'correlation', 'strike']);
    const requestedTypes = typesParam
      ? typesParam.split(',').filter(t => allowedTypes.has(t.trim()))
      : Array.from(allowedTypes);

    // Fetch events
    const events = await query<TimelineEvent>(
      `SELECT * FROM get_timeline_events($1, $2, $3)`,
      [startTime, endTime, limit]
    );

    // Filter by requested types
    const filteredEvents = events.filter(e => requestedTypes.includes(e.event_type));

    // Group events by type for summary
    const byType = {
      news: filteredEvents.filter(e => e.event_type === 'news').length,
      correlation: filteredEvents.filter(e => e.event_type === 'correlation').length,
      strike: filteredEvents.filter(e => e.event_type === 'strike').length,
    };

    // Group events by severity
    const bySeverity = {
      high: filteredEvents.filter(e => e.severity === 'high').length,
      medium: filteredEvents.filter(e => e.severity === 'medium').length,
      low: filteredEvents.filter(e => e.severity === 'low').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        events: filteredEvents,
        summary: {
          total: filteredEvents.length,
          byType,
          bySeverity,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching timeline events:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
