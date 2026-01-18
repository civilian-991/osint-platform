import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { fetchMilitaryAviationNews, gdeltService } from '@/lib/services/gdelt';
import type { NewsEvent } from '@/lib/types/news';

interface TelegramMessage {
  id: string;
  content: string;
  channel_username: string;
  display_name: string;
  posted_at: string;
  category: string;
  media_type?: string;
  views?: number;
}

// Extended NewsEvent type for Telegram
interface TelegramNewsEvent extends NewsEvent {
  _isTelegram: boolean;
  _telegramChannel: string;
  _views?: number;
  source_name?: string;
  source_domain?: string;
}

// Convert Telegram message to NewsEvent format
function telegramToNewsEvent(msg: TelegramMessage): TelegramNewsEvent {
  // Detect severity/category from content
  const content = msg.content?.toLowerCase() || '';
  const isCritical = content.includes('عاجل') || content.includes('breaking') ||
                     content.includes('غارة') || content.includes('قصف');

  const now = new Date().toISOString();

  return {
    id: `telegram-${msg.id}`,
    source: 'social' as const,
    source_id: `telegram-${msg.channel_username}-${msg.id}`,
    url: `https://t.me/${msg.channel_username}`,
    title: `📡 ${msg.display_name || msg.channel_username}`,
    content: msg.content || '',
    published_at: msg.posted_at,
    fetched_at: now,
    language: detectLanguage(msg.content),
    countries: detectCountries(msg.content),
    locations: [],
    entities: extractBasicEntities(msg.content),
    categories: [msg.category, 'telegram', isCritical ? 'breaking' : 'intel'].filter(Boolean),
    sentiment_score: null,
    credibility_score: 0.6, // Telegram sources get medium credibility
    image_url: null,
    created_at: msg.posted_at,
    // Extended fields
    _isTelegram: true,
    _telegramChannel: msg.channel_username,
    _views: msg.views,
    source_name: msg.display_name || msg.channel_username,
    source_domain: 't.me',
  };
}

// Simple language detection
function detectLanguage(text: string): string {
  if (!text) return 'unknown';
  // Arabic characters
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  // Hebrew characters
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  // Cyrillic
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';
  return 'en';
}

// Detect countries from content
function detectCountries(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const countries: string[] = [];

  const countryPatterns: Record<string, string[]> = {
    israel: ['israel', 'israeli', 'إسرائيل', 'اسرائيل', 'الاحتلال'],
    lebanon: ['lebanon', 'lebanese', 'لبنان', 'لبناني', 'بيروت', 'beirut'],
    syria: ['syria', 'syrian', 'سوريا', 'سوري', 'دمشق', 'damascus'],
    iran: ['iran', 'iranian', 'إيران', 'ايران', 'طهران', 'tehran'],
    gaza: ['gaza', 'غزة', 'palestinian'],
    iraq: ['iraq', 'iraqi', 'العراق', 'عراق', 'بغداد'],
    yemen: ['yemen', 'yemeni', 'اليمن', 'يمن', 'صنعاء', 'houthi'],
  };

  for (const [country, patterns] of Object.entries(countryPatterns)) {
    if (patterns.some(p => lower.includes(p))) {
      countries.push(country);
    }
  }

  return countries;
}

// Entity type from NewsEntity
type EntityType = 'person' | 'organization' | 'location' | 'aircraft' | 'military' | 'event';

