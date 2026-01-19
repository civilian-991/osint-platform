import { NextRequest, NextResponse } from 'next/server';
import { proximityAnalyzer } from '@/lib/services/proximity-analyzer';
import type { ProximitySeverity } from '@/lib/types/predictions';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity') as ProximitySeverity | null;
    const aircraftId = searchParams.get('aircraftId');

    let warnings;
    if (aircraftId) {
      warnings = await proximityAnalyzer.getWarningsForAircraft(aircraftId);
    } else {
      warnings = await proximityAnalyzer.getActiveWarnings(severity || undefined);
    }

    return NextResponse.json({
      success: true,
      data: warnings,
    });
  } catch (error) {
    console.error('Error getting proximity warnings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get warnings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { warning_id, user_id, action } = body;

    if (action === 'acknowledge') {
      if (!warning_id || !user_id) {
        return NextResponse.json(
          { success: false, error: 'warning_id and user_id required' },
          { status: 400 }
        );
      }

      const acknowledged = await proximityAnalyzer.acknowledgeWarning(warning_id, user_id);

      return NextResponse.json({
        success: acknowledged,
        message: acknowledged ? 'Warning acknowledged' : 'Failed to acknowledge',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing proximity action:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process action' },
      { status: 500 }
    );
  }
}
