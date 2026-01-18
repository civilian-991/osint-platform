import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import type {
  AnomalyDetection,
  IntentClassification,
  ThreatAssessment,
  FormationDetection,
  BehavioralProfile,
} from '@/lib/types/ml';

interface MLData {
  anomalies: AnomalyDetection[];
  intent: IntentClassification | null;
  threat: ThreatAssessment | null;
  formations: FormationDetection[];
  profile: BehavioralProfile | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get recent anomalies for this aircraft (last 24 hours)
    const anomalies = await query<AnomalyDetection>(
      `SELECT * FROM anomaly_detections
       WHERE aircraft_id = $1
       AND detected_at > NOW() - INTERVAL '24 hours'
       ORDER BY severity DESC, detected_at DESC
       LIMIT 10`,
      [id]
    );

    // Get latest intent classification
    const intent = await queryOne<IntentClassification>(
      `SELECT * FROM intent_classifications
       WHERE aircraft_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [id]
    );

    // Get latest threat assessment
    const threat = await queryOne<ThreatAssessment>(
      `SELECT * FROM threat_assessments
       WHERE entity_type = 'aircraft' AND entity_id = $1
       ORDER BY assessed_at DESC
       LIMIT 1`,
      [id]
    );

    // Get active formations involving this aircraft
    const formations = await query<FormationDetection>(
      `SELECT * FROM formation_detections
       WHERE $1 = ANY(aircraft_ids)
       AND is_active = true
       ORDER BY detected_at DESC`,
      [id]
    );

    // Get behavioral profile
    const profile = await queryOne<BehavioralProfile>(
      `SELECT * FROM aircraft_behavioral_profiles
       WHERE aircraft_id = $1`,
      [id]
    );

    const data: MLData = {
      anomalies,
      intent: intent || null,
      threat: threat || null,
      formations,
      profile: profile || null,
    };

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching ML data for aircraft:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
