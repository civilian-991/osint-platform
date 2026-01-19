// Contextual Intelligence Types
// Infrastructure, airspace, activity zones, and position context

// ============================================
// INFRASTRUCTURE
// ============================================

export interface Infrastructure {
  id: string;
  name: string;
  // Type classification
  infrastructure_type: InfrastructureType;
  sub_type: string | null;
  // Location (GeoJSON point)
  location: GeoJSONPoint;
  // Additional spatial
  boundary: GeoJSONPolygon | null;
  runway_headings: number[] | null;
  // Identification
  icao_code: string | null;
  iata_code: string | null;
  country_code: string | null;
  region: string | null;
  // Strategic assessment
  strategic_importance: StrategicImportance;
  military_presence: boolean;
  // Metadata
  description: string | null;
  source: string;
  source_id: string | null;
  // Status
  is_active: boolean;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export type InfrastructureType =
  | 'military_base'
  | 'airport'
  | 'port'
  | 'refinery'
  | 'power_plant'
  | 'government'
  | 'industrial'
  | 'communications';

export type StrategicImportance = 'low' | 'medium' | 'high' | 'critical';

export interface InfrastructureInput {
  name: string;
  infrastructure_type: InfrastructureType;
  sub_type?: string;
  latitude: number;
  longitude: number;
  boundary?: [number, number][]; // Array of [lon, lat] for polygon
  icao_code?: string;
  iata_code?: string;
  country_code?: string;
  region?: string;
  strategic_importance?: StrategicImportance;
  military_presence?: boolean;
  description?: string;
  source?: string;
  source_id?: string;
}

// ============================================
// AIRSPACE
// ============================================

export interface Airspace {
  id: string;
  name: string;
  // Classification
  airspace_class: AirspaceClass;
  airspace_type: string | null;
  // Geometry (GeoJSON polygon)
  geom: GeoJSONPolygon;
  // Vertical limits
  lower_limit_ft: number | null;
  lower_limit_reference: AltitudeReference;
  upper_limit_ft: number | null;
  upper_limit_reference: AltitudeReference;
  // Operational
  controlling_agency: string | null;
  frequency_mhz: number | null;
  operating_hours: string | null;
  // Intelligence
  military_significance: MilitarySignificance;
  activity_typical: string | null;
  // Metadata
  country_code: string | null;
  source: string | null;
  source_id: string | null;
  // Status
  is_active: boolean;
  effective_from: string | null;
  effective_until: string | null;
  created_at: string;
  updated_at: string;
}

export type AirspaceClass =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'G'
  | 'restricted'
  | 'prohibited'
  | 'danger'
  | 'moa' // Military Operations Area
  | 'alert'
  | 'warning'
  | 'tfr'; // Temporary Flight Restriction

export type AltitudeReference = 'MSL' | 'AGL' | 'FL';

export type MilitarySignificance = 'low' | 'medium' | 'high';

export interface AirspaceInput {
  name: string;
  airspace_class: AirspaceClass;
  airspace_type?: string;
  boundary: [number, number][]; // Array of [lon, lat] for polygon
  lower_limit_ft?: number;
  lower_limit_reference?: AltitudeReference;
  upper_limit_ft?: number;
  upper_limit_reference?: AltitudeReference;
  controlling_agency?: string;
  frequency_mhz?: number;
  operating_hours?: string;
  military_significance?: MilitarySignificance;
  activity_typical?: string;
  country_code?: string;
}

// ============================================
// ACTIVITY ZONES
// ============================================

export interface ActivityZone {
  id: string;
  // Geometry
  geom: GeoJSONPolygon;
  center_lat: number;
  center_lon: number;
  radius_nm: number | null;
  // Activity metrics
  activity_level: ActivityLevel;
  aircraft_count: number;
  unique_aircraft_count: number;
  military_aircraft_count: number;
  formation_count: number;
  // Characteristics
  dominant_activity: string | null;
  dominant_aircraft_types: string[];
  // Temporal
  peak_hours: number[];
  active_days: number;
  period_start: string;
  period_end: string;
  // Status
  is_active: boolean;
  confidence: number;
  created_at: string;
  updated_at: string;
}

export type ActivityLevel = 'low' | 'moderate' | 'high' | 'intense';

export interface ActivityZoneInput {
  center_lat: number;
  center_lon: number;
  radius_nm: number;
  activity_level: ActivityLevel;
  aircraft_count: number;
  unique_aircraft_count: number;
  military_aircraft_count?: number;
  formation_count?: number;
  dominant_activity?: string;
  dominant_aircraft_types?: string[];
  peak_hours?: number[];
  period_start: string;
  period_end: string;
}

// ============================================
// POSITION CONTEXT
// ============================================

export interface PositionContext {
  // Scores (0-1)
  infrastructure_score: number;
  airspace_score: number;
  activity_score: number;
  combined_score: number;
  // Nearest infrastructure
  nearest_infrastructure: NearestInfrastructure | null;
  // Containing airspace
  containing_airspace: ContainingAirspace[];
  // Activity zone
  activity_zone: ActivityZoneContext | null;
  // Context summary
  context_summary: string;
  intelligence_value: IntelligenceValue;
}

export interface NearestInfrastructure {
  id: string;
  name: string;
  type: InfrastructureType;
  distance_nm: number;
  bearing: number;
  strategic_importance: StrategicImportance;
}

export interface ContainingAirspace {
  id: string;
  name: string;
  class: AirspaceClass;
  type: string | null;
  military_significance: MilitarySignificance;
  lower_limit_ft: number | null;
  upper_limit_ft: number | null;
}

export interface ActivityZoneContext {
  id: string;
  activity_level: ActivityLevel;
  dominant_activity: string | null;
  aircraft_count: number;
}

export type IntelligenceValue = 'low' | 'moderate' | 'high' | 'critical';

export interface PositionContextRequest {
  latitude: number;
  longitude: number;
  altitude?: number;
}

// ============================================
// CONTEXT CACHE
// ============================================

export interface PositionContextCache {
  id: string;
  grid_cell: string;
  center_lat: number;
  center_lon: number;
  // Scores
  infrastructure_score: number;
  airspace_score: number;
  activity_score: number;
  combined_score: number;
  // References
  nearest_infrastructure_id: string | null;
  nearest_infrastructure_distance_nm: number | null;
  nearest_airspace_id: string | null;
  nearest_activity_zone_id: string | null;
  // Details
  infrastructure_details: InfrastructureDetail[];
  airspace_details: AirspaceDetail[];
  // Validity
  computed_at: string;
  expires_at: string;
  created_at: string;
}

export interface InfrastructureDetail {
  id: string;
  name: string;
  type: InfrastructureType;
  distance_nm: number;
  strategic_importance: StrategicImportance;
}

export interface AirspaceDetail {
  id: string;
  name: string;
  class: AirspaceClass;
  military_significance: MilitarySignificance;
}

// ============================================
// GEOJSON TYPES
// ============================================

export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: [number, number][][]; // Array of rings, each ring is array of [lon, lat]
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getActivityLevelColor(level: ActivityLevel): string {
  switch (level) {
    case 'intense':
      return '#dc2626'; // red
    case 'high':
      return '#ea580c'; // orange
    case 'moderate':
      return '#ca8a04'; // yellow
    case 'low':
      return '#16a34a'; // green
    default:
      return '#6b7280'; // gray
  }
}

export function getAirspaceClassColor(cls: AirspaceClass): string {
  switch (cls) {
    case 'prohibited':
      return '#dc2626'; // red
    case 'restricted':
      return '#ea580c'; // orange
    case 'danger':
      return '#f59e0b'; // amber
    case 'moa':
      return '#8b5cf6'; // purple
    case 'warning':
      return '#eab308'; // yellow
    case 'alert':
      return '#f97316'; // orange
    case 'A':
    case 'B':
      return '#3b82f6'; // blue
    case 'C':
    case 'D':
      return '#06b6d4'; // cyan
    default:
      return '#94a3b8'; // gray
  }
}

export function getStrategicImportanceColor(importance: StrategicImportance): string {
  switch (importance) {
    case 'critical':
      return '#dc2626';
    case 'high':
      return '#ea580c';
    case 'medium':
      return '#ca8a04';
    case 'low':
      return '#16a34a';
    default:
      return '#6b7280';
  }
}

export function getIntelligenceValueFromScore(score: number): IntelligenceValue {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'moderate';
  return 'low';
}

export function getInfrastructureTypeLabel(type: InfrastructureType): string {
  switch (type) {
    case 'military_base':
      return 'Military Base';
    case 'airport':
      return 'Airport';
    case 'port':
      return 'Port';
    case 'refinery':
      return 'Refinery';
    case 'power_plant':
      return 'Power Plant';
    case 'government':
      return 'Government Facility';
    case 'industrial':
      return 'Industrial';
    case 'communications':
      return 'Communications';
    default:
      return 'Unknown';
  }
}

export function getAirspaceClassLabel(cls: AirspaceClass): string {
  switch (cls) {
    case 'prohibited':
      return 'Prohibited Area';
    case 'restricted':
      return 'Restricted Area';
    case 'danger':
      return 'Danger Area';
    case 'moa':
      return 'MOA';
    case 'warning':
      return 'Warning Area';
    case 'alert':
      return 'Alert Area';
    case 'tfr':
      return 'TFR';
    default:
      return `Class ${cls}`;
  }
}

// Context score weights
export const CONTEXT_WEIGHTS = {
  infrastructure: 0.35,
  airspace: 0.35,
  activity: 0.30,
} as const;

// Infrastructure importance scores
export const INFRASTRUCTURE_IMPORTANCE_SCORES = {
  critical: 1.0,
  high: 0.8,
  medium: 0.5,
  low: 0.3,
} as const;

// Airspace class significance scores
export const AIRSPACE_CLASS_SCORES = {
  prohibited: 1.0,
  restricted: 0.9,
  danger: 0.8,
  moa: 0.7,
  warning: 0.6,
  alert: 0.5,
  A: 0.3,
  B: 0.3,
  C: 0.2,
  D: 0.2,
  E: 0.1,
  G: 0.0,
  tfr: 0.7,
} as const;

// Activity level scores
export const ACTIVITY_LEVEL_SCORES = {
  intense: 1.0,
  high: 0.8,
  moderate: 0.5,
  low: 0.2,
} as const;
