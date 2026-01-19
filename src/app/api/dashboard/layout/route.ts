import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/server';
import { query, queryOne, execute } from '@/lib/db';
import type { DashboardLayout, DashboardLayoutInput } from '@/lib/types/dashboard';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.data?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get active layout for user
    const layout = await queryOne<DashboardLayout>(
      `SELECT * FROM dashboard_layouts
       WHERE user_id = $1 AND is_active = true
       ORDER BY is_default DESC
       LIMIT 1`,
      [session.data.user.id]
    );

    // If no layout exists, return default
    if (!layout) {
      const defaultLayout = await import('@/lib/types/dashboard').then(
        (m) => m.getDefaultLayout()
      );

      return NextResponse.json({
        success: true,
        data: {
          layout: defaultLayout,
          is_default: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: layout,
    });
  } catch (error) {
    console.error('Error getting dashboard layout:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get layout' },
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

    const body: DashboardLayoutInput = await request.json();

    if (!body.layout) {
      return NextResponse.json(
        { success: false, error: 'layout is required' },
        { status: 400 }
      );
    }

    // Check if user has existing layout
    const existing = await queryOne<DashboardLayout>(
      `SELECT id FROM dashboard_layouts
       WHERE user_id = $1 AND is_active = true
       LIMIT 1`,
      [session.data.user.id]
    );

    let layout: DashboardLayout | null;

    if (existing) {
      // Update existing
      layout = await queryOne<DashboardLayout>(
        `UPDATE dashboard_layouts
         SET layout = $1, name = $2, grid_columns = $3, row_height = $4, updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [
          JSON.stringify(body.layout),
          body.name || 'Default',
          body.grid_columns || 12,
          body.row_height || 50,
          existing.id,
        ]
      );
    } else {
      // Create new
      layout = await queryOne<DashboardLayout>(
        `INSERT INTO dashboard_layouts (
           user_id, name, layout, grid_columns, row_height, is_default
         )
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING *`,
        [
          session.data.user.id,
          body.name || 'Default',
          JSON.stringify(body.layout),
          body.grid_columns || 12,
          body.row_height || 50,
        ]
      );
    }

    return NextResponse.json({
      success: true,
      data: layout,
    });
  } catch (error) {
    console.error('Error updating dashboard layout:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update layout' },
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

    const body: DashboardLayoutInput = await request.json();

    if (!body.name || !body.layout) {
      return NextResponse.json(
        { success: false, error: 'name and layout are required' },
        { status: 400 }
      );
    }

    const layout = await queryOne<DashboardLayout>(
      `INSERT INTO dashboard_layouts (
         user_id, name, layout, grid_columns, row_height, is_default
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        session.data.user.id,
        body.name,
        JSON.stringify(body.layout),
        body.grid_columns || 12,
        body.row_height || 50,
        body.is_default || false,
      ]
    );

    return NextResponse.json({
      success: true,
      data: layout,
    });
  } catch (error) {
    console.error('Error creating dashboard layout:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create layout' },
      { status: 500 }
    );
  }
}
