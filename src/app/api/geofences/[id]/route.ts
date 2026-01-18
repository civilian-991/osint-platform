import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/server';
import {
  getGeofenceById,
  updateGeofence,
  deleteGeofence,
  getAircraftInGeofence,
  getGeofenceAlerts,
} from '@/lib/services/geofence-monitor';
import type { UpdateGeofenceRequest } from '@/lib/types/geofence';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/geofences/[id]
 * Get a specific geofence with optional aircraft inside and alerts
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeAircraft = searchParams.get('includeAircraft') === 'true';
    const includeAlerts = searchParams.get('includeAlerts') === 'true';

    const geofence = await getGeofenceById(id, userId);

    if (!geofence) {
      return NextResponse.json(
        { success: false, error: 'Geofence not found' },
        { status: 404 }
      );
    }

    let response: Record<string, unknown> = {
      success: true,
      data: geofence,
    };

    if (includeAircraft) {
      const aircraft = await getAircraftInGeofence(id);
      response.aircraft_inside = aircraft;
    }

    if (includeAlerts) {
      const { alerts, unread_count } = await getGeofenceAlerts(userId, {
        geofenceId: id,
        limit: 20,
      });
      response.alerts = alerts;
      response.unread_alerts = unread_count;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching geofence:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/geofences/[id]
 * Update a geofence
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // Validate optional fields if provided
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Name cannot be empty' },
        { status: 400 }
      );
    }

    if (name !== undefined && name.length > 255) {
      return NextResponse.json(
        { success: false, error: 'Name must be 255 characters or less' },
        { status: 400 }
      );
    }

    if (coordinates !== undefined) {
      if (!Array.isArray(coordinates) || coordinates.length < 3) {
        return NextResponse.json(
          { success: false, error: 'At least 3 coordinates are required to form a polygon' },
          { status: 400 }
        );
      }

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
    }

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

    const updateData: UpdateGeofenceRequest = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (coordinates !== undefined) updateData.coordinates = coordinates;
    if (alert_on_entry !== undefined) updateData.alert_on_entry = alert_on_entry;
    if (alert_on_exit !== undefined) updateData.alert_on_exit = alert_on_exit;
    if (alert_on_dwell !== undefined) updateData.alert_on_dwell = alert_on_dwell;
    if (dwell_threshold_seconds !== undefined) updateData.dwell_threshold_seconds = dwell_threshold_seconds;
    if (fill_color !== undefined) updateData.fill_color = fill_color;
    if (fill_opacity !== undefined) updateData.fill_opacity = fill_opacity;
    if (stroke_color !== undefined) updateData.stroke_color = stroke_color;
    if (stroke_width !== undefined) updateData.stroke_width = stroke_width;
    if (military_only !== undefined) updateData.military_only = military_only;
    if (aircraft_types !== undefined) updateData.aircraft_types = aircraft_types;
    if (is_active !== undefined) updateData.is_active = is_active;

    const geofence = await updateGeofence(id, userId, updateData);

    if (!geofence) {
      return NextResponse.json(
        { success: false, error: 'Geofence not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: geofence,
    });
  } catch (error) {
    console.error('Error updating geofence:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/geofences/[id]
 * Delete a geofence
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const deleted = await deleteGeofence(id, userId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Geofence not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Geofence deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting geofence:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
