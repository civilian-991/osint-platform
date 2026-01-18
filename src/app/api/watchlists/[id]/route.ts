import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { getServerSession } from '@/lib/auth/server';
import type { Watchlist, WatchlistWithItems, WatchlistItem } from '@/lib/types/watchlist';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    const { searchParams } = new URL(request.url);
    const includeItems = searchParams.get('includeItems') !== 'false';

    const watchlist = await query<Watchlist>(
      `SELECT * FROM watchlists WHERE id = $1 ${userId ? 'AND (user_id = $2 OR user_id IS NULL)' : ''}`,
      userId ? [id, userId] : [id]
    );

    if (watchlist.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Watchlist not found' },
        { status: 404 }
      );
    }

    if (includeItems) {
      const items = await query<WatchlistItem>(
        'SELECT * FROM watchlist_items WHERE watchlist_id = $1 ORDER BY priority DESC, created_at DESC',
        [id]
      );

      const watchlistWithItems: WatchlistWithItems = {
        ...watchlist[0],
        items,
      };

      return NextResponse.json({
        success: true,
        data: watchlistWithItems,
      });
    }

    return NextResponse.json({
      success: true,
      data: watchlist[0],
    });
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    const body = await request.json();
    const { name, description, is_active } = body;

    const setClauses: string[] = [];
    const queryParams: (string | boolean | null)[] = [id];
    let paramIndex = 2;

    if (userId) {
      queryParams.push(userId);
      paramIndex++;
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Name cannot be empty' },
          { status: 400 }
        );
      }
      if (name.length > 100) {
        return NextResponse.json(
          { success: false, error: 'Name must be 100 characters or less' },
          { status: 400 }
        );
      }
      setClauses.push(`name = $${paramIndex}`);
      queryParams.push(name.trim());
      paramIndex++;
    }

    if (description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      queryParams.push(description || null);
      paramIndex++;
    }

    if (is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex}`);
      queryParams.push(is_active);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const queryText = `
      UPDATE watchlists
      SET ${setClauses.join(', ')}
      WHERE id = $1 ${userId ? 'AND (user_id = $2 OR user_id IS NULL)' : ''}
      RETURNING *
    `;

    const result = await query<Watchlist>(queryText, queryParams);

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Watchlist not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    console.error('Error updating watchlist:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    const queryText = userId
      ? 'DELETE FROM watchlists WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)'
      : 'DELETE FROM watchlists WHERE id = $1';

    const result = await execute(queryText, userId ? [id, userId] : [id]);

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Watchlist not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Watchlist deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting watchlist:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
