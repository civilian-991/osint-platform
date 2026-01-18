import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { FormationDetection } from '@/lib/types/ml';

interface FormationWithDetails extends FormationDetection {
  aircraft_details?: Array<{
    id: string;
    icao_hex: string;
    callsign: string | null;
    type_code: string | null;
    latitude: number;
    longitude: number;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';
    const formationType = searchParams.get('type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    let whereConditions = [];
    const params: (string | boolean | number)[] = [];
    let paramIndex = 1;

    if (activeOnly) {
      whereConditions.push(`is_active = $${paramIndex++}`);
      params.push(true);
    }

    if (formationType) {
      whereConditions.push(`formation_type = $${paramIndex++}`);
      params.push(formationType);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    params.push(limit);

    const formations = await query<FormationDetection>(
      `SELECT * FROM formation_detections
       ${whereClause}
       ORDER BY detected_at DESC
       LIMIT $${paramIndex}`,
      params
    );

    // Enrich with aircraft details
    const enrichedFormations: FormationWithDetails[] = await Promise.all(
      formations.map(async (formation) => {
        if (!formation.aircraft_ids || formation.aircraft_ids.length === 0) {
          return formation;
        }

        const aircraftDetails = await query<{
          id: string;
          icao_hex: string;
          callsign: string | null;
          type_code: string | null;
          latitude: number;
          longitude: number;
        }>(
          `SELECT a.id, a.icao_hex, p.callsign, a.type_code, p.latitude, p.longitude
           FROM aircraft a
           LEFT JOIN LATERAL (
             SELECT callsign, latitude, longitude
             FROM positions
             WHERE aircraft_id = a.id
             ORDER BY timestamp DESC
             LIMIT 1
           ) p ON true
           WHERE a.id = ANY($1)`,
          [formation.aircraft_ids]
        );

        return {
          ...formation,
          aircraft_details: aircraftDetails,
        };
      })
    );

    // Group by formation type for summary
    const byType: Record<string, number> = {};
    formations.forEach((f) => {
      byType[f.formation_type] = (byType[f.formation_type] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      data: enrichedFormations,
      count: enrichedFormations.length,
      summary: {
        byType,
        activeCount: formations.filter(f => f.is_active).length,
      },
    });
  } catch (error) {
    console.error('Error fetching formations:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
