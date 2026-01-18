import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { fetchMilitaryAviationNews, gdeltService } from '@/lib/services/gdelt';
import type { NewsEvent } from '@/lib/types/news';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const live = searchParams.get('live') === 'true';
    const region = searchParams.get('region');
    const timespan = searchParams.get('timespan') || '24h';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // If live mode, fetch directly from GDELT
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

      return NextResponse.json({
        success: true,
        data: newsEvents.slice(0, limit),
        count: newsEvents.length,
        source: 'gdelt',
      });
    }

    // Otherwise fetch from database
    let queryText = `
      SELECT * FROM news_events
      ${region ? "WHERE $2 = ANY(countries)" : ''}
      ORDER BY published_at DESC
      LIMIT $1
    `;

    const params = region ? [limit, region.toLowerCase()] : [limit];
    const data = await query<NewsEvent>(queryText, params);

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
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
