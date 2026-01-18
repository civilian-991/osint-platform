import { NextRequest, NextResponse } from 'next/server';
import { execute, query, queryOne } from '@/lib/db';
import { gdeltService, fetchMilitaryAviationNews } from '@/lib/services/gdelt';
import { correlationEngine } from '@/lib/services/correlation-engine';
import type { Flight, Position } from '@/lib/types/aircraft';
import type { NewsEvent } from '@/lib/types/news';

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
        const newsRecord = await queryOne<{ id: string }>(
          `INSERT INTO news_events (
            source, source_id, title, content, url, image_url,
            published_at, fetched_at, language, countries, locations, entities,
            categories, sentiment_score, credibility_score, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
          ON CONFLICT (source, source_id) DO NOTHING
          RETURNING id`,
          [
            newsEvent.source,
            newsEvent.source_id,
            newsEvent.title,
            newsEvent.content,
            newsEvent.url,
            newsEvent.image_url,
            newsEvent.published_at,
            newsEvent.fetched_at,
            newsEvent.language,
            JSON.stringify(newsEvent.countries),
            JSON.stringify(newsEvent.locations),
            JSON.stringify(newsEvent.entities),
            JSON.stringify(newsEvent.categories),
            newsEvent.sentiment_score,
            newsEvent.credibility_score,
          ]
        );

        if (!newsRecord) {
          skippedNews++;
          continue;
        }

        insertedNews++;

        // Try to find correlations with recent flights
        // Get flights from the last 4 hours
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

        const flights = await query<Flight>(
          `SELECT * FROM flights WHERE departure_time >= $1`,
          [fourHoursAgo]
        );

        const positions = await query<Position>(
          `SELECT * FROM positions WHERE timestamp >= $1`,
          [fourHoursAgo]
        );

        if (flights.length > 0) {
          // Create full news event with ID
          const fullNewsEvent: NewsEvent = {
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
            try {
              await execute(
                `INSERT INTO correlations (
                  news_event_id, flight_id, aircraft_id, correlation_type,
                  confidence_score, temporal_score, spatial_score, entity_score,
                  pattern_score, corroboration_score, evidence, status,
                  created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
                [
                  newsRecord.id,
                  correlation.flight_id || null,
                  correlation.aircraft_id || null,
                  correlation.correlation_type,
                  correlation.confidence_score,
                  correlation.temporal_score,
                  correlation.spatial_score,
                  correlation.entity_score,
                  correlation.pattern_score,
                  correlation.corroboration_score,
                  JSON.stringify(correlation.evidence || {}),
                  correlation.status || 'pending',
                ]
              );
              correlationsCreated++;
            } catch (corrError) {
              console.error('Error inserting correlation:', corrError);
            }
          }

          // Generate and insert alerts for high-confidence correlations
          const highConfCorrelations = correlations.filter(
            (c) => c.confidence_score >= 0.6
          );

          if (highConfCorrelations.length > 0) {
            const alerts = correlationEngine.generateAlerts(highConfCorrelations);

            for (const alert of alerts) {
              try {
                await execute(
                  `INSERT INTO alerts (
                    correlation_id, alert_type, severity, title, description,
                    data, is_read, is_dismissed, created_at
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                  [
                    alert.correlation_id || null,
                    alert.alert_type,
                    alert.severity,
                    alert.title,
                    alert.description,
                    JSON.stringify(alert.data || {}),
                    alert.is_read,
                    alert.is_dismissed,
                  ]
                );
              } catch (alertError) {
                console.error('Error inserting alert:', alertError);
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
