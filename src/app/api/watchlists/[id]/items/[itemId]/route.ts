import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { getServerSession } from '@/lib/auth/server';
import type { WatchlistItem, WatchlistMatchType, WatchlistPriority } from '@/lib/types/watchlist';

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>;
}

const VALID_MATCH_TYPES: WatchlistMatchType[] = ['icao_hex', 'registration', 'callsign_pattern', 'type_code'];
const VALID_PRIORITIES: WatchlistPriority[] = ['low', 'medium', 'high', 'critical'];

async function verifyAccess(watchlistId: string, userId: string | undefined): Promise<boolean> {
  const result = await query(
    `SELECT id FROM watchlists WHERE id = $1 ${userId ? 'AND (user_id = $2 OR user_id IS NULL)' : ''}`,
    userId ? [watchlistId, userId] : [watchlistId]
  );
  return result.length > 0;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, itemId } = await params;
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    // Verify watchlist access
    if (!(await verifyAccess(id, userId))) {
      return NextResponse.json(
        { success: false, error: 'Watchlist not found or access denied' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { match_type, match_value, priority, notes, alert_on_detection } = body;

    const setClauses: string[] = [];
    const queryParams: (string | boolean | null)[] = [itemId, id];
    let paramIndex = 3;

    if (match_type !== undefined) {
      if (!VALID_MATCH_TYPES.includes(match_type)) {
        return NextResponse.json(
          { success: false, error: `Invalid match_type. Must be one of: ${VALID_MATCH_TYPES.join(', ')}` },
          { status: 400 }
        );
      }
      setClauses.push(`match_type = $${paramIndex}`);
      queryParams.push(match_type);
      paramIndex++;
    }

    if (match_value !== undefined) {
      if (typeof match_value !== 'string' || match_value.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'match_value cannot be empty' },
          { status: 400 }
        );
      }
      if (match_value.length > 50) {
        return NextResponse.json(
          { success: false, error: 'match_value must be 50 characters or less' },
          { status: 400 }
        );
      }
      setClauses.push(`match_value = $${paramIndex}`);
      queryParams.push(match_value.trim().toUpperCase());
      paramIndex++;
    }

    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return NextResponse.json(
          { success: false, error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` },
          { status: 400 }
        );
      }
      setClauses.push(`priority = $${paramIndex}`);
      queryParams.push(priority);
      paramIndex++;
    }

    if (notes !== undefined) {
      setClauses.push(`notes = $${paramIndex}`);
      queryParams.push(notes || null);
      paramIndex++;
    }

    if (alert_on_detection !== undefined) {
      setClauses.push(`alert_on_detection = $${paramIndex}`);
      queryParams.push(alert_on_detection);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const queryText = `
      UPDATE watchlist_items
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND watchlist_id = $2
      RETURNING *
    `;

    const result = await query<WatchlistItem>(queryText, queryParams);

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Watchlist item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    console.error('Error updating watchlist item:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, itemId } = await params;
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    // Verify watchlist access
    if (!(await verifyAccess(id, userId))) {
      return NextResponse.json(
        { success: false, error: 'Watchlist not found or access denied' },
        { status: 404 }
      );
    }

    const result = await execute(
      'DELETE FROM watchlist_items WHERE id = $1 AND watchlist_id = $2',
      [itemId, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Watchlist item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Watchlist item deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting watchlist item:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
