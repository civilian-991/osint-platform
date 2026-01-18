/**
 * Telegram Channel Fetcher Service
 *
 * Fetches messages from public Telegram channels using the web preview
 * at t.me/s/channelname (no API key required for public channels)
 *
 * Uses regex-based parsing for serverless compatibility (no jsdom)
 */

import { query, execute } from '@/lib/db';

interface TelegramChannel {
  id: string;
  channel_username: string;
  display_name: string | null;
  category: string;
  last_message_id: number | null;
}

interface TelegramMessage {
  message_id: number;
  content: string;
  media_type: string;
  media_url: string | null;
  views: number;
  posted_at: Date;
}

interface FetchResult {
  channel: string;
  messages_fetched: number;
  new_messages: number;
  error?: string;
}

class TelegramFetcherService {
  private readonly BASE_URL = 'https://t.me/s';
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  /**
   * Fetch all active channels
   */
  async fetchAllChannels(): Promise<FetchResult[]> {
    const channels = await query<TelegramChannel>(
      `SELECT id, channel_username, display_name, category, last_message_id
       FROM telegram_channels
       WHERE is_active = TRUE
       ORDER BY last_fetched_at ASC NULLS FIRST
       LIMIT 10`
    );

    const results: FetchResult[] = [];

    for (const channel of channels) {
      try {
        const result = await this.fetchChannel(channel);
        results.push(result);

        // Small delay between channels to be polite
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error fetching channel ${channel.channel_username}:`, error);
        results.push({
          channel: channel.channel_username,
          messages_fetched: 0,
          new_messages: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Fetch messages from a single channel (by username string)
   */
  async fetchChannelByUsername(username: string): Promise<FetchResult> {
    const channel = await query<TelegramChannel>(
      `SELECT id, channel_username, display_name, category, last_message_id
       FROM telegram_channels
       WHERE channel_username = $1 AND is_active = TRUE`,
      [username]
    );

    if (channel.length === 0) {
      return {
        channel: username,
        messages_fetched: 0,
        new_messages: 0,
        error: 'Channel not found in database',
      };
    }

    return this.fetchChannel(channel[0]);
  }

  /**
   * Fetch messages from a single channel
   */
  async fetchChannel(channel: TelegramChannel): Promise<FetchResult> {
    const url = `${this.BASE_URL}/${channel.channel_username}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const messages = this.parseMessages(html, channel.channel_username);

    // Filter to only new messages
    const lastMessageId = channel.last_message_id || 0;
    const newMessages = messages.filter(m => m.message_id > lastMessageId);

    // Store new messages
    let insertedCount = 0;
    for (const message of newMessages) {
      try {
        await execute(
          `INSERT INTO telegram_messages
           (channel_id, message_id, content, media_type, media_url, views, posted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (channel_id, message_id) DO NOTHING`,
          [
            channel.id,
            message.message_id,
            message.content,
            message.media_type,
            message.media_url,
            message.views,
            message.posted_at.toISOString(),
          ]
        );
        insertedCount++;
      } catch (error) {
        console.error(`Error inserting message ${message.message_id}:`, error);
      }
    }

    // Update channel last_fetched_at and last_message_id
    const maxMessageId = messages.length > 0
      ? Math.max(...messages.map(m => m.message_id))
      : lastMessageId;

    await execute(
      `UPDATE telegram_channels
       SET last_fetched_at = NOW(),
           last_message_id = GREATEST(COALESCE(last_message_id, 0), $2)
       WHERE id = $1`,
      [channel.id, maxMessageId]
    );

    return {
      channel: channel.channel_username,
      messages_fetched: messages.length,
      new_messages: insertedCount,
    };
  }

  /**
   * Parse messages from Telegram web preview HTML using regex
   * (serverless-friendly, no jsdom needed)
   */
  private parseMessages(html: string, channelUsername: string): TelegramMessage[] {
    const messages: TelegramMessage[] = [];

    // Match message blocks
    const messageBlockRegex = /class="tgme_widget_message[^"]*"[^>]*data-post="([^"]+)"([\s\S]*?)(?=class="tgme_widget_message[^"]*"|$)/g;
    let match;

    while ((match = messageBlockRegex.exec(html)) !== null) {
      try {
        const dataPost = match[1]; // e.g., "channelname/1234"
        const messageBlock = match[2];

        // Extract message ID
        const messageId = parseInt(dataPost.split('/').pop() || '0');
        if (!messageId) continue;

        // Extract text content
        const textMatch = messageBlock.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        let content = '';
        if (textMatch) {
          // Strip HTML tags and decode entities
          content = this.stripHtml(textMatch[1]);
        }

        // Detect media type
        let mediaType = 'text';
        let mediaUrl: string | null = null;

        if (messageBlock.includes('tgme_widget_message_photo')) {
          mediaType = 'photo';
          const photoMatch = messageBlock.match(/background-image:url\('([^']+)'\)/);
          if (photoMatch) mediaUrl = photoMatch[1];
        } else if (messageBlock.includes('tgme_widget_message_video')) {
          mediaType = 'video';
        } else if (messageBlock.includes('tgme_widget_message_document')) {
          mediaType = 'document';
        }

        // Extract views
        let views = 0;
        const viewsMatch = messageBlock.match(/class="tgme_widget_message_views"[^>]*>([^<]+)/);
        if (viewsMatch) {
          views = this.parseViews(viewsMatch[1].trim());
        }

        // Extract time
        const timeMatch = messageBlock.match(/datetime="([^"]+)"/);
        const postedAt = timeMatch ? new Date(timeMatch[1]) : new Date();

        messages.push({
          message_id: messageId,
          content: content.substring(0, 4000), // Limit content length
          media_type: mediaType,
          media_url: mediaUrl,
          views,
          posted_at: postedAt,
        });
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    }

    return messages;
  }

  /**
   * Strip HTML tags and decode common entities
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Parse view count (handles K, M suffixes)
   */
  private parseViews(viewsStr: string): number {
    const cleaned = viewsStr.toLowerCase().replace(/\s/g, '');
    if (cleaned.endsWith('k')) {
      return Math.round(parseFloat(cleaned) * 1000);
    } else if (cleaned.endsWith('m')) {
      return Math.round(parseFloat(cleaned) * 1000000);
    }
    return parseInt(cleaned) || 0;
  }

  /**
   * Get recent messages from database
   */
  async getRecentMessages(limit: number = 50): Promise<Array<{
    id: string;
    content: string;
    channel_username: string;
    display_name: string;
    posted_at: string;
    category: string;
  }>> {
    return query(
      `SELECT m.id, m.content, c.channel_username, c.display_name, m.posted_at, c.category
       FROM telegram_messages m
       JOIN telegram_channels c ON m.channel_id = c.id
       WHERE m.posted_at > NOW() - INTERVAL '48 hours'
       ORDER BY m.posted_at DESC
       LIMIT $1`,
      [limit]
    );
  }

  /**
   * Search messages by keywords
   */
  async searchMessages(keywords: string[], limit: number = 50): Promise<Array<{
    id: string;
    content: string;
    channel_username: string;
    display_name: string;
    posted_at: string;
    category: string;
  }>> {
    const searchPattern = keywords.map(k => `%${k}%`).join(' ');
    return query(
      `SELECT m.id, m.content, c.channel_username, c.display_name, m.posted_at, c.category
       FROM telegram_messages m
       JOIN telegram_channels c ON m.channel_id = c.id
       WHERE m.content ILIKE ANY($1::text[])
       ORDER BY m.posted_at DESC
       LIMIT $2`,
      [keywords.map(k => `%${k}%`), limit]
    );
  }

  /**
   * Add a new channel
   */
  async addChannel(
    username: string,
    displayName?: string,
    category: string = 'other'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await execute(
        `INSERT INTO telegram_channels (channel_username, display_name, category, is_active)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (channel_username) DO UPDATE SET
           display_name = COALESCE(EXCLUDED.display_name, telegram_channels.display_name),
           is_active = TRUE`,
        [username.replace('@', ''), displayName || username, category]
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    total_channels: number;
    active_channels: number;
    total_messages: number;
    messages_24h: number;
  }> {
    const stats = await query<{
      total_channels: string;
      active_channels: string;
      total_messages: string;
      messages_24h: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM telegram_channels) as total_channels,
        (SELECT COUNT(*) FROM telegram_channels WHERE is_active = TRUE) as active_channels,
        (SELECT COUNT(*) FROM telegram_messages) as total_messages,
        (SELECT COUNT(*) FROM telegram_messages WHERE posted_at > NOW() - INTERVAL '24 hours') as messages_24h
    `);

    return {
      total_channels: parseInt(stats[0]?.total_channels || '0'),
      active_channels: parseInt(stats[0]?.active_channels || '0'),
      total_messages: parseInt(stats[0]?.total_messages || '0'),
      messages_24h: parseInt(stats[0]?.messages_24h || '0'),
    };
  }
}

export const telegramFetcher = new TelegramFetcherService();
