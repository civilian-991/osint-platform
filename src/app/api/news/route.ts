import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchMilitaryAviationNews, gdeltService } from '@/lib/services/gdelt';

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
      const filtered = gdeltService.filterByRelevance(articles, 0.3);
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
    const supabase = await createClient();

    let query = supabase
      .from('news_events')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(limit);

    // Filter by region if provided
    if (region) {
      query = query.contains('countries', [region.toLowerCase()]);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      count: data?.length || 0,
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