// Extract basic entities from text
function extractBasicEntities(text: string): Array<{ name: string; type: EntityType }> {
  if (!text) return [];
  const entities: Array<{ name: string; type: EntityType }> = [];

  // Military terms - using only valid EntityType values
  const militaryPatterns: Array<{ pattern: RegExp; type: EntityType }> = [
    { pattern: /F-?35|F-?16|F-?15|طائرة|aircraft/gi, type: 'aircraft' },
    { pattern: /drone|مسيرة|درون|UAV/gi, type: 'aircraft' },
    { pattern: /missile|صاروخ|rocket/gi, type: 'military' },
    { pattern: /airstrike|غارة|قصف|strike/gi, type: 'military' },
    { pattern: /IDF|جيش|military|army/gi, type: 'military' },
    { pattern: /Hezbollah|حزب الله/gi, type: 'organization' },
    { pattern: /Hamas|حماس/gi, type: 'organization' },
  ];

  for (const { pattern, type } of militaryPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      entities.push({ name: matches[0], type });
    }
  }

  return entities;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const live = searchParams.get('live') === 'true';
    const region = searchParams.get('region');
    const timespan = searchParams.get('timespan') || '24h';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const includeTelegram = searchParams.get('telegram') !== 'false'; // Include by default

    // If live mode, fetch directly from GDELT + Telegram
    if (live) {
      let articles;

      if (region) {
        articles = await gdeltService.fetchRegionNews(region, timespan);
      } else {
        articles = await fetchMilitaryAviationNews(timespan);
      }

      // Filter by relevance and convert to our format
      const filtered = gdeltService.filterByRelevance(articles, 0.1);
      const newsEvents = filtered.map((article) =>
        gdeltService.convertToNewsEvent(article)
      );

      // Fetch Telegram messages if enabled
      let telegramEvents: TelegramNewsEvent[] = [];
      if (includeTelegram) {
        try {
          const telegramMessages = await query<TelegramMessage>(
            `SELECT m.id, m.content, c.channel_username, c.display_name, m.posted_at, c.category, m.media_type, m.views
             FROM telegram_messages m
             JOIN telegram_channels c ON m.channel_id = c.id
             WHERE m.posted_at > NOW() - INTERVAL '48 hours'
             AND m.content IS NOT NULL AND m.content != ''
             ORDER BY m.posted_at DESC
             LIMIT $1`,
            [Math.floor(limit / 2)]
          );
          telegramEvents = telegramMessages.map(telegramToNewsEvent);
        } catch (err) {
          console.error('Error fetching Telegram messages:', err);
        }
      }

      // Merge and sort by timestamp
      const allEvents = [...newsEvents, ...telegramEvents]
        .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
        .slice(0, limit);

      return NextResponse.json({
        success: true,
        data: allEvents,
        count: allEvents.length,
        stats: {
          gdelt: newsEvents.length,
          telegram: telegramEvents.length,
        },
        source: 'gdelt+telegram',
      });
    }

    // Otherwise fetch from database (news_events + telegram)
    let newsData: NewsEvent[] = [];
    let telegramData: TelegramNewsEvent[] = [];

    // Fetch news events
    const newsQuery = `
      SELECT * FROM news_events
      ${region ? "WHERE $2 = ANY(countries)" : ''}
      ORDER BY published_at DESC
      LIMIT $1
    `;
    const newsParams = region ? [Math.floor(limit / 2), region.toLowerCase()] : [Math.floor(limit / 2)];
    newsData = await query<NewsEvent>(newsQuery, newsParams);

    // Fetch telegram messages
    if (includeTelegram) {
      try {
        const telegramMessages = await query<TelegramMessage>(
          `SELECT m.id, m.content, c.channel_username, c.display_name, m.posted_at, c.category, m.media_type, m.views
           FROM telegram_messages m
           JOIN telegram_channels c ON m.channel_id = c.id
           WHERE m.content IS NOT NULL AND m.content != ''
           ORDER BY m.posted_at DESC
           LIMIT $1`,
          [Math.floor(limit / 2)]
        );
        telegramData = telegramMessages.map(telegramToNewsEvent);
      } catch (err) {
        console.error('Error fetching Telegram messages:', err);
      }
    }

    // Merge and sort
    const allData = [...newsData, ...telegramData]
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: allData,
      count: allData.length,
      stats: {
        news: newsData.length,
        telegram: telegramData.length,
      },
      source: 'database',
    });
  } catch (error) {
    console.error('Error in news API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
