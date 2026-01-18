import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/server';
import {
  getGeofences,
  createGeofence,
  getGeofenceAlerts,
} from '@/lib/services/geofence-monitor';
import type { CreateGeofenceRequest } from '@/lib/types/geofence';

/**
 * GET /api/geofences
 * List all geofences for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeAlerts = searchParams.get('includeAlerts') === 'true';

    const geofences = await getGeofences(userId);

    let response: Record<string, unknown> = {
      success: true,
      data: geofences,
      count: geofences.length,
    };

    if (includeAlerts) {
      const { alerts, unread_count } = await getGeofenceAlerts(userId, { limit: 10 });
      response = {
        ...response,
        alerts,
        unread_alerts: unread_count,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching geofences:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/geofences
 * Create a new geofence
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      coordinates,
      alert_on_entry,
      alert_on_exit,
      alert_on_dwell,
      dwell_threshold_seconds,
      fill_color,
      fill_opacity,
      stroke_color,
      stroke_width,
      military_only,
      aircraft_types,
      is_active,
    } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    if (name.length > 255) {
      return NextResponse.json(
        { success: false, error: 'Name must be 255 characters or less' },
        { status: 400 }
      );
    }

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
      return NextResponse.json(
        { success: false, error: 'At least 3 coordinates are required to form a polygon' },
        { status: 400 }
      );
    }

    // Validate coordinate format
    for (const coord of coordinates) {
      if (!Array.isArray(coord) || coord.length !== 2) {
        return NextResponse.json(
          { success: false, error: 'Each coordinate must be [longitude, latitude]' },
          { status: 400 }
        );
      }
      const [lng, lat] = coord;
      if (typeof lng !== 'number' || typeof lat !== 'number') {
        return NextResponse.json(
          { success: false, error: 'Coordinates must be numbers' },
          { status: 400 }
        );
      }
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        return NextResponse.json(
          { success: false, error: 'Invalid coordinate values' },
          { status: 400 }
        );
      }
    }

    // Validate optional fields
    if (dwell_threshold_seconds !== undefined &&
        (typeof dwell_threshold_seconds !== 'number' || dwell_threshold_seconds < 0)) {
      return NextResponse.json(
        { success: false, error: 'Dwell threshold must be a positive number' },
        { status: 400 }
      );
    }

    if (fill_opacity !== undefined &&
        (typeof fill_opacity !== 'number' || fill_opacity < 0 || fill_opacity > 1)) {
      return NextResponse.json(
        { success: false, error: 'Fill opacity must be between 0 and 1' },
        { status: 400 }
      );
    }

    const createData: CreateGeofenceRequest = {
      name: name.trim(),
      description: description || undefined,
      coordinates,
      alert_on_entry,
      alert_on_exit,
      alert_on_dwell,
      dwell_threshold_seconds,
      fill_color,
      fill_opacity,
      stroke_color,
      stroke_width,
      military_only,
      aircraft_types,
      is_active,
    };

    const geofence = await createGeofence(userId, createData);

    return NextResponse.json({
      success: true,
      data: geofence,
    });
  } catch (error) {
    console.error('Error creating geofence:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
