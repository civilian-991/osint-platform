'use client';

import { useEffect, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import type { FormationDetection } from '@/lib/types/ml';

interface FormationOverlayProps {
  map: mapboxgl.Map | null;
  formations: FormationDetection[];
  selectedFormationId?: string;
}

const formationColors: Record<string, string> = {
  tanker_receiver: '#a855f7', // purple
  escort: '#3b82f6', // blue
  strike_package: '#ef4444', // red
  cap: '#f59e0b', // amber
  unknown: '#64748b', // slate
};

export default function FormationOverlay({
  map,
  formations,
  selectedFormationId,
}: FormationOverlayProps) {
  const updateFormationLayers = useCallback(() => {
    if (!map) return;

    // Remove existing formation layers and sources
    const layerIds = ['formation-lines', 'formation-lines-glow', 'formation-polygons', 'formation-labels'];
    layerIds.forEach((id) => {
      if (map.getLayer(id)) {
        map.removeLayer(id);
      }
    });

    if (map.getSource('formations')) {
      map.removeSource('formations');
    }

    if (formations.length === 0) return;

    // Build GeoJSON features for formations
    const lineFeatures: GeoJSON.Feature[] = [];
    const polygonFeatures: GeoJSON.Feature[] = [];
    const labelFeatures: GeoJSON.Feature[] = [];

    formations.forEach((formation) => {
      const positionsData = formation.metadata?.positions as Array<{
        aircraft_id: string;
        latitude: number;
        longitude: number;
      }> | undefined;

      if (!positionsData || positionsData.length < 2) {
        return;
      }

      const positions = positionsData;

      const coordinates = positions.map((p) => [p.longitude, p.latitude] as [number, number]);
      const color = formationColors[formation.formation_type] || formationColors.unknown;
      const isSelected = formation.id === selectedFormationId;

      // Create line connecting all aircraft
      if (coordinates.length >= 2) {
        lineFeatures.push({
          type: 'Feature',
          properties: {
            id: formation.id,
            type: formation.formation_type,
            color,
            selected: isSelected,
          },
          geometry: {
            type: 'LineString',
            coordinates,
          },
        });
      }

      // Create polygon if 3+ aircraft
      if (coordinates.length >= 3) {
        polygonFeatures.push({
          type: 'Feature',
          properties: {
            id: formation.id,
            type: formation.formation_type,
            color,
            selected: isSelected,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[...coordinates, coordinates[0]]], // Close the polygon
          },
        });
      }

      // Create label at centroid
      const centroid = calculateCentroid(coordinates);
      labelFeatures.push({
        type: 'Feature',
        properties: {
          id: formation.id,
          type: formation.formation_type,
          label: getFormationLabel(formation.formation_type),
          color,
          count: positions.length,
        },
        geometry: {
          type: 'Point',
          coordinates: centroid,
        },
      });
    });

    // Add source with all features
    map.addSource('formations', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [...polygonFeatures, ...lineFeatures, ...labelFeatures],
      },
    });

    // Add polygon fill layer (subtle background)
    map.addLayer({
      id: 'formation-polygons',
      type: 'fill',
      source: 'formations',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': [
          'case',
          ['==', ['get', 'selected'], true],
          0.15,
          0.08,
        ],
      },
    });

    // Add line glow layer
    map.addLayer({
      id: 'formation-lines-glow',
      type: 'line',
      source: 'formations',
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: {
        'line-color': ['get', 'color'],
        'line-width': [
          'case',
          ['==', ['get', 'selected'], true],
          12,
          8,
        ],
        'line-opacity': 0.2,
        'line-blur': 4,
      },
    });

    // Add line layer
    map.addLayer({
      id: 'formation-lines',
      type: 'line',
      source: 'formations',
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': [
          'case',
          ['==', ['get', 'selected'], true],
          3,
          2,
        ],
        'line-opacity': [
          'case',
          ['==', ['get', 'selected'], true],
          1,
          0.7,
        ],
        'line-dasharray': [2, 2],
      },
    });

    // Add label layer
    map.addLayer({
      id: 'formation-labels',
      type: 'symbol',
      source: 'formations',
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'text-field': ['concat', ['get', 'label'], ' (', ['to-string', ['get', 'count']], ')'],
        'text-size': 11,
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
        'text-offset': [0, 0],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': 'rgba(0, 0, 0, 0.9)',
        'text-halo-width': 1.5,
      },
    });
  }, [map, formations, selectedFormationId]);

  useEffect(() => {
    if (!map) return;

    // Wait for map to be ready
    if (map.isStyleLoaded()) {
      updateFormationLayers();
    } else {
      map.on('load', updateFormationLayers);
    }

    return () => {
      if (map && map.isStyleLoaded()) {
        const layerIds = ['formation-lines', 'formation-lines-glow', 'formation-polygons', 'formation-labels'];
        layerIds.forEach((id) => {
          if (map.getLayer(id)) {
            map.removeLayer(id);
          }
        });
        if (map.getSource('formations')) {
          map.removeSource('formations');
        }
      }
    };
  }, [map, updateFormationLayers]);

  return null; // This component doesn't render anything, it only manipulates the map
}

function calculateCentroid(coordinates: [number, number][]): [number, number] {
  const sum = coordinates.reduce(
    (acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]],
    [0, 0]
  );
  return [sum[0] / coordinates.length, sum[1] / coordinates.length];
}

function getFormationLabel(type: string): string {
  const labels: Record<string, string> = {
    tanker_receiver: 'Refueling',
    escort: 'Escort',
    strike_package: 'Strike',
    cap: 'CAP',
    unknown: 'Formation',
  };
  return labels[type] || 'Formation';
}
