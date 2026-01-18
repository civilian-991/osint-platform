/**
 * Strike Event Tracker
 *
 * Parses Telegram messages and news for strike/attack events,
 * geocodes locations, and tracks them on the map.
 */

import { query, queryOne, execute } from '@/lib/db';

export interface StrikeEvent {
  id: string;
  event_type: string;
  latitude: number;
  longitude: number;
  location_name: string;
  region: string;
  description: string;
  source_channel: string;
  confidence: number;
  reported_at: string;
  is_active: boolean;
}

interface KnownLocation {
  location_name: string;
  latitude: number;
  longitude: number;
  region: string;
}

// Keywords that indicate strike/attack events
const EVENT_KEYWORDS = {
  airstrike: [
    'airstrike', 'air strike', 'غارة', 'غارات', 'قصف جوي', 'bombardment',
    'bombing', 'aerial attack', 'jets', 'warplanes', 'طائرات حربية'
  ],
  rocket: [
    'rocket', 'rockets', 'صاروخ', 'صواريخ', 'missile', 'missiles',
    'barrage', 'launch', 'إطلاق'
  ],
  drone: [
    'drone', 'drones', 'مسيّرة', 'مسيرة', 'طائرة مسيرة', 'uav', 'مسير',
    'درون', 'درونات'
  ],
  explosion: [
    'explosion', 'انفجار', 'blast', 'detonation', 'تفجير'
  ],
  gunfire: [
    'gunfire', 'shooting', 'إطلاق نار', 'clashes', 'اشتباكات', 'firefight'
  ],
  shelling: [
    'shelling', 'artillery', 'قذائف', 'مدفعية', 'mortar', 'هاون'
  ],
};

// Default event duration before auto-expire (in hours)
const DEFAULT_EXPIRE_HOURS = 2;

