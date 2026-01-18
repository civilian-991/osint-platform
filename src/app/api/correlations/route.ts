import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getServerSession } from '@/lib/auth/server';

interface CorrelationWithRelations {
  id: string;
  news_event_id: string;
  flight_id: string | null;
  aircraft_id: string | null;
  correlation_type: string;
  confidence_score: number;
  temporal_proximity: number | null;
  spatial_proximity: number | null;
  evidence: Record<string, unknown>;
  status: string;
  notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  news_event?: Record<string, unknown>;
  flight?: Record<string, unknown>;
  aircraft?: Record<string, unknown>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const minConfidence = searchParams.get('minConfidence');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let queryText = `
      SELECT
        c.*,
        row_to_json(n) as news_event,
        row_to_json(f) as flight,
        row_to_json(a) as aircraft
      FROM correlations c
      LEFT JOIN news_events n ON c.news_event_id = n.id
      LEFT JOIN flights f ON c.flight_id = f.id
      LEFT JOIN aircraft a ON c.aircraft_id = a.id
      WHERE 1=1
      ${status ? 'AND c.status = $1' : ''}
      ${minConfidence ? `AND c.confidence_score >= ${status ? '$2' : '$1'}` : ''}
      ORDER BY c.confidence_score DESC, c.created_at DESC
      LIMIT ${status && minConfidence ? '$3' : status || minConfidence ? '$2' : '$1'}
    `;

    const params: (string | number)[] = [];
    if (status) params.push(status);
    if (minConfidence) params.push(parseFloat(minConfidence));
    params.push(limit);

    const data = await query<CorrelationWithRelations>(queryText, params);

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    console.error('Error in correlations API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, notes, verified } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing correlation ID' },
        { status: 400 }
      );
    }

    // Get current user from Neon Auth for verification tracking
    const session = await getServerSession();
    const user = session?.data?.user;

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: (string | null)[] = [id];
    let paramIndex = 2;

    if (status) {
      setClauses.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (notes !== undefined) {
      setClauses.push(`notes = $${paramIndex}`);
      params.push(notes);
      paramIndex++;
    }

    if (verified && user) {
      setClauses.push(`verified_by = $${paramIndex}`);
      params.push(user.id);
      paramIndex++;
      setClauses.push(`verified_at = NOW()`);
    }

    const queryText = `
      UPDATE correlations
      SET ${setClauses.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await query<CorrelationWithRelations>(queryText, params);

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Correlation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    console.error('Error updating correlation:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
