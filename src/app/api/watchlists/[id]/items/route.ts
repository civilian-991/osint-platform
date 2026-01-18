import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getServerSession } from '@/lib/auth/server';
import type { WatchlistItem, WatchlistMatchType, WatchlistPriority } from '@/lib/types/watchlist';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_MATCH_TYPES: WatchlistMatchType[] = ['icao_hex', 'registration', 'callsign_pattern', 'type_code'];
const VALID_PRIORITIES: WatchlistPriority[] = ['low', 'medium', 'high', 'critical'];

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    // Verify watchlist access
    const watchlistCheck = await query(
      `SELECT id FROM watchlists WHERE id = $1 ${userId ? 'AND (user_id = $2 OR user_id IS NULL)' : ''}`,
      userId ? [id, userId] : [id]
    );

    if (watchlistCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Watchlist not found or access denied' },
        { status: 404 }
      );
    }

    const items = await query<WatchlistItem>(
      'SELECT * FROM watchlist_items WHERE watchlist_id = $1 ORDER BY priority DESC, created_at DESC',
      [id]
    );

    return NextResponse.json({
      success: true,
      data: items,
      count: items.length,
    });
  } catch (error) {
    console.error('Error fetching watchlist items:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    // Verify watchlist access
    const watchlistCheck = await query(
      `SELECT id FROM watchlists WHERE id = $1 ${userId ? 'AND (user_id = $2 OR user_id IS NULL)' : ''}`,
      userId ? [id, userId] : [id]
    );

    if (watchlistCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Watchlist not found or access denied' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { match_type, match_value, priority, notes, alert_on_detection } = body;

    // Validate match_type
    if (!match_type || !VALID_MATCH_TYPES.includes(match_type)) {
      return NextResponse.json(
        { success: false, error: `Invalid match_type. Must be one of: ${VALID_MATCH_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate match_value
    if (!match_value || typeof match_value !== 'string' || match_value.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'match_value is required' },
        { status: 400 }
      );
    }

    if (match_value.length > 50) {
      return NextResponse.json(
        { success: false, error: 'match_value must be 50 characters or less' },
        { status: 400 }
      );
    }

    // Validate priority if provided
    const validPriority = priority && VALID_PRIORITIES.includes(priority) ? priority : 'medium';

    // Check for duplicates
    const existingItem = await query(
      'SELECT id FROM watchlist_items WHERE watchlist_id = $1 AND match_type = $2 AND UPPER(match_value) = UPPER($3)',
      [id, match_type, match_value.trim()]
    );

    if (existingItem.length > 0) {
      return NextResponse.json(
        { success: false, error: 'An item with this match type and value already exists in this watchlist' },
        { status: 409 }
      );
    }

    const queryText = `
      INSERT INTO watchlist_items (watchlist_id, match_type, match_value, priority, notes, alert_on_detection)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await query<WatchlistItem>(queryText, [
      id,
      match_type,
      match_value.trim().toUpperCase(),
      validPriority,
      notes || null,
      alert_on_detection !== false,
    ]);

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    console.error('Error creating watchlist item:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
