/**
 * Geofence Types
 * TypeScript interfaces for geofence management and alerting
 */

import type { Feature, Polygon } from 'geojson';

// ================================================
// Core Geofence Types
// ================================================

export interface Geofence {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  // PostGIS geometry as GeoJSON
  geom: Polygon;
  geom_geojson?: Polygon; // From view
  // Alert configuration
  alert_on_entry: boolean;
  alert_on_exit: boolean;
  alert_on_dwell: boolean;
  dwell_threshold_seconds: number;
  // Visual styling
  fill_color: string;
  fill_opacity: number;
  stroke_color: string;
  stroke_width: number;
  // Filtering options
  military_only: boolean;
  aircraft_types: string[] | null;
  // Status
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeofenceWithStats extends Geofence {
  area_km2: number;
  aircraft_inside: number;
  alerts_24h: number;
}

// ================================================
// Geofence Aircraft State
// ================================================

export type GeofenceAircraftStateType = 'outside' | 'inside' | 'dwelling';

export interface GeofenceAircraftState {
  id: string;
  geofence_id: string;
  icao_hex: string;
  state: GeofenceAircraftStateType;
  entered_at: string | null;
  last_seen_at: string | null;
  dwell_start_at: string | null;
  // Entry position
  entry_lat: number | null;
  entry_lon: number | null;
  entry_altitude: number | null;
  // Last known position inside
  last_lat: number | null;
  last_lon: number | null;
  last_altitude: number | null;
  created_at: string;
  updated_at: string;
}

// ================================================
// Geofence Alerts
// ================================================

export type GeofenceAlertType = 'entry' | 'exit' | 'dwell';

export type GeofenceAlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface GeofenceAlert {
  id: string;
  geofence_id: string;
  user_id: string;
  icao_hex: string;
  alert_type: GeofenceAlertType;
  severity: GeofenceAlertSeverity;
  // Aircraft info
  callsign: string | null;
  aircraft_type: string | null;
  registration: string | null;
  // Position info
  lat: number;
  lon: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  // Dwell duration
  dwell_seconds: number | null;
  // Status
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export interface GeofenceAlertWithGeofence extends GeofenceAlert {
  geofence?: Geofence;
}

// ================================================
// API Request/Response Types
// ================================================

export interface CreateGeofenceRequest {
  name: string;
  description?: string;
  coordinates: [number, number][]; // Array of [lng, lat] coordinates
  alert_on_entry?: boolean;
  alert_on_exit?: boolean;
  alert_on_dwell?: boolean;
  dwell_threshold_seconds?: number;
  fill_color?: string;
  fill_opacity?: number;
  stroke_color?: string;
  stroke_width?: number;
  military_only?: boolean;
  aircraft_types?: string[];
  is_active?: boolean;
}

export interface UpdateGeofenceRequest {
  name?: string;
  description?: string;
  coordinates?: [number, number][];
  alert_on_entry?: boolean;
  alert_on_exit?: boolean;
  alert_on_dwell?: boolean;
  dwell_threshold_seconds?: number;
  fill_color?: string;
  fill_opacity?: number;
  stroke_color?: string;
  stroke_width?: number;
  military_only?: boolean;
  aircraft_types?: string[];
  is_active?: boolean;
}

export interface GeofenceListResponse {
  geofences: GeofenceWithStats[];
  total: number;
}

export interface GeofenceAlertListResponse {
  alerts: GeofenceAlertWithGeofence[];
  total: number;
  unread_count: number;
}

// ================================================
// Geofence Monitor Types
// ================================================

export interface AircraftPositionForGeofence {
  icao_hex: string;
  lat: number;
  lon: number;
  altitude: number | null;
  callsign: string | null;
  aircraft_type: string | null;
  registration: string | null;
  speed: number | null;
  heading: number | null;
}

export interface GeofenceCheckResult {
  geofence_id: string;
  geofence_name: string;
  user_id: string;
  icao_hex: string;
  lat: number;
  lon: number;
  altitude: number | null;
  callsign: string | null;
  aircraft_type: string | null;
  registration: string | null;
  speed: number | null;
  heading: number | null;
  alert_on_entry: boolean;
  alert_on_exit: boolean;
  alert_on_dwell: boolean;
  dwell_threshold_seconds: number;
}

export interface GeofenceStateChange {
  type: 'entry' | 'exit' | 'dwell';
  geofence_id: string;
  geofence_name: string;
  user_id: string;
  icao_hex: string;
  position: AircraftPositionForGeofence;
  dwell_seconds?: number;
  previous_state: GeofenceAircraftStateType;
  new_state: GeofenceAircraftStateType;
}

// ================================================
// GeoJSON Feature Types for Map Display
// ================================================

export interface GeofenceFeature extends Feature<Polygon> {
  properties: {
    id: string;
    name: string;
    fill_color: string;
    fill_opacity: number;
    stroke_color: string;
    stroke_width: number;
    is_active: boolean;
    aircraft_inside?: number;
  };
}

export interface GeofenceFeatureCollection {
  type: 'FeatureCollection';
  features: GeofenceFeature[];
}

// ================================================
// Drawing Tool Types
// ================================================

export type DrawMode = 'simple_select' | 'direct_select' | 'draw_polygon' | 'draw_point' | 'draw_line_string';

export interface DrawEvent {
  features: Feature[];
  type: string;
}

export interface DrawCreateEvent extends DrawEvent {
  type: 'draw.create';
}

export interface DrawUpdateEvent extends DrawEvent {
  type: 'draw.update';
}

export interface DrawDeleteEvent extends DrawEvent {
  type: 'draw.delete';
}

export interface DrawSelectionChangeEvent extends DrawEvent {
  type: 'draw.selectionchange';
}

// ================================================
// Utility Functions
// ================================================

export function coordinatesToPolygon(coordinates: [number, number][]): Polygon {
  // Ensure the polygon is closed
  const closed = [...coordinates];
  if (
    closed.length > 0 &&
    (closed[0][0] !== closed[closed.length - 1][0] ||
      closed[0][1] !== closed[closed.length - 1][1])
  ) {
    closed.push(closed[0]);
  }

  return {
    type: 'Polygon',
    coordinates: [closed],
  };
}

export function polygonToCoordinates(polygon: Polygon): [number, number][] {
  if (!polygon.coordinates || polygon.coordinates.length === 0) {
    return [];
  }
  // Return the exterior ring, excluding the closing point
  const ring = polygon.coordinates[0];
  if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) {
    return ring.slice(0, -1) as [number, number][];
  }
  return ring as [number, number][];
}

export function getAlertSeverityColor(severity: GeofenceAlertSeverity): string {
  switch (severity) {
    case 'critical':
      return 'text-red-500';
    case 'high':
      return 'text-orange-500';
    case 'medium':
      return 'text-yellow-500';
    case 'low':
      return 'text-blue-500';
  }
}

export function getAlertTypeLabel(type: GeofenceAlertType): string {
  switch (type) {
    case 'entry':
      return 'Entered';
    case 'exit':
      return 'Exited';
    case 'dwell':
      return 'Dwelling';
  }
}

export function formatDwellTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
