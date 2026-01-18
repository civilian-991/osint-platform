import { NextResponse } from 'next/server';
import { intelligenceAlertService } from '@/lib/services/intelligence-alerts';

export async function GET() {
  try {
    const summary = await intelligenceAlertService.getIntelligenceSummary();

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error fetching intelligence summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch intelligence summary' },
      { status: 500 }
    );
  }
}

// Trigger alert generation manually (for testing)
export async function POST() {
  try {
    const alerts = await intelligenceAlertService.generateAlerts();
    const summary = await intelligenceAlertService.getIntelligenceSummary();

    return NextResponse.json({
      success: true,
      alerts_generated: alerts.length,
      data: summary,
    });
  } catch (error) {
    console.error('Error generating alerts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate alerts' },
      { status: 500 }
    );
  }
}
