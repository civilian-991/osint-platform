// Predictive Intelligence Types
// Trajectory forecasting, proximity warnings, and formation predictions

import type { TypicalRegion } from './ml';

// Re-export TypicalRegion for convenience
export type { TypicalRegion };

// ============================================
// TRAJECTORY PREDICTIONS
// ============================================

export interface TrajectoryPrediction {
  id: string;
  aircraft_id: string;
  icao_hex: string;
  // Prediction horizons (5, 15, 30 minutes)
  horizon_minutes: number;
  // Predicted position
  predicted_lat: number;
  predicted_lon: number;
  predicted_altitude: number | null;
  predicted_heading: number | null;
  predicted_speed: number | null;
  // Uncertainty cone
  uncertainty_radius_nm: number;
  confidence: number;
  // Source data
  source_lat: number;
  source_lon: number;
  source_altitude: number | null;
  source_heading: number | null;
  source_speed: number | null;
  turn_rate: number | null;
  vertical_rate: number | null;
  // Method
  prediction_method: PredictionMethod;
  model_version: string;
  // Timestamps
  predicted_at: string;
  expires_at: string;
  created_at: string;
}

export type PredictionMethod =
  | 'physics_basic' // Simple linear extrapolation
  | 'physics_behavioral' // Physics + behavioral profile
  | 'ml_enhanced'; // ML-based prediction

export interface TrajectoryPredictionInput {
  aircraft_id: string;
  icao_hex: string;
  // Current state
  latitude: number;
  longitude: number;
  altitude: number | null;
  heading: number | null;
  ground_speed: number | null;
  turn_rate?: number | null;
  vertical_rate?: number | null;
  // Behavioral context (optional, improves accuracy)
  typical_regions?: TypicalRegion[];
  typical_patterns?: string[];
}

export interface PredictedPosition {
  horizon_minutes: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  uncertainty_radius_nm: number;
  confidence: number;
}

// Uncertainty cone for visualization
export interface UncertaintyCone {
  horizon_minutes: number;
  center_lat: number;
  center_lon: number;
  radius_nm: number;
  confidence: number;
  // Polygon points for rendering (optional)
  polygon?: [number, number][];
}

// ============================================
// PROXIMITY WARNINGS
// ============================================

export interface ProximityWarning {
  id: string;
  // Aircraft pair
  aircraft_id_1: string;
  aircraft_id_2: string;
  icao_hex_1: string;
  icao_hex_2: string;
  // Warning details
  warning_type: ProximityWarningType;
  severity: ProximitySeverity;
  // Closest approach
  closest_approach_nm: number;
  closest_approach_time: string;
  // Positions
  lat_1: number;
  lon_1: number;
  altitude_1: number | null;
  lat_2: number;
  lon_2: number;
  altitude_2: number | null;
  // Dynamics
  closure_rate_kts: number | null;
  vertical_separation_ft: number | null;
  // Status
  confidence: number;
  is_active: boolean;
  is_acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  // Timestamps
  first_detected_at: string;
  last_updated_at: string;
  resolved_at: string | null;
  created_at: string;
}

export type ProximityWarningType =
  | 'convergence' // Aircraft converging on similar path
  | 'parallel_approach' // Parallel paths getting closer
  | 'crossing' // Paths will cross
  | 'same_altitude' // Same altitude, close laterally
  | 'vertical_conflict'; // Vertical separation decreasing

export type ProximitySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ProximityAnalysisInput {
  aircraft_id_1: string;
  icao_hex_1: string;
  lat_1: number;
  lon_1: number;
  altitude_1: number | null;
  heading_1: number | null;
  speed_1: number | null;
  aircraft_id_2: string;
  icao_hex_2: string;
  lat_2: number;
  lon_2: number;
  altitude_2: number | null;
  heading_2: number | null;
  speed_2: number | null;
}

export interface ProximityResult {
  has_conflict: boolean;
  warning_type: ProximityWarningType | null;
  severity: ProximitySeverity | null;
  closest_approach_nm: number;
  closest_approach_time: string | null;
  time_to_closest_minutes: number | null;
  closure_rate_kts: number | null;
  vertical_separation_ft: number | null;
  confidence: number;
}

// ============================================
// FORMATION PREDICTIONS
// ============================================

export interface FormationPrediction {
  id: string;
  formation_id: string | null;
  formation_type: string;
  // Predicted members
  predicted_aircraft_ids: string[];
  predicted_icao_hexes: string[];
  // Prediction details
  join_probability: number;
  predicted_join_time: string | null;
  predicted_location_lat: number | null;
  predicted_location_lon: number | null;
  // Reasoning
  prediction_basis: FormationPredictionBasis;
  confidence: number;
  // Status
  expires_at: string;
  validated: boolean | null;
  validated_at: string | null;
  created_at: string;
}

export type FormationPredictionBasis =
  | 'trajectory_convergence' // Trajectories converging
  | 'historical_pattern' // Based on past behavior
  | 'callsign_sequence' // Sequential callsigns
  | 'operator_pattern' // Same operator typical grouping
  | 'mission_profile'; // Mission type suggests grouping

// ============================================
// PREDICTION VALIDATION
// ============================================

export interface PredictionValidationStats {
  id: string;
  prediction_type: 'trajectory' | 'proximity' | 'formation';
  horizon_minutes: number | null;
  // Accuracy
  total_predictions: number;
  validated_predictions: number;
  accurate_predictions: number;
  // Error stats
  mean_error: number | null;
  median_error: number | null;
  error_std_dev: number | null;
  max_error: number | null;
  // Time window
  period_start: string;
  period_end: string;
  created_at: string;
}

export interface ValidationResult {
  prediction_id: string;
  is_accurate: boolean;
  error_value: number | null;
  error_type: string; // 'distance_nm', 'time_minutes', etc.
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getProximitySeverityColor(severity: ProximitySeverity): string {
  switch (severity) {
    case 'critical':
      return '#dc2626'; // red-600
    case 'high':
      return '#ea580c'; // orange-600
    case 'medium':
      return '#ca8a04'; // yellow-600
    case 'low':
      return '#16a34a'; // green-600
    default:
      return '#6b7280'; // gray-500
  }
}

export function getProximityWarningLabel(type: ProximityWarningType): string {
  switch (type) {
    case 'convergence':
      return 'Converging Paths';
    case 'parallel_approach':
      return 'Parallel Approach';
    case 'crossing':
      return 'Path Crossing';
    case 'same_altitude':
      return 'Same Altitude';
    case 'vertical_conflict':
      return 'Vertical Conflict';
    default:
      return 'Unknown';
  }
}

export function formatTimeToClosest(minutes: number): string {
  if (minutes < 1) {
    return `${Math.round(minutes * 60)}s`;
  }
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

// Prediction horizon options
export const PREDICTION_HORIZONS = [5, 15, 30] as const;
export type PredictionHorizon = (typeof PREDICTION_HORIZONS)[number];

// Proximity thresholds (nautical miles)
export const PROXIMITY_THRESHOLDS = {
  critical: 3, // Less than 3nm
  high: 5, // 3-5nm
  medium: 10, // 5-10nm
  low: 20, // 10-20nm
} as const;

// Confidence decay rates per horizon
export const CONFIDENCE_DECAY = {
  5: 0.95, // 5 min: 95% of base confidence
  15: 0.85, // 15 min: 85% of base confidence
  30: 0.70, // 30 min: 70% of base confidence
} as const;
