import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { exportService } from '@/lib/services/export';
import type { CorrelationWithRelations } from '@/lib/types/correlation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'csv') as 'csv' | 'json';
    const status = searchParams.get('status');
    const minConfidence = parseFloat(searchParams.get('minConfidence') || '0');
    const limit = parseInt(searchParams.get('limit') || '1000', 10);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query
    let queryText = `
      SELECT
        c.*,
        json_build_object(
          'id', ne.id,
          'title', ne.title,
          'source', ne.source,
          'published_at', ne.published_at
        ) as news_event,
        json_build_object(
          'id', a.id,
          'icao_hex', a.icao_hex,
          'registration', a.registration,
          'type_code', a.type_code,
          'operator', a.operator,
          'is_military', a.is_military,
          'military_category', a.military_category
        ) as aircraft,
        json_build_object(
          'id', f.id,
          'callsign', f.callsign,
          'departure_time', f.departure_time,
          'arrival_time', f.arrival_time
        ) as flight
      FROM correlations c
      LEFT JOIN news_events ne ON c.news_event_id = ne.id
      LEFT JOIN aircraft a ON c.aircraft_id = a.id
      LEFT JOIN flights f ON c.flight_id = f.id
      WHERE 1=1
    `;

    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (status) {
      queryText += ` AND c.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (minConfidence > 0) {
      queryText += ` AND c.confidence_score >= $${paramIndex}`;
      params.push(minConfidence);
      paramIndex++;
    }

    if (startDate) {
      queryText += ` AND c.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      queryText += ` AND c.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    queryText += ` ORDER BY c.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const correlations = await query<CorrelationWithRelations>(queryText, params);

    // Generate export
    const content = exportService.exportCorrelations(correlations, { format });

    // Set headers for file download
    const contentType = format === 'json' ? 'application/json' : 'text/csv';
    const filename = `correlations_${new Date().toISOString().split('T')[0]}.${format}`;

    return new NextResponse(content, {
      headers: {
        'Content-Type': `${contentType}; charset=utf-8`,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting correlations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export correlations' },
      { status: 500 }
    );
  }
}
