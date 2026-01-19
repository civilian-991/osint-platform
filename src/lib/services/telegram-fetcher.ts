/**
 * Telegram Channel Fetcher Service
 *
 * Fetches messages from public Telegram channels using the web preview
 * at t.me/s/channelname (no API key required for public channels)
 *
 * Uses regex-based parsing for serverless compatibility (no jsdom)
 */

import { query, execute } from '@/lib/db';

// Parser version tracking - increment when HTML structure patterns change
const PARSER_VERSION = '1.0.0';

// Expected HTML markers to verify Telegram page structure hasn't changed
const HTML_STRUCTURE_MARKERS = {
  messageWrap: 'tgme_widget_message_wrap',
  messageText: 'tgme_widget_message_text',
  messageViews: 'tgme_widget_message_views',
  dataPost: 'data-post=',
};

// Parsing metrics for monitoring
interface ParsingMetrics {
  totalAttempts: number;
  successfulParses: number;
  emptyResults: number;
  structureWarnings: number;
  lastStructureCheck: Date | null;
  structureValid: boolean;
}

const parsingMetrics: ParsingMetrics = {
  totalAttempts: 0,
  successfulParses: 0,
  emptyResults: 0,
  structureWarnings: 0,
  lastStructureCheck: null,
  structureValid: true,
};

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
   * Get current parser version and metrics
   */
  getParserInfo(): { version: string; metrics: ParsingMetrics } {
    return {
      version: PARSER_VERSION,
      metrics: { ...parsingMetrics },
    };
  }

  /**
   * Verify HTML structure matches expected Telegram format
   * Returns warnings if structure has changed
   */
  private verifyHtmlStructure(html: string): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    for (const [name, marker] of Object.entries(HTML_STRUCTURE_MARKERS)) {
      if (!html.includes(marker)) {
        warnings.push(`Missing expected marker: ${name} (${marker})`);
      }
    }

    const valid = warnings.length === 0;

    if (!valid && parsingMetrics.structureValid) {
      // Structure was valid before, now it's not - this is a significant change
      console.error(`[Telegram Parser v${PARSER_VERSION}] HTML structure change detected!`, warnings);
      parsingMetrics.structureWarnings++;
    }

    parsingMetrics.structureValid = valid;
    parsingMetrics.lastStructureCheck = new Date();

    return { valid, warnings };
  }

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

    // Add timeout to prevent hanging indefinitely
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Verify HTML structure hasn't changed
      const structureCheck = this.verifyHtmlStructure(html);
      if (!structureCheck.valid) {
        console.warn(`[Telegram Parser v${PARSER_VERSION}] Structure warnings for ${channel.channel_username}:`, structureCheck.warnings);
      }

      parsingMetrics.totalAttempts++;
      const messages = this.parseMessages(html, channel.channel_username);

      if (messages.length > 0) {
        parsingMetrics.successfulParses++;
      } else if (html.length > 1000) {
        // Got HTML but no messages parsed - potential structure change
        parsingMetrics.emptyResults++;
        console.warn(`[Telegram Parser v${PARSER_VERSION}] No messages parsed from ${channel.channel_username} despite receiving ${html.length} bytes of HTML`);
      }

      // Debug: Log parsed content
      console.log(`[Telegram] Parsed ${messages.length} messages from ${channel.channel_username}`);
      if (messages.length > 0) {
        const withContent = messages.filter(m => m.content && m.content.length > 0);
        console.log(`[Telegram] ${withContent.length} messages have content. IDs: ${messages.map(m => m.message_id).join(',')}. Sample:`, withContent[0]?.content?.substring(0, 50));
      }

      // Filter to only new messages
      const lastMessageId = channel.last_message_id || 0;
      const newMessages = messages.filter(m => m.message_id > lastMessageId);

      // Store ALL messages (update content for existing ones that may be empty)
      let insertedCount = 0;
      for (const message of messages) {
        try {
          await execute(
            `INSERT INTO telegram_messages
             (channel_id, message_id, content, media_type, media_url, views, posted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (channel_id, message_id) DO UPDATE SET
               content = COALESCE(NULLIF(EXCLUDED.content, ''), telegram_messages.content, ''),
               media_type = EXCLUDED.media_type,
               views = EXCLUDED.views`,
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
        new_messages: newMessages.length,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout for channel ${channel.channel_username}`);
      }
      throw error;
    }
  }

  /**
   * Parse messages from Telegram web preview HTML using regex
   * (serverless-friendly, no jsdom needed)
   */
  private parseMessages(html: string, channelUsername: string): TelegramMessage[] {
    const messages: TelegramMessage[] = [];

    // Match message blocks - find each message wrap div with its content
    // The structure is: <div class="tgme_widget_message_wrap">...<div class="tgme_widget_message" data-post="...">...</div></div>
    const messageBlockRegex = /<div[^>]*class="tgme_widget_message_wrap[^"]*"[^>]*>([\s\S]*?)<\/div><\/div><div class="tgme_widget_message_wrap/g;
    const lastBlockRegex = /<div[^>]*class="tgme_widget_message_wrap[^"]*"[^>]*>([\s\S]*?)<\/div><\/div><\/section>/;

    // Process all messages except the last one
    let match;
    while ((match = messageBlockRegex.exec(html)) !== null) {
      const parsed = this.parseMessageBlock(match[1], channelUsername);
      if (parsed) messages.push(parsed);
    }

    // Process the last message
    const lastMatch = html.match(lastBlockRegex);
    if (lastMatch) {
      const parsed = this.parseMessageBlock(lastMatch[1], channelUsername);
      if (parsed) messages.push(parsed);
    }

    // If the above didn't work, try alternative parsing
    if (messages.length === 0) {
      // Find all data-post attributes and extract content around them
      const altRegex = /data-post="([^"]+)"[\s\S]*?<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?datetime="([^"]+)"[\s\S]*?class="tgme_widget_message_views"[^>]*>([^<]*)/g;

      while ((match = altRegex.exec(html)) !== null) {
        try {
          const dataPost = match[1];
          const textContent = match[2];
          const datetime = match[3];
          const viewsStr = match[4];

          const messageId = parseInt(dataPost.split('/').pop() || '0');
          if (!messageId) continue;

          messages.push({
            message_id: messageId,
            content: this.stripHtml(textContent).substring(0, 4000),
            media_type: 'text',
            media_url: null,
            views: this.parseViews(viewsStr.trim()),
            posted_at: new Date(datetime),
          });
        } catch (error) {
          console.error('Error in alt parsing:', error);
        }
      }
    }

    return messages;
  }

  /**
   * Parse a single message block
   */
  private parseMessageBlock(blockHtml: string, channelUsername: string): TelegramMessage | null {
    try {
      // Extract data-post
      const dataPostMatch = blockHtml.match(/data-post="([^"]+)"/);
      if (!dataPostMatch) return null;

      const messageId = parseInt(dataPostMatch[1].split('/').pop() || '0');
      if (!messageId) return null;

      // Extract text content - look for the message text div
      let content = '';
      const textMatch = blockHtml.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      if (textMatch) {
        content = this.stripHtml(textMatch[1]);
      }

      // Detect media type
      let mediaType = 'text';
      let mediaUrl: string | null = null;

      if (blockHtml.includes('tgme_widget_message_photo')) {
        mediaType = 'photo';
        const photoMatch = blockHtml.match(/background-image:url\('([^']+)'\)/);
        if (photoMatch) mediaUrl = photoMatch[1];
      } else if (blockHtml.includes('tgme_widget_message_video')) {
        mediaType = 'video';
      } else if (blockHtml.includes('tgme_widget_message_document')) {
        mediaType = 'document';
      }

      // Extract views
      let views = 0;
      const viewsMatch = blockHtml.match(/class="tgme_widget_message_views"[^>]*>([^<]+)/);
      if (viewsMatch) {
        views = this.parseViews(viewsMatch[1].trim());
      }

      // Extract time
      const timeMatch = blockHtml.match(/datetime="([^"]+)"/);
      const postedAt = timeMatch ? new Date(timeMatch[1]) : new Date();

      return {
        message_id: messageId,
        content: content.substring(0, 4000),
        media_type: mediaType,
        media_url: mediaUrl,
        views,
        posted_at: postedAt,
      };
    } catch (error) {
      console.error('Error parsing message block:', error);
      return null;
    }
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
    const searchPatterns = keywords.map(k => `%${k}%`);
    return query(
      `SELECT m.id, m.content, c.channel_username, c.display_name, m.posted_at, c.category
       FROM telegram_messages m
       JOIN telegram_channels c ON m.channel_id = c.id
       WHERE m.content ILIKE ANY($1::text[])
       ORDER BY m.posted_at DESC
       LIMIT $2`,
      [searchPatterns, limit]
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
    parser: {
      version: string;
      successRate: number;
      structureValid: boolean;
      lastCheck: string | null;
    };
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

    const parserInfo = this.getParserInfo();
    const successRate = parsingMetrics.totalAttempts > 0
      ? parsingMetrics.successfulParses / parsingMetrics.totalAttempts
      : 1;

    return {
      total_channels: parseInt(stats[0]?.total_channels || '0'),
      active_channels: parseInt(stats[0]?.active_channels || '0'),
      total_messages: parseInt(stats[0]?.total_messages || '0'),
      messages_24h: parseInt(stats[0]?.messages_24h || '0'),
      parser: {
        version: parserInfo.version,
        successRate: Math.round(successRate * 100) / 100,
        structureValid: parserInfo.metrics.structureValid,
        lastCheck: parserInfo.metrics.lastStructureCheck?.toISOString() || null,
      },
    };
  }
}

export const telegramFetcher = new TelegramFetcherService();
