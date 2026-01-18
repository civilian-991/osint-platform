import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const minConfidence = searchParams.get('minConfidence');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const supabase = await createClient();

    let query = supabase
      .from('correlations')
      .select(`
        *,
        news_events (*),
        flights (*),
        aircraft (*)
      `)
      .order('confidence_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by status
    if (status) {
      query = query.eq('status', status);
    }

    // Filter by minimum confidence
    if (minConfidence) {
      query = query.gte('confidence_score', parseFloat(minConfidence));
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      count: data?.length || 0,
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

    const supabase = await createClient();

    // Get current user for verification tracking
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updateData.status = status;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (verified) {
      updateData.verified_by = user?.id;
      updateData.verified_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('correlations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error updating correlation:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