class StrikeTrackerService {
  /**
   * Process a Telegram message and extract strike events
   */
  async processMessage(
    content: string,
    channelUsername: string,
    postedAt: Date,
    messageId?: string
  ): Promise<StrikeEvent | null> {
    // Detect event type
    const eventType = this.detectEventType(content);
    if (!eventType) return null;

    // Try to extract location
    const location = await this.extractLocation(content);
    if (!location) return null;

    // Calculate confidence based on source and specificity
    const confidence = this.calculateConfidence(content, location);

    // Calculate expiry time
    const expiresAt = new Date(postedAt.getTime() + DEFAULT_EXPIRE_HOURS * 60 * 60 * 1000);

    // Insert the strike event
    try {
      const result = await queryOne<{ id: string }>(
        `INSERT INTO strike_events
         (event_type, latitude, longitude, location_name, region, description,
          source_type, source_channel, confidence, reported_at, expires_at, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          eventType,
          location.latitude,
          location.longitude,
          location.location_name,
          location.region,
          content.substring(0, 500), // Limit description length
          'telegram',
          channelUsername,
          confidence,
          postedAt.toISOString(),
          expiresAt.toISOString(),
        ]
      );

      if (result) {
        return {
          id: result.id,
          event_type: eventType,
          latitude: location.latitude,
          longitude: location.longitude,
          location_name: location.location_name,
          region: location.region,
          description: content.substring(0, 500),
          source_channel: channelUsername,
          confidence,
          reported_at: postedAt.toISOString(),
          is_active: true,
        };
      }
    } catch (error) {
      console.error('Error inserting strike event:', error);
    }

    return null;
  }

  /**
   * Detect the type of event from message content
   */
  private detectEventType(content: string): string | null {
    const lowerContent = content.toLowerCase();

    for (const [type, keywords] of Object.entries(EVENT_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerContent.includes(keyword.toLowerCase())) {
          return type;
        }
      }
    }

    return null;
  }

  /**
   * Extract location from message content
   */
  private async extractLocation(content: string): Promise<KnownLocation | null> {
    // First try to find known locations in the text
    const knownLocations = await query<KnownLocation>(
      `SELECT name as location_name, latitude, longitude, region
       FROM known_locations`
    );

    const lowerContent = content.toLowerCase();

    for (const loc of knownLocations) {
      if (lowerContent.includes(loc.location_name.toLowerCase())) {
        return loc;
      }
    }

    // Also check Arabic names
    const arabicLocations = await query<KnownLocation>(
      `SELECT name as location_name, name_ar, latitude, longitude, region
       FROM known_locations
       WHERE name_ar IS NOT NULL`
    );

    for (const loc of arabicLocations) {
      const arabicName = (loc as unknown as { name_ar: string }).name_ar;
      if (arabicName && content.includes(arabicName)) {
        return loc;
      }
    }

    return null;
  }

  /**
   * Calculate confidence score for the event
   */
  private calculateConfidence(content: string, location: KnownLocation): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence for specific location mentions
    if (location.location_name) {
      confidence += 0.2;
    }

    // Increase confidence for multiple event keywords
    const lowerContent = content.toLowerCase();
    let keywordCount = 0;
    for (const keywords of Object.values(EVENT_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerContent.includes(keyword.toLowerCase())) {
          keywordCount++;
        }
      }
    }
    if (keywordCount > 1) {
      confidence += 0.1;
    }

    // Cap at 0.9
    return Math.min(confidence, 0.9);
  }

  /**
   * Get active strike events for the map
   */
  async getActiveStrikes(maxAge: number = 4): Promise<StrikeEvent[]> {
    // First expire old strikes
    await execute(`SELECT expire_old_strikes()`);

    return query<StrikeEvent>(
      `SELECT
         id, event_type, latitude, longitude, location_name, region,
         description, source_channel, confidence, reported_at, is_active
       FROM strike_events
       WHERE is_active = TRUE
       AND reported_at > NOW() - INTERVAL '${maxAge} hours'
       ORDER BY reported_at DESC
       LIMIT 100`
    );
  }

  /**
   * Get strikes by region
   */
  async getStrikesByRegion(region: string): Promise<StrikeEvent[]> {
    return query<StrikeEvent>(
      `SELECT
         id, event_type, latitude, longitude, location_name, region,
         description, source_channel, confidence, reported_at, is_active
       FROM strike_events
       WHERE region = $1
       AND is_active = TRUE
       ORDER BY reported_at DESC
       LIMIT 50`,
      [region]
    );
  }

  /**
   * Manually add a strike event
   */
  async addStrike(
    eventType: string,
    latitude: number,
    longitude: number,
    locationName: string,
    region: string,
    description: string,
    expireHours: number = DEFAULT_EXPIRE_HOURS
  ): Promise<string | null> {
    const expiresAt = new Date(Date.now() + expireHours * 60 * 60 * 1000);

    const result = await queryOne<{ id: string }>(
      `INSERT INTO strike_events
       (event_type, latitude, longitude, location_name, region, description,
        source_type, confidence, reported_at, expires_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, 'manual', 0.9, NOW(), $7, TRUE)
       RETURNING id`,
      [eventType, latitude, longitude, locationName, region, description, expiresAt.toISOString()]
    );

    return result?.id || null;
  }

  /**
   * Deactivate a strike event
   */
  async deactivateStrike(id: string): Promise<void> {
    await execute(
      `UPDATE strike_events SET is_active = FALSE WHERE id = $1`,
      [id]
    );
  }

  /**
   * Process unprocessed Telegram messages for strikes
   */
  async processUnprocessedMessages(): Promise<number> {
    const messages = await query<{
      id: string;
      content: string;
      channel_username: string;
      posted_at: string;
      message_id: number;
    }>(
      `SELECT m.id, m.content, c.channel_username, m.posted_at, m.message_id
       FROM telegram_messages m
       JOIN telegram_channels c ON m.channel_id = c.id
       WHERE m.is_processed = FALSE
       AND m.content IS NOT NULL
       AND m.posted_at > NOW() - INTERVAL '24 hours'
       ORDER BY m.posted_at DESC
       LIMIT 100`
    );

    let processed = 0;

    for (const msg of messages) {
      const event = await this.processMessage(
        msg.content,
        msg.channel_username,
        new Date(msg.posted_at),
        msg.id
      );

      // Mark as processed
      await execute(
        `UPDATE telegram_messages SET is_processed = TRUE WHERE id = $1`,
        [msg.id]
      );

      if (event) {
        processed++;
      }
    }

    return processed;
  }
}

export const strikeTracker = new StrikeTrackerService();
