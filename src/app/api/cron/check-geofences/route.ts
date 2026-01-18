import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  processGeofenceUpdates,
  cleanupStaleStates,
  getAllActiveGeofences,
} from '@/lib/services/geofence-monitor';
import type { AircraftPositionForGeofence } from '@/lib/types/geofence';

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  // Check Vercel cron header first (auto-set by Vercel for cron jobs)
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron) {
    return true;
  }

  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without secret
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // Allow if no CRON_SECRET is set (for testing)
  if (!cronSecret) {
    console.warn('CRON_SECRET not set, allowing request');
    return true;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * GET /api/cron/check-geofences
 * Check all aircraft positions against active geofences
 * Should run every 30 seconds
 */
export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const startTime = Date.now();

    // Check if there are any active geofences
    const activeGeofences = await getAllActiveGeofences();
    if (activeGeofences.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active geofences to check',
        stats: {
          activeGeofences: 0,
          positionsChecked: 0,
          stateChanges: 0,
          durationMs: Date.now() - startTime,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Get recent aircraft positions from positions_latest table
    // This table is automatically updated by triggers from the positions table
    const positions = await query<{
      icao_hex: string;
      latitude: number;
      longitude: number;
      altitude: number | null;
      callsign: string | null;
      ground_speed: number | null;
      track: number | null;
    }>(
      `SELECT
        pl.icao_hex,
        pl.latitude,
        pl.longitude,
        pl.altitude,
        pl.callsign,
        pl.ground_speed,
        pl.track
       FROM positions_latest pl
       JOIN aircraft a ON pl.icao_hex = a.icao_hex
       WHERE pl.timestamp > NOW() - INTERVAL '5 minutes'
         AND pl.latitude IS NOT NULL
         AND pl.longitude IS NOT NULL`
    );

    if (positions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No recent positions to check',
        stats: {
          activeGeofences: activeGeofences.length,
          positionsChecked: 0,
          stateChanges: 0,
          durationMs: Date.now() - startTime,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Get aircraft type info for filtering
    const aircraftInfo = await query<{
      icao_hex: string;
      type_code: string | null;
      registration: string | null;
    }>(
      `SELECT icao_hex, type_code, registration FROM aircraft
       WHERE icao_hex = ANY($1)`,
      [positions.map(p => p.icao_hex)]
    );

    const aircraftMap = new Map(aircraftInfo.map(a => [a.icao_hex, a]));

    // Convert to geofence check format
    const positionsForCheck: AircraftPositionForGeofence[] = positions.map(p => {
      const aircraft = aircraftMap.get(p.icao_hex);
      return {
        icao_hex: p.icao_hex,
        lat: p.latitude,
        lon: p.longitude,
        altitude: p.altitude,
        callsign: p.callsign,
        aircraft_type: aircraft?.type_code || null,
        registration: aircraft?.registration || null,
        speed: p.ground_speed,
        heading: p.track,
      };
    });

    // Process geofence updates
    const stateChanges = await processGeofenceUpdates(positionsForCheck);

    // Cleanup stale states (aircraft not seen for 30 minutes)
    const cleanedUp = await cleanupStaleStates(30);

    const duration = Date.now() - startTime;

    console.log(
      `Geofence check: ${positions.length} positions, ${activeGeofences.length} geofences, ` +
      `${stateChanges.length} state changes, ${cleanedUp} stale states cleaned up in ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      message: `Checked ${positions.length} aircraft against ${activeGeofences.length} geofences`,
      stats: {
        activeGeofences: activeGeofences.length,
        positionsChecked: positions.length,
        stateChanges: stateChanges.length,
        staleStatesCleaned: cleanedUp,
        durationMs: duration,
        changes: stateChanges.map(c => ({
          type: c.type,
          geofence: c.geofence_name,
          icao_hex: c.icao_hex,
          callsign: c.position.callsign,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in check-geofences cron:', error);
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
