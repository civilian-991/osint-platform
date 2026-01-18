import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getServerSession } from '@/lib/auth/server';
import type { Watchlist, WatchlistWithItems, WatchlistItem } from '@/lib/types/watchlist';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    const { searchParams } = new URL(request.url);
    const includeItems = searchParams.get('includeItems') === 'true';
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    let queryText = `
      SELECT * FROM watchlists
      WHERE 1=1
      ${userId ? 'AND (user_id = $1 OR user_id IS NULL)' : ''}
      ${activeOnly ? 'AND is_active = true' : ''}
      ORDER BY created_at DESC
    `;

    const params = userId ? [userId] : [];
    const watchlists = await query<Watchlist>(queryText, params);

    if (includeItems) {
      const watchlistsWithItems: WatchlistWithItems[] = await Promise.all(
        watchlists.map(async (watchlist) => {
          const items = await query<WatchlistItem>(
            'SELECT * FROM watchlist_items WHERE watchlist_id = $1 ORDER BY priority DESC, created_at DESC',
            [watchlist.id]
          );
          return { ...watchlist, items };
        })
      );

      return NextResponse.json({
        success: true,
        data: watchlistsWithItems,
        count: watchlistsWithItems.length,
      });
    }

    return NextResponse.json({
      success: true,
      data: watchlists,
      count: watchlists.length,
    });
  } catch (error) {
    console.error('Error fetching watchlists:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    const body = await request.json();
    const { name, description, is_active } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Name must be 100 characters or less' },
        { status: 400 }
      );
    }

    const queryText = `
      INSERT INTO watchlists (user_id, name, description, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await query<Watchlist>(queryText, [
      userId || null,
      name.trim(),
      description || null,
      is_active !== false,
    ]);

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    console.error('Error creating watchlist:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
