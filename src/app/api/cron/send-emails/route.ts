import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/services/email';

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without secret
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
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Check if email service is configured
    if (!emailService.isConfigured()) {
      return NextResponse.json({
        success: true,
        message: 'Email service not configured, skipping',
        stats: { processed: 0, sent: 0, failed: 0 },
      });
    }

    // Process email queue
    const stats = await emailService.processQueue(50);

    console.log(`Email queue processed: ${stats.processed} total, ${stats.sent} sent, ${stats.failed} failed`);

    return NextResponse.json({
      success: true,
      message: `Processed ${stats.processed} emails`,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in send-emails cron:', error);
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
