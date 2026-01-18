'use client';

import { useEffect, useRef } from 'react';
import type { Map } from 'mapbox-gl';
import type { GeofenceWithStats, GeofenceFeatureCollection } from '@/lib/types/geofence';

const GEOFENCE_SOURCE_ID = 'geofences-source';
const GEOFENCE_FILL_LAYER_ID = 'geofences-fill';
const GEOFENCE_STROKE_LAYER_ID = 'geofences-stroke';
const GEOFENCE_LABEL_LAYER_ID = 'geofences-label';

interface GeofenceOverlayProps {
  map: Map | null;
  geofences: GeofenceWithStats[];
  selectedGeofenceId?: string | null;
  onGeofenceClick?: (geofence: GeofenceWithStats) => void;
}

export default function GeofenceOverlay({
  map,
  geofences,
  selectedGeofenceId,
  onGeofenceClick,
}: GeofenceOverlayProps) {
  const geofencesRef = useRef<GeofenceWithStats[]>(geofences);
  const initializedRef = useRef(false);

  // Convert geofences to GeoJSON FeatureCollection
  const getGeofenceGeoJSON = (): GeofenceFeatureCollection => {
    return {
      type: 'FeatureCollection',
      features: geofencesRef.current
        .filter((g) => g.is_active && g.geom_geojson)
        .map((g) => ({
          type: 'Feature' as const,
          geometry: g.geom_geojson!,
          properties: {
            id: g.id,
            name: g.name,
            fill_color: g.fill_color,
            fill_opacity: selectedGeofenceId === g.id ? Math.min(g.fill_opacity + 0.1, 0.5) : g.fill_opacity,
            stroke_color: g.stroke_color,
            stroke_width: selectedGeofenceId === g.id ? g.stroke_width + 1 : g.stroke_width,
            is_active: g.is_active,
            aircraft_inside: g.aircraft_inside,
          },
        })),
    };
  };

  // Initialize map layers
  useEffect(() => {
    if (!map || initializedRef.current) return;

    const setupLayers = () => {
      // Add source
      if (!map.getSource(GEOFENCE_SOURCE_ID)) {
        map.addSource(GEOFENCE_SOURCE_ID, {
          type: 'geojson',
          data: getGeofenceGeoJSON(),
        });
      }

      // Add fill layer
      if (!map.getLayer(GEOFENCE_FILL_LAYER_ID)) {
        map.addLayer({
          id: GEOFENCE_FILL_LAYER_ID,
          type: 'fill',
          source: GEOFENCE_SOURCE_ID,
          paint: {
            'fill-color': ['get', 'fill_color'],
            'fill-opacity': ['get', 'fill_opacity'],
          },
        });
      }

      // Add stroke layer
      if (!map.getLayer(GEOFENCE_STROKE_LAYER_ID)) {
        map.addLayer({
          id: GEOFENCE_STROKE_LAYER_ID,
          type: 'line',
          source: GEOFENCE_SOURCE_ID,
          paint: {
            'line-color': ['get', 'stroke_color'],
            'line-width': ['get', 'stroke_width'],
          },
        });
      }

      // Add label layer
      if (!map.getLayer(GEOFENCE_LABEL_LAYER_ID)) {
        map.addLayer({
          id: GEOFENCE_LABEL_LAYER_ID,
          type: 'symbol',
          source: GEOFENCE_SOURCE_ID,
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 12,
            'text-anchor': 'center',
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 1,
          },
        });
      }

      // Handle click events
      map.on('click', GEOFENCE_FILL_LAYER_ID, (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const geofenceId = feature.properties?.id;
        if (geofenceId) {
          const geofence = geofencesRef.current.find((g) => g.id === geofenceId);
          if (geofence && onGeofenceClick) {
            onGeofenceClick(geofence);
          }
        }
      });

      // Change cursor on hover
      map.on('mouseenter', GEOFENCE_FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', GEOFENCE_FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = '';
      });

      initializedRef.current = true;
    };

    if (map.isStyleLoaded()) {
      setupLayers();
    } else {
      map.on('style.load', setupLayers);
    }

    return () => {
      // Cleanup is handled by the map component
    };
  }, [map, onGeofenceClick]);

  // Update geofences data
  useEffect(() => {
    geofencesRef.current = geofences;

    if (!map || !initializedRef.current) return;

    const source = map.getSource(GEOFENCE_SOURCE_ID);
    if (source && 'setData' in source) {
      source.setData(getGeofenceGeoJSON());
    }
  }, [map, geofences, selectedGeofenceId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!map) return;

      try {
        if (map.getLayer(GEOFENCE_LABEL_LAYER_ID)) {
          map.removeLayer(GEOFENCE_LABEL_LAYER_ID);
        }
        if (map.getLayer(GEOFENCE_STROKE_LAYER_ID)) {
          map.removeLayer(GEOFENCE_STROKE_LAYER_ID);
        }
        if (map.getLayer(GEOFENCE_FILL_LAYER_ID)) {
          map.removeLayer(GEOFENCE_FILL_LAYER_ID);
        }
        if (map.getSource(GEOFENCE_SOURCE_ID)) {
          map.removeSource(GEOFENCE_SOURCE_ID);
        }
      } catch (e) {
        // Map might already be removed
      }

      initializedRef.current = false;
    };
  }, [map]);

  // This component doesn't render anything - it just manages map layers
  return null;
}
