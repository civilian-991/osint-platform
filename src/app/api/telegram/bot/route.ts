import { NextRequest, NextResponse } from 'next/server';
import { telegramBot } from '@/lib/services/telegram-bot';

// Test the bot connection
export async function GET() {
  const result = await telegramBot.testConnection();

  return NextResponse.json({
    enabled: telegramBot.isEnabled,
    ...result,
    config: {
      hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
      hasChatId: !!process.env.TELEGRAM_ALERT_CHAT_ID,
    },
  });
}

// Send a test message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type = 'test', ...data } = body;

    let success = false;

    switch (type) {
      case 'test':
        success = await telegramBot.sendIntelAlert(
          'Test Alert',
          'This is a test message from your OSINT Platform.',
          'low'
        );
        break;

      case 'strike':
        success = await telegramBot.sendStrikeAlert(data);
        break;

      case 'aircraft':
        success = await telegramBot.sendAircraftAlert(data);
        break;

      case 'formation':
        success = await telegramBot.sendFormationAlert(data);
        break;

      case 'intel':
        success = await telegramBot.sendIntelAlert(
          data.title || 'Intel Alert',
          data.body || 'No details provided',
          data.severity || 'medium'
        );
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown alert type' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success });
  } catch (error) {
    console.error('Error sending Telegram alert:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send alert' },
      { status: 500 }
    );
  }
}
