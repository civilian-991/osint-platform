import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/server';
import { query, queryOne, execute } from '@/lib/db';
import type { SavedSearch, SavedSearchInput } from '@/lib/types/dashboard';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.data?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder');
    const pinnedOnly = searchParams.get('pinned') === 'true';

    let whereClause = 'WHERE user_id = $1';
    const params: unknown[] = [session.data.user.id];
    let paramIndex = 2;

    if (folder) {
      whereClause += ` AND folder = $${paramIndex}`;
      params.push(folder);
      paramIndex++;
    }

    if (pinnedOnly) {
      whereClause += ' AND is_pinned = true';
    }

    const searches = await query<SavedSearch>(
      `SELECT * FROM saved_searches
       ${whereClause}
       ORDER BY is_pinned DESC, position ASC, last_used_at DESC NULLS LAST`,
      params
    );

    return NextResponse.json({
      success: true,
      data: searches,
    });
  } catch (error) {
    console.error('Error getting saved searches:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get saved searches' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.data?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: SavedSearchInput = await request.json();

    if (!body.name || !body.filters) {
      return NextResponse.json(
        { success: false, error: 'name and filters are required' },
        { status: 400 }
      );
    }

    const search = await queryOne<SavedSearch>(
      `INSERT INTO saved_searches (
         user_id, name, description, filters,
         sort_by, sort_order, view_mode,
         folder, color, icon, is_pinned
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        session.data.user.id,
        body.name,
        body.description || null,
        JSON.stringify(body.filters),
        body.sort_by || null,
        body.sort_order || 'desc',
        body.view_mode || 'list',
        body.folder || null,
        body.color || null,
        body.icon || null,
        body.is_pinned || false,
      ]
    );

    return NextResponse.json({
      success: true,
      data: search,
    });
  } catch (error) {
    console.error('Error creating saved search:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create saved search' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.data?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    // Build update query dynamically
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.filters !== undefined) {
      fields.push(`filters = $${paramIndex++}`);
      values.push(JSON.stringify(updates.filters));
    }
    if (updates.is_pinned !== undefined) {
      fields.push(`is_pinned = $${paramIndex++}`);
      values.push(updates.is_pinned);
    }
    if (updates.folder !== undefined) {
      fields.push(`folder = $${paramIndex++}`);
      values.push(updates.folder);
    }

    if (fields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    values.push(id, session.data.user.id);

    const search = await queryOne<SavedSearch>(
      `UPDATE saved_searches
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (!search) {
      return NextResponse.json(
        { success: false, error: 'Search not found or unauthorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: search,
    });
  } catch (error) {
    console.error('Error updating saved search:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update saved search' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.data?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const result = await execute(
      `DELETE FROM saved_searches
       WHERE id = $1 AND user_id = $2`,
      [id, session.data.user.id]
    );

    return NextResponse.json({
      success: result.rowCount > 0,
      message: result.rowCount > 0 ? 'Deleted' : 'Not found',
    });
  } catch (error) {
    console.error('Error deleting saved search:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete saved search' },
      { status: 500 }
    );
  }
}
