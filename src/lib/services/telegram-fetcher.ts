/**
 * Telegram Channel Fetcher Service
 *
 * Fetches messages from public Telegram channels using the web preview
 * at t.me/s/channelname (no API key required for public channels)
 */

import { query, queryOne, execute } from '@/lib/db';
import { JSDOM } from 'jsdom';

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
        await new Promise(resolve => setTimeout(resolve, 1000));
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
    const messages = this.parseMessages(html);

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
           last_message_id = GREATEST(last_message_id, $2)
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
   * Parse messages from Telegram web preview HTML
   */
  private parseMessages(html: string): TelegramMessage[] {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const messages: TelegramMessage[] = [];

    const messageElements = doc.querySelectorAll('.tgme_widget_message');

    for (const element of messageElements) {
      try {
        // Get message ID from data attribute
        const messageIdAttr = element.getAttribute('data-post');
        if (!messageIdAttr) continue;

        const messageId = parseInt(messageIdAttr.split('/').pop() || '0');
        if (!messageId) continue;

        // Get content
        const textElement = element.querySelector('.tgme_widget_message_text');
        const content = textElement?.textContent?.trim() || '';

        // Get media
        let mediaType = 'text';
        let mediaUrl: string | null = null;

        const photoElement = element.querySelector('.tgme_widget_message_photo_wrap');
        const videoElement = element.querySelector('.tgme_widget_message_video');
        const documentElement = element.querySelector('.tgme_widget_message_document');

        if (photoElement) {
          mediaType = 'photo';
          const style = photoElement.getAttribute('style') || '';
          const urlMatch = style.match(/url\(['"]?([^'"]+)['"]?\)/);
          mediaUrl = urlMatch?.[1] || null;
        } else if (videoElement) {
          mediaType = 'video';
          mediaUrl = videoElement.getAttribute('src') || null;
        } else if (documentElement) {
          mediaType = 'document';
        }

        // Get views
        const viewsElement = element.querySelector('.tgme_widget_message_views');
        const viewsText = viewsElement?.textContent?.trim() || '0';
        const views = this.parseViews(viewsText);

        // Get date
        const dateElement = element.querySelector('.tgme_widget_message_date time');
        const datetime = dateElement?.getAttribute('datetime') || new Date().toISOString();
        const postedAt = new Date(datetime);

        messages.push({
          message_id: messageId,
          content,
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
   * Parse views count (handles K, M suffixes)
   */
  private parseViews(text: string): number {
    const cleaned = text.replace(/[^0-9.KkMm]/g, '');
    if (!cleaned) return 0;

    if (cleaned.toLowerCase().includes('k')) {
      return Math.round(parseFloat(cleaned) * 1000);
    }
    if (cleaned.toLowerCase().includes('m')) {
      return Math.round(parseFloat(cleaned) * 1000000);
    }
    return parseInt(cleaned) || 0;
  }

  /**
   * Get recent messages across all channels
   */
  async getRecentMessages(limit = 50): Promise<Array<{
    channel_username: string;
    channel_name: string;
    category: string;
    message_id: number;
    content: string;
    media_type: string;
    views: number;
    posted_at: string;
    relevance_score: number | null;
  }>> {
    return query(
      `SELECT
         c.channel_username,
         COALESCE(c.display_name, c.channel_username) as channel_name,
         c.category,
         m.message_id,
         m.content,
         m.media_type,
         m.views,
         m.posted_at,
         m.relevance_score
       FROM telegram_messages m
       JOIN telegram_channels c ON m.channel_id = c.id
       WHERE m.posted_at > NOW() - INTERVAL '24 hours'
       ORDER BY m.posted_at DESC
       LIMIT $1`,
      [limit]
    );
  }

  /**
   * Search messages for keywords
   */
  async searchMessages(keywords: string[], limit = 20): Promise<Array<{
    channel_username: string;
    content: string;
    posted_at: string;
    views: number;
  }>> {
    const pattern = keywords.map(k => k.toLowerCase()).join('|');

    return query(
      `SELECT
         c.channel_username,
         m.content,
         m.posted_at,
         m.views
       FROM telegram_messages m
       JOIN telegram_channels c ON m.channel_id = c.id
       WHERE m.posted_at > NOW() - INTERVAL '48 hours'
       AND LOWER(m.content) ~ $1
       ORDER BY m.posted_at DESC
       LIMIT $2`,
      [pattern, limit]
    );
  }

  /**
   * Add a new channel to monitor
   */
  async addChannel(username: string, displayName?: string, category = 'general'): Promise<{ success: boolean; error?: string }> {
    const cleanUsername = username.replace('@', '').replace('https://t.me/', '').replace('https://t.me/s/', '');

    // Verify channel exists
    try {
      const response = await fetch(`${this.BASE_URL}/${cleanUsername}`, {
        headers: { 'User-Agent': this.USER_AGENT },
      });

      if (!response.ok) {
        return { success: false, error: 'Channel not found or not public' };
      }
    } catch {
      return { success: false, error: 'Failed to verify channel' };
    }

    try {
      await execute(
        `INSERT INTO telegram_channels (channel_username, display_name, category)
         VALUES ($1, $2, $3)
         ON CONFLICT (channel_username) DO UPDATE
         SET display_name = COALESCE($2, telegram_channels.display_name),
             category = $3,
             is_active = TRUE`,
        [cleanUsername, displayName, category]
      );

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Database error' };
    }
  }

  /**
   * Get channel statistics
   */
  async getStats(): Promise<{
    total_channels: number;
    active_channels: number;
    total_messages: number;
    messages_24h: number;
  }> {
    const stats = await queryOne<{
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
      total_channels: parseInt(stats?.total_channels || '0'),
      active_channels: parseInt(stats?.active_channels || '0'),
      total_messages: parseInt(stats?.total_messages || '0'),
      messages_24h: parseInt(stats?.messages_24h || '0'),
    };
  }
}

export const telegramFetcher = new TelegramFetcherService();
