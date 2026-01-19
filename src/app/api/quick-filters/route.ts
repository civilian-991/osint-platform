import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/server';
import { query, queryOne, execute } from '@/lib/db';
import type { QuickFilterPreset, FilterCategory } from '@/lib/types/dashboard';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as FilterCategory | null;

    let whereClause = 'WHERE is_active = true';
    const params: unknown[] = [];
    let paramIndex = 1;

    // Include system presets and user's own presets
    if (session?.data?.user?.id) {
      whereClause += ` AND (user_id IS NULL OR user_id = $${paramIndex++})`;
      params.push(session.data.user.id);
    } else {
      whereClause += ' AND user_id IS NULL';
    }

    if (category) {
      whereClause += ` AND category = $${paramIndex}`;
      params.push(category);
    }

    const presets = await query<QuickFilterPreset>(
      `SELECT * FROM quick_filter_presets
       ${whereClause}
       ORDER BY user_id NULLS FIRST, position ASC, name ASC`,
      params
    );

    return NextResponse.json({
      success: true,
      data: presets,
    });
  } catch (error) {
    console.error('Error getting quick filters:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get filters' },
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

    const body = await request.json();

    if (!body.name || !body.category || !body.filters || !body.label) {
      return NextResponse.json(
        { success: false, error: 'name, category, filters, and label are required' },
        { status: 400 }
      );
    }

    const preset = await queryOne<QuickFilterPreset>(
      `INSERT INTO quick_filter_presets (
         user_id, name, category, filters, label, icon, color, position
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        session.data.user.id,
        body.name,
        body.category,
        JSON.stringify(body.filters),
        body.label,
        body.icon || null,
        body.color || null,
        body.position || 99,
      ]
    );

    return NextResponse.json({
      success: true,
      data: preset,
    });
  } catch (error) {
    console.error('Error creating quick filter:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create filter' },
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

    // Can only delete user's own presets, not system ones
    const result = await execute(
      `DELETE FROM quick_filter_presets
       WHERE id = $1 AND user_id = $2`,
      [id, session.data.user.id]
    );

    return NextResponse.json({
      success: result.rowCount > 0,
      message: result.rowCount > 0 ? 'Deleted' : 'Not found or cannot delete system preset',
    });
  } catch (error) {
    console.error('Error deleting quick filter:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete filter' },
      { status: 500 }
    );
  }
}
