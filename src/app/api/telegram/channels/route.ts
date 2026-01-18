import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface TelegramChannel {
  id: string;
  channel_username: string;
  display_name: string;
  description: string;
  category: string;
  language: string;
  is_active: boolean;
  last_fetched_at: string | null;
}

export async function GET() {
  try {
    const channels = await query<TelegramChannel>(
      `SELECT
        id, channel_username, display_name, description,
        category, language, is_active, last_fetched_at
       FROM telegram_channels
       WHERE is_active = TRUE
       ORDER BY category, display_name`
    );

    // Group by category
    const grouped: Record<string, TelegramChannel[]> = {};
    for (const channel of channels) {
      const cat = channel.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(channel);
    }

    return NextResponse.json({
      success: true,
      total: channels.length,
      channels,
      grouped,
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch channels' },
      { status: 500 }
    );
  }
}
