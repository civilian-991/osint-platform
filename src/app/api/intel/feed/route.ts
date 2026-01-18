import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface FeedItem {
  id: string;
  type: 'strike' | 'telegram' | 'alert' | 'news';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  source?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const types = searchParams.get('types')?.split(',') || ['strike', 'telegram', 'alert'];

  try {
    const feedItems: FeedItem[] = [];

    // Fetch strikes
    if (types.includes('strike')) {
      const strikes = await query<{
        id: string;
        event_type: string;
        location_name: string;
        region: string;
        description: string;
        latitude: number;
        longitude: number;
        source_channel: string;
        confidence: number;
        reported_at: string;
      }>(
        `SELECT id, event_type, location_name, region, description,
                latitude, longitude, source_channel, confidence, reported_at
         FROM strike_events
         WHERE is_active = TRUE
         AND reported_at > NOW() - INTERVAL '24 hours'
         ORDER BY reported_at DESC
         LIMIT $1`,
        [Math.floor(limit / 3)]
      );

      for (const strike of strikes) {
        feedItems.push({
          id: `strike-${strike.id}`,
          type: 'strike',
          severity: strike.confidence > 0.7 ? 'critical' : strike.confidence > 0.5 ? 'high' : 'medium',
          title: `${getStrikeEmoji(strike.event_type)} ${strike.event_type.toUpperCase()} - ${strike.location_name}`,
          description: strike.description || `${strike.event_type} reported in ${strike.region}`,
          source: strike.source_channel,
          region: strike.region,
          latitude: strike.latitude,
          longitude: strike.longitude,
          timestamp: strike.reported_at,
          metadata: { event_type: strike.event_type, confidence: strike.confidence },
        });
      }
    }

    // Fetch Telegram messages (latest from alert-type channels)
    if (types.includes('telegram')) {
      const messages = await query<{
        id: string;
        content: string;
        channel_username: string;
        display_name: string;
        posted_at: string;
        category: string;
      }>(
        `SELECT m.id, m.content, c.channel_username, c.display_name, m.posted_at, c.category
         FROM telegram_messages m
         JOIN telegram_channels c ON m.channel_id = c.id
         WHERE m.posted_at > NOW() - INTERVAL '24 hours'
         AND c.category IN ('alerts', 'military', 'osint')
         ORDER BY m.posted_at DESC
         LIMIT $1`,
        [Math.floor(limit / 3)]
      );

      for (const msg of messages) {
        const severity = detectSeverity(msg.content);
        feedItems.push({
          id: `telegram-${msg.id}`,
          type: 'telegram',
          severity,
          title: `📡 ${msg.display_name || msg.channel_username}`,
          description: msg.content?.substring(0, 300) || 'No content',
          source: `@${msg.channel_username}`,
          timestamp: msg.posted_at,
          metadata: { category: msg.category, channel: msg.channel_username },
        });
      }
    }

    // Fetch alerts
    if (types.includes('alert')) {
      const alerts = await query<{
        id: string;
        alert_type: string;
        severity: string;
        title: string;
        description: string;
        data: Record<string, unknown>;
        created_at: string;
      }>(
        `SELECT id, alert_type, severity, title, description, data, created_at
         FROM alerts
         WHERE created_at > NOW() - INTERVAL '24 hours'
         AND alert_type IN ('flash_alert', 'formation_alert', 'activity_spike', 'regional_alert')
         ORDER BY created_at DESC
         LIMIT $1`,
        [Math.floor(limit / 3)]
      );

      for (const alert of alerts) {
        feedItems.push({
          id: `alert-${alert.id}`,
          type: 'alert',
          severity: alert.severity as FeedItem['severity'],
          title: alert.title,
          description: alert.description,
          region: (alert.data as Record<string, string>)?.region,
          timestamp: alert.created_at,
          metadata: alert.data,
        });
      }
    }

    // Sort by timestamp
    feedItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Get summary stats
    const stats = {
      total: feedItems.length,
      strikes: feedItems.filter(f => f.type === 'strike').length,
      telegram: feedItems.filter(f => f.type === 'telegram').length,
      alerts: feedItems.filter(f => f.type === 'alert').length,
      critical: feedItems.filter(f => f.severity === 'critical').length,
      high: feedItems.filter(f => f.severity === 'high').length,
    };

    return NextResponse.json({
      success: true,
      data: feedItems.slice(0, limit),
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching intel feed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch intel feed' },
      { status: 500 }
    );
  }
}

function getStrikeEmoji(eventType: string): string {
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

function detectSeverity(content: string): FeedItem['severity'] {
  if (!content) return 'low';

  const lower = content.toLowerCase();

  // Critical keywords
  if (
    lower.includes('عاجل') || // Urgent in Arabic
    lower.includes('breaking') ||
    lower.includes('غارة') || // Airstrike
    lower.includes('صاروخ') || // Missile
    lower.includes('قصف') || // Bombardment
    lower.includes('انفجار') // Explosion
  ) {
    return 'critical';
  }

  // High keywords
  if (
    lower.includes('طائرات') || // Aircraft
    lower.includes('درون') || // Drone
    lower.includes('مسيرة') || // UAV
    lower.includes('military') ||
    lower.includes('حربي') // Military
  ) {
    return 'high';
  }

  // Medium keywords
  if (
    lower.includes('إطلاق') || // Launch
    lower.includes('تحرك') || // Movement
    lower.includes('رصد') // Spotted
  ) {
    return 'medium';
  }

  return 'low';
}
