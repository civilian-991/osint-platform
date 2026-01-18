import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { exportService } from '@/lib/services/export';

interface AircraftExportRow {
  icao_hex: string;
  registration: string | null;
  callsign: string | null;
  type_code: string | null;
  type_description: string | null;
  operator: string | null;
  is_military: boolean;
  military_category: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  ground_speed: number | null;
  track: number | null;
  timestamp: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'csv') as 'csv' | 'json';
    const military = searchParams.get('military');
    const limit = parseInt(searchParams.get('limit') || '1000', 10);
    const includePositions = searchParams.get('includePositions') !== 'false';

    let queryText: string;
    const params: (string | number | boolean)[] = [];
    let paramIndex = 1;

    if (includePositions) {
      // Export with latest positions
      queryText = `
        SELECT
          a.icao_hex,
          a.registration,
          pl.callsign,
          a.type_code,
          a.type_description,
          a.operator,
          a.is_military,
          a.military_category,
          pl.latitude,
          pl.longitude,
          pl.altitude,
          pl.ground_speed,
          pl.track,
          COALESCE(pl.timestamp, a.updated_at) as timestamp
        FROM aircraft a
        LEFT JOIN positions_latest pl ON a.icao_hex = pl.icao_hex
        WHERE 1=1
      `;
    } else {
      // Export aircraft only
      queryText = `
        SELECT
          icao_hex,
          registration,
          NULL as callsign,
          type_code,
          type_description,
          operator,
          is_military,
          military_category,
          NULL as latitude,
          NULL as longitude,
          NULL as altitude,
          NULL as ground_speed,
          NULL as track,
          updated_at as timestamp
        FROM aircraft
        WHERE 1=1
      `;
    }

    if (military === 'true') {
      queryText += ` AND a.is_military = true`;
    } else if (military === 'false') {
      queryText += ` AND a.is_military = false`;
    }

    queryText += ` ORDER BY timestamp DESC NULLS LAST LIMIT $${paramIndex}`;
    params.push(limit);

    const aircraft = await query<AircraftExportRow>(queryText, params);

    // Generate export
    const content = exportService.exportAircraft(aircraft as unknown as Parameters<typeof exportService.exportAircraft>[0], { format });

    // Set headers for file download
    const contentType = format === 'json' ? 'application/json' : 'text/csv';
    const filename = `aircraft_${new Date().toISOString().split('T')[0]}.${format}`;

    return new NextResponse(content, {
      headers: {
        'Content-Type': `${contentType}; charset=utf-8`,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting aircraft:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export aircraft' },
      { status: 500 }
    );
  }
}
