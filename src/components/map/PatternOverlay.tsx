'use client';

import { useEffect } from 'react';
import type mapboxgl from 'mapbox-gl';
import type { FlightPattern } from '@/lib/types/aircraft';

export interface PatternData {
  id: string;
  pattern_type: FlightPattern;
  center_lat: number;
  center_lon: number;
  radius_nm: number;
  confidence: number;
  aircraft_icao?: string;
  metadata?: Record<string, unknown>;
}

interface PatternOverlayProps {
  map: mapboxgl.Map | null;
  patterns: PatternData[];
  visible?: boolean;
}

const PATTERN_COLORS: Record<FlightPattern, string> = {
  orbit: '#10b981', // emerald
  racetrack: '#f59e0b', // amber
  holding: '#8b5cf6', // violet
  tanker_track: '#06b6d4', // cyan
  straight: '#6b7280', // gray
};

const NM_TO_METERS = 1852;

export default function PatternOverlay({
  map,
  patterns,
  visible = true,
}: PatternOverlayProps) {
  useEffect(() => {
    if (!map || !map.loaded()) return;

    const sourceId = 'pattern-overlay-source';
    const circleLayerId = 'pattern-circles';
    const labelLayerId = 'pattern-labels';

    // Clean up existing layers and source
    if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId);
    if (map.getLayer(circleLayerId)) map.removeLayer(circleLayerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    if (!visible || patterns.length === 0) return;

    // Create GeoJSON features for patterns
    const features: GeoJSON.Feature[] = patterns
      .filter(p => p.center_lat && p.center_lon && p.radius_nm && p.pattern_type)
      .map((pattern) => {
        const radiusMeters = (pattern.radius_nm || 10) * NM_TO_METERS;
        const color = PATTERN_COLORS[pattern.pattern_type] || '#6b7280';

        return {
          type: 'Feature',
          properties: {
            id: pattern.id,
            pattern_type: pattern.pattern_type,
            confidence: pattern.confidence,
            radius_meters: radiusMeters,
            color,
            label: formatPatternLabel(pattern),
            aircraft_icao: pattern.aircraft_icao || '',
          },
          geometry: {
            type: 'Point',
            coordinates: [pattern.center_lon, pattern.center_lat],
          },
        };
      });

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    // Add source
    map.addSource(sourceId, {
      type: 'geojson',
      data: geojson,
    });

    // Add circle layer
    map.addLayer({
      id: circleLayerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': [
          'interpolate',
          ['exponential', 2],
          ['zoom'],
          4, ['/', ['get', 'radius_meters'], 50000],
          8, ['/', ['get', 'radius_meters'], 5000],
          12, ['/', ['get', 'radius_meters'], 500],
        ],
        'circle-color': ['get', 'color'],
        'circle-opacity': ['*', ['get', 'confidence'], 0.3],
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': 2,
        'circle-stroke-opacity': ['*', ['get', 'confidence'], 0.8],
      },
    });

    // Add label layer
    map.addLayer({
      id: labelLayerId,
      type: 'symbol',
      source: sourceId,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 11,
        'text-offset': [0, -2],
        'text-anchor': 'bottom',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': 'rgba(0, 0, 0, 0.9)',
        'text-halo-width': 1.5,
      },
    });

    // Cleanup on unmount
    return () => {
      if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId);
      if (map.getLayer(circleLayerId)) map.removeLayer(circleLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [map, patterns, visible]);

  return null; // This component only manages map layers
}

function formatPatternLabel(pattern: PatternData): string {
  const type = pattern.pattern_type?.replace('_', ' ').toUpperCase() || 'UNKNOWN';
  const confidence = Math.round((pattern.confidence || 0) * 100);
  const aircraft = pattern.aircraft_icao ? ` (${pattern.aircraft_icao})` : '';
  return `${type} ${confidence}%${aircraft}`;
}

// Helper component to display pattern legend
export function PatternLegend({ className }: { className?: string }) {
  const patternTypes: Array<{ type: FlightPattern; label: string }> = [
    { type: 'orbit', label: 'Orbit' },
    { type: 'racetrack', label: 'Racetrack' },
    { type: 'holding', label: 'Holding' },
    { type: 'tanker_track', label: 'Tanker Track' },
  ];

  return (
    <div className={className}>
      <div className="font-semibold text-xs mb-2">Patterns</div>
      <div className="space-y-1">
        {patternTypes.map(({ type, label }) => (
          <div key={type} className="flex items-center gap-2 text-xs">
            <span
              className="w-3 h-3 rounded-full border-2"
              style={{
                borderColor: PATTERN_COLORS[type],
                backgroundColor: `${PATTERN_COLORS[type]}40`,
              }}
            />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
