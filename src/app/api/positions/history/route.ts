import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface PlaybackPosition {
  icao_hex: string;
  callsign: string | null;
  latitude: number;
  longitude: number;
  altitude: number | null;
  ground_speed: number | null;
  track: number | null;
  timestamp: string;
  aircraft_type: string | null;
  military_category: string | null;
}

/**
 * GET /api/positions/history
 * Get historical positions for playback
 *
 * Query parameters:
 * - startTime: ISO timestamp for start of range
 * - endTime: ISO timestamp for end of range
 * - icaoHex: Optional specific aircraft ICAO hex
 * - sampleInterval: Sampling interval in seconds (default 30)
 * - militaryOnly: Whether to filter to military only (default true)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const icaoHex = searchParams.get('icaoHex');
    const sampleInterval = parseInt(searchParams.get('sampleInterval') || '30', 10);
    const militaryOnly = searchParams.get('militaryOnly') !== 'false';

    // Validate required parameters
    if (!startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: 'startTime and endTime are required' },
        { status: 400 }
      );
    }

    // Validate timestamps
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid timestamp format' },
        { status: 400 }
      );
    }

    // Limit range to 24 hours max
    const rangeMs = end.getTime() - start.getTime();
    if (rangeMs > 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { success: false, error: 'Time range cannot exceed 24 hours' },
        { status: 400 }
      );
    }

    if (rangeMs < 0) {
      return NextResponse.json(
        { success: false, error: 'endTime must be after startTime' },
        { status: 400 }
      );
    }

    // Validate sample interval
    if (sampleInterval < 5 || sampleInterval > 300) {
      return NextResponse.json(
        { success: false, error: 'sampleInterval must be between 5 and 300 seconds' },
        { status: 400 }
      );
    }

    let positions: PlaybackPosition[];

    if (icaoHex) {
      // Single aircraft query
      positions = await query<PlaybackPosition>(
        `SELECT * FROM get_sampled_positions($1, $2, $3, $4)`,
        [icaoHex.toUpperCase(), startTime, endTime, sampleInterval]
      );
    } else {
      // All aircraft query
      positions = await query<PlaybackPosition>(
        `SELECT * FROM get_playback_positions($1, $2, $3, $4)`,
        [startTime, endTime, sampleInterval, militaryOnly]
      );
    }

    // Group positions by timestamp for efficient playback
    const positionsByTime = new Map<number, PlaybackPosition[]>();

    for (const pos of positions) {
      const timestamp = new Date(pos.timestamp).getTime();
      // Round to sample interval
      const roundedTime = Math.floor(timestamp / (sampleInterval * 1000)) * (sampleInterval * 1000);

      if (!positionsByTime.has(roundedTime)) {
        positionsByTime.set(roundedTime, []);
      }
      positionsByTime.get(roundedTime)!.push(pos);
    }

    // Convert to sorted array
    const frames = Array.from(positionsByTime.entries())
      .sort(([a], [b]) => a - b)
      .map(([timestamp, positions]) => ({
        timestamp,
        positions,
      }));

    // Get unique aircraft count
    const uniqueAircraft = new Set(positions.map(p => p.icao_hex));

    return NextResponse.json({
      success: true,
      data: {
        frames,
        summary: {
          totalPositions: positions.length,
          totalFrames: frames.length,
          uniqueAircraft: uniqueAircraft.size,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          sampleInterval,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching position history:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
