import type { Aircraft, Flight, FlightPattern } from './aircraft';
import type { NewsEvent } from './news';

export interface Correlation {
  id: string;
  news_event_id: string;
  flight_id: string | null;
  aircraft_id: string | null;
  correlation_type: CorrelationType;
  confidence_score: number;
  temporal_score: number;
  spatial_score: number;
  entity_score: number;
  pattern_score: number;
  corroboration_score: number;
  evidence: CorrelationEvidence;
  status: CorrelationStatus;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CorrelationType =
  | 'temporal'
  | 'spatial'
  | 'entity'
  | 'pattern'
  | 'combined';

export type CorrelationStatus =
  | 'pending'
  | 'verified'
  | 'dismissed'
  | 'flagged';

export interface CorrelationEvidence {
  temporal?: {
    newsTime: string;
    flightTime: string;
    differenceMinutes: number;
  };
  spatial?: {
    newsLocation: {
      name: string;
      lat: number;
      lon: number;
    };
    flightPosition: {
      lat: number;
      lon: number;
    };
    distanceNm: number;
  };
  entity?: {
    matchedEntities: string[];
    aircraftType?: string;
    country?: string;
  };
  pattern?: {
    detectedPattern: FlightPattern;
    duration: number;
    area: string;
  };
  corroboration?: {
    sourceCount: number;
    sources: string[];
  };
}

export interface CorrelationWithRelations extends Correlation {
  news_event?: NewsEvent;
  flight?: Flight;
  aircraft?: Aircraft;
}

export interface Alert {
  id: string;
  correlation_id: string | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  data: Record<string, unknown>;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export type AlertType =
  | 'new_correlation'
  | 'high_confidence_match'
  | 'unusual_pattern'
  | 'watchlist_aircraft'
  | 'breaking_news'
  | 'region_activity'
  | 'geofence_entry'
  | 'geofence_exit'
  | 'geofence_dwell';

export type AlertSeverity =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export interface RegionOfInterest {
  id: string;
  name: string;
  description: string | null;
  geom: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  center_lat: number;
  center_lon: number;
  radius_nm: number | null;
  is_active: boolean;
  alert_on_entry: boolean;
  alert_on_pattern: boolean;
  created_at: string;
  updated_at: string;
}

export interface CorrelationFactors {
  temporalProximity: number;
  spatialProximity: number;
  sourceCredibility: number;
  patternSignificance: number;
  corroboration: number;
}

export const CORRELATION_WEIGHTS: Record<keyof CorrelationFactors, number> = {
  temporalProximity: 0.25,
  spatialProximity: 0.25,
  sourceCredibility: 0.20,
  patternSignificance: 0.15,
  corroboration: 0.15,
};

export function calculateConfidence(factors: CorrelationFactors): number {
  const weighted =
    factors.temporalProximity * CORRELATION_WEIGHTS.temporalProximity +
    factors.spatialProximity * CORRELATION_WEIGHTS.spatialProximity +
    factors.sourceCredibility * CORRELATION_WEIGHTS.sourceCredibility +
    factors.patternSignificance * CORRELATION_WEIGHTS.patternSignificance +
    factors.corroboration * CORRELATION_WEIGHTS.corroboration;

  return Math.round(weighted * 100) / 100;
}

export function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

export function getConfidenceColor(score: number): string {
  const level = getConfidenceLevel(score);
  switch (level) {
    case 'high':
      return 'text-confidence-high';
    case 'medium':
      return 'text-confidence-medium';
    case 'low':
      return 'text-confidence-low';
  }
}
