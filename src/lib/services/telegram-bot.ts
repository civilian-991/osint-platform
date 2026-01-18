/**
 * Telegram Bot Service
 *
 * Sends alerts to a Telegram channel/group via bot API.
 *
 * Setup:
 * 1. Create a bot with @BotFather on Telegram
 * 2. Get the bot token
 * 3. Add bot to your channel/group as admin
 * 4. Get the chat ID (channel: @channelname or -100xxx for private)
 * 5. Set environment variables:
 *    - TELEGRAM_BOT_TOKEN=your_bot_token
 *    - TELEGRAM_ALERT_CHAT_ID=your_chat_id
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALERT_CHAT_ID = process.env.TELEGRAM_ALERT_CHAT_ID;

interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
}

interface StrikeAlertData {
  eventType: string;
  locationName: string;
  region: string;
  description?: string;
  latitude: number;
  longitude: number;
  confidence: number;
  source?: string;
}

interface AircraftAlertData {
  callsign: string;
  aircraftType: string;
  operator?: string;
  altitude: number;
  speed: number;
  region: string;
  activity?: string;
}

interface FormationAlertData {
  formationType: string;
  aircraftCount: number;
  region: string;
  details: string;
}

class TelegramBotService {
  private baseUrl: string;
  private enabled: boolean;

  constructor() {
    this.baseUrl = `https://api.telegram.org/bot${BOT_TOKEN}`;
    this.enabled = !!(BOT_TOKEN && ALERT_CHAT_ID);

    if (!this.enabled) {
      console.warn('Telegram Bot not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_ALERT_CHAT_ID');
    }
  }

  /**
   * Send a raw message to Telegram
   */
  async sendMessage(message: TelegramMessage): Promise<boolean> {
    if (!this.enabled) {
      console.log('[TelegramBot] Not enabled, skipping message');
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      const data = await response.json();

      if (!data.ok) {
        console.error('[TelegramBot] Error:', data.description);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[TelegramBot] Failed to send message:', error);
      return false;
    }
  }

  /**
   * Send a strike/airstrike alert
   */
  async sendStrikeAlert(data: StrikeAlertData): Promise<boolean> {
    const emoji = this.getStrikeEmoji(data.eventType);
    const mapsUrl = `https://maps.google.com/?q=${data.latitude},${data.longitude}`;

    const text = `
${emoji} <b>STRIKE ALERT</b> ${emoji}

<b>Type:</b> ${data.eventType.toUpperCase()}
<b>Location:</b> ${data.locationName}
<b>Region:</b> ${data.region}
${data.description ? `\n<b>Details:</b> ${data.description.substring(0, 200)}` : ''}

📍 <a href="${mapsUrl}">View on Map</a>
⏰ ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Beirut' })}
${data.source ? `📡 Source: ${data.source}` : ''}

#Strike #${data.region.replace(/\s/g, '')} #${data.eventType}
`.trim();

    return this.sendMessage({
      chat_id: ALERT_CHAT_ID!,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    });
  }

  /**
   * Send a military aircraft alert
   */
  async sendAircraftAlert(data: AircraftAlertData): Promise<boolean> {
    const text = `
✈️ <b>AIRCRAFT ALERT</b> ✈️

<b>Callsign:</b> ${data.callsign}
<b>Type:</b> ${data.aircraftType}
${data.operator ? `<b>Operator:</b> ${data.operator}` : ''}
<b>Altitude:</b> ${data.altitude.toLocaleString()} ft
<b>Speed:</b> ${data.speed} kts
<b>Region:</b> ${data.region}
${data.activity ? `<b>Activity:</b> ${data.activity}` : ''}

⏰ ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Beirut' })}

#Aircraft #Military #${data.region.replace(/\s/g, '')}
`.trim();

    return this.sendMessage({
      chat_id: ALERT_CHAT_ID!,
      text,
      parse_mode: 'HTML',
    });
  }

  /**
   * Send a formation detection alert
   */
  async sendFormationAlert(data: FormationAlertData): Promise<boolean> {
    const text = `
🎯 <b>FORMATION DETECTED</b> 🎯

<b>Type:</b> ${data.formationType}
<b>Aircraft:</b> ${data.aircraftCount}
<b>Region:</b> ${data.region}

<b>Details:</b>
${data.details}

⏰ ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Beirut' })}

#Formation #${data.formationType.replace(/\s/g, '')} #${data.region.replace(/\s/g, '')}
`.trim();

    return this.sendMessage({
      chat_id: ALERT_CHAT_ID!,
      text,
      parse_mode: 'HTML',
    });
  }

  /**
   * Send a custom intel alert
   */
  async sendIntelAlert(
    title: string,
    body: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<boolean> {
    const severityEmoji = {
      low: 'ℹ️',
      medium: '⚠️',
      high: '🔴',
      critical: '🚨',
    };

    const text = `
${severityEmoji[severity]} <b>${title}</b>

${body}

⏰ ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Beirut' })}

#Intel #${severity.toUpperCase()}
`.trim();

    return this.sendMessage({
      chat_id: ALERT_CHAT_ID!,
      text,
      parse_mode: 'HTML',
    });
  }

  /**
   * Send location with map
   */
  async sendLocation(
    latitude: number,
    longitude: number,
    title?: string
  ): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const response = await fetch(`${this.baseUrl}/sendLocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ALERT_CHAT_ID,
          latitude,
          longitude,
        }),
      });

      return (await response.json()).ok;
    } catch {
      return false;
    }
  }

  /**
   * Test the bot connection
   */
  async testConnection(): Promise<{ success: boolean; botName?: string; error?: string }> {
    if (!BOT_TOKEN) {
      return { success: false, error: 'TELEGRAM_BOT_TOKEN not set' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/getMe`);
      const data = await response.json();

      if (data.ok) {
        return { success: true, botName: data.result.username };
      } else {
        return { success: false, error: data.description };
      }
    } catch (error) {
      return { success: false, error: 'Failed to connect to Telegram API' };
    }
  }

  private getStrikeEmoji(eventType: string): string {
    const emojis: Record<string, string> = {
      airstrike: '💥',
      rocket: '🚀',
      drone: '🛸',
      explosion: '💣',
      gunfire: '🔫',
      shelling: '🎯',
    };
    return emojis[eventType] || '⚠️';
  }

  get isEnabled(): boolean {
    return this.enabled;
  }
}

export const telegramBot = new TelegramBotService();
