import { NextRequest, NextResponse } from 'next/server';
import { intelligenceAlertService } from '@/lib/services/intelligence-alerts';

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  if (!cronSecret) {
    console.warn('CRON_SECRET not set');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Generate intelligence alerts
    const alerts = await intelligenceAlertService.generateAlerts();

    // Get current summary
    const summary = await intelligenceAlertService.getIntelligenceSummary();

    return NextResponse.json({
      success: true,
      alerts_generated: alerts.length,
      alerts: alerts.map(a => ({
        type: a.type,
        severity: a.severity,
        title: a.title,
      })),
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating intelligence alerts:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Support POST for Vercel cron
export async function POST(request: NextRequest) {
  return GET(request);
}
