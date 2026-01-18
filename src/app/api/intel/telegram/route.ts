import { NextRequest, NextResponse } from 'next/server';
import { telegramFetcher } from '@/lib/services/telegram-fetcher';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const search = searchParams.get('search');

    let messages;

    if (search) {
      // Search messages
      const keywords = search.split(',').map(k => k.trim());
      messages = await telegramFetcher.searchMessages(keywords, limit);
    } else {
      // Get recent messages
      messages = await telegramFetcher.getRecentMessages(limit);
    }

    const stats = await telegramFetcher.getStats();

    return NextResponse.json({
      success: true,
      data: messages,
      count: messages.length,
      stats,
    });
  } catch (error) {
    console.error('Error fetching Telegram messages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// Add new channel
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, displayName, category } = body;

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    const result = await telegramFetcher.addChannel(username, displayName, category);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Channel @${username} added successfully`,
    });
  } catch (error) {
    console.error('Error adding channel:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add channel' },
      { status: 500 }
    );
  }
}
