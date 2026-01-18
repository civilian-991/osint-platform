import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { PositionLatest, Aircraft } from '@/lib/types/aircraft';

interface PositionWithAircraft {
  id: string;
  aircraft_id: string | null;
  icao_hex: string;
  callsign: string | null;
  latitude: number;
  longitude: number;
  altitude: number | null;
  ground_speed: number | null;
  track: number | null;
  vertical_rate: number | null;
  squawk: string | null;
  on_ground: boolean;
  timestamp: string;
  source: string;
  aircraft_registration: string | null;
  aircraft_type_code: string | null;
  aircraft_type_description: string | null;
  aircraft_operator: string | null;
  aircraft_country: string | null;
  aircraft_is_military: boolean | null;
  aircraft_military_category: string | null;
  aircraft_watchlist_category: string | null;
}

async function getLatestPositions(): Promise<PositionLatest[]> {
  const positions = await query<PositionWithAircraft>(`
    SELECT
      pl.id,
      pl.aircraft_id,
      pl.icao_hex,
      pl.callsign,
      pl.latitude,
      pl.longitude,
      pl.altitude,
      pl.ground_speed,
      pl.track,
      pl.vertical_rate,
      pl.squawk,
      pl.on_ground,
      pl.timestamp,
      pl.source,
      a.registration as aircraft_registration,
      a.type_code as aircraft_type_code,
      a.type_description as aircraft_type_description,
      a.operator as aircraft_operator,
      a.country as aircraft_country,
      a.is_military as aircraft_is_military,
      a.military_category as aircraft_military_category,
      a.watchlist_category as aircraft_watchlist_category
    FROM positions_latest pl
    LEFT JOIN aircraft a ON pl.aircraft_id = a.id
    WHERE pl.timestamp > NOW() - INTERVAL '5 minutes'
    ORDER BY pl.timestamp DESC
    LIMIT 500
  `);

  return positions.map((p) => ({
    id: p.id,
    aircraft_id: p.aircraft_id || '',
    icao_hex: p.icao_hex,
    callsign: p.callsign,
    latitude: p.latitude,
    longitude: p.longitude,
    altitude: p.altitude,
    ground_speed: p.ground_speed,
    track: p.track,
    vertical_rate: p.vertical_rate,
    squawk: p.squawk,
    on_ground: p.on_ground,
    timestamp: p.timestamp,
    source: p.source,
    aircraft: p.aircraft_id ? {
      id: p.aircraft_id,
      icao_hex: p.icao_hex,
      registration: p.aircraft_registration,
      type_code: p.aircraft_type_code,
      type_description: p.aircraft_type_description,
      operator: p.aircraft_operator,
      country: p.aircraft_country,
      is_military: p.aircraft_is_military ?? false,
      military_category: p.aircraft_military_category as Aircraft['military_category'],
      watchlist_category: p.aircraft_watchlist_category as Aircraft['watchlist_category'],
      created_at: '',
      updated_at: '',
    } : null,
  }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const interval = parseInt(searchParams.get('interval') || '5000', 10);
  const clampedInterval = Math.max(2000, Math.min(30000, interval));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = async () => {
        try {
          const positions = await getLatestPositions();
          const data = JSON.stringify({
            type: 'positions',
            data: positions,
            timestamp: new Date().toISOString(),
            count: positions.length,
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (error) {
          console.error('SSE error fetching positions:', error);
          const errorData = JSON.stringify({
            type: 'error',
            message: 'Failed to fetch positions',
            timestamp: new Date().toISOString(),
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        }
      };

      // Send initial data immediately
      await sendEvent();

      // Set up interval for updates
      const intervalId = setInterval(sendEvent, clampedInterval);

      // Send periodic heartbeat to keep connection alive
      const heartbeatId = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 30000);

      // Clean up on abort
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        clearInterval(heartbeatId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
