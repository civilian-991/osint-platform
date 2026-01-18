import { NextRequest, NextResponse } from 'next/server';
import { telegramFetcher } from '@/lib/services/telegram-fetcher';

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
    // Fetch all active channels
    const results = await telegramFetcher.fetchAllChannels();

    // Get stats
    const stats = await telegramFetcher.getStats();

    const totalFetched = results.reduce((sum, r) => sum + r.messages_fetched, 0);
    const totalNew = results.reduce((sum, r) => sum + r.new_messages, 0);
    const errors = results.filter(r => r.error);

    return NextResponse.json({
      success: true,
      channels_processed: results.length,
      messages_fetched: totalFetched,
      new_messages: totalNew,
      errors: errors.length,
      results: results.map(r => ({
        channel: r.channel,
        new: r.new_messages,
        error: r.error,
      })),
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching Telegram channels:', error);
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
