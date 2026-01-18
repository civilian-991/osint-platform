import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { gdeltService, fetchMilitaryAviationNews } from '@/lib/services/gdelt';
import { correlationEngine } from '@/lib/services/correlation-engine';

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without secret
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  if (!cronSecret) {
    console.warn('CRON_SECRET not set');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const supabase = await createServiceClient();

    // Fetch news from GDELT (last 2 hours for more recent data)
    const articles = await fetchMilitaryAviationNews('2h');
    const filtered = gdeltService.filterByRelevance(articles, 0.3);

    console.log(`Fetched ${articles.length} articles, ${filtered.length} relevant`);

    let insertedNews = 0;
    let skippedNews = 0;
    let correlationsCreated = 0;

    // Process each article
    for (const article of filtered) {
      try {
        const newsEvent = gdeltService.convertToNewsEvent(article);

        // Insert news event (skip if duplicate)
        const { data: newsRecord, error: newsError } = await supabase
          .from('news_events')
          .upsert(newsEvent, {
            onConflict: 'source,source_id',
            ignoreDuplicates: true,
          })
          .select('id')
          .single();

        if (newsError) {
          if (newsError.code === '23505') {
            // Duplicate
            skippedNews++;
            continue;
          }
          console.error('Error inserting news:', newsError);
          continue;
        }

        if (newsRecord) {
          insertedNews++;

          // Try to find correlations with recent flights
          // Get flights from the last 4 hours
          const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

          const { data: flights } = await supabase
            .from('flights')
            .select('*')
            .gte('departure_time', fourHoursAgo);

          const { data: positions } = await supabase
            .from('positions')
            .select('*')
            .gte('timestamp', fourHoursAgo);

          if (flights && flights.length > 0 && positions) {
            // Create full news event with ID
            const fullNewsEvent = {
              ...newsEvent,
              id: newsRecord.id,
              created_at: new Date().toISOString(),
            };

            const correlations = correlationEngine.findCorrelations(
              [fullNewsEvent],
              flights,
              positions
            );

            // Insert correlations
            for (const correlation of correlations) {
              const { error: corrError } = await supabase
                .from('correlations')
                .insert({
                  ...correlation,
                  news_event_id: newsRecord.id,
                });

              if (!corrError) {
                correlationsCreated++;
              }
            }

            // Generate and insert alerts for high-confidence correlations
            const highConfCorrelations = correlations.filter(
              (c) => c.confidence_score >= 0.6
            );

            if (highConfCorrelations.length > 0) {
              const alerts = correlationEngine.generateAlerts(highConfCorrelations);

              for (const alert of alerts) {
                await supabase.from('alerts').insert(alert);
              }
            }
          }
        }
      } catch (articleError) {
        console.error('Error processing article:', articleError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${filtered.length} news articles`,
      stats: {
        fetched: articles.length,
        relevant: filtered.length,
        insertedNews,
        skippedNews,
        correlationsCreated,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in fetch-news cron:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Support POST for Vercel cron
export async function POST(request: NextRequest) {
  return GET(request);
}
