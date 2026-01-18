'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { Map } from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import type { DrawCreateEvent, DrawUpdateEvent } from '@/lib/types/geofence';

// Mapbox Draw styles for dark theme
const DRAW_STYLES = [
  // Polygon fill
  {
    id: 'gl-draw-polygon-fill',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
    paint: {
      'fill-color': '#3b82f6',
      'fill-outline-color': '#3b82f6',
      'fill-opacity': 0.2,
    },
  },
  // Polygon stroke (active)
  {
    id: 'gl-draw-polygon-stroke-active',
    type: 'line',
    filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#3b82f6',
      'line-width': 2,
      'line-dasharray': [2, 2],
    },
  },
  // Polygon midpoints
  {
    id: 'gl-draw-polygon-midpoint',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
    paint: {
      'circle-radius': 4,
      'circle-color': '#3b82f6',
    },
  },
  // Polygon vertex points
  {
    id: 'gl-draw-polygon-and-line-vertex-active',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']],
    paint: {
      'circle-radius': 6,
      'circle-color': '#fff',
      'circle-stroke-color': '#3b82f6',
      'circle-stroke-width': 2,
    },
  },
  // Line during drawing
  {
    id: 'gl-draw-line',
    type: 'line',
    filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#3b82f6',
      'line-width': 2,
      'line-dasharray': [2, 2],
    },
  },
  // Points
  {
    id: 'gl-draw-point',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
    paint: {
      'circle-radius': 6,
      'circle-color': '#fff',
      'circle-stroke-color': '#3b82f6',
      'circle-stroke-width': 2,
    },
  },
];

interface GeofenceDrawToolProps {
  map: Map | null;
  isDrawing: boolean;
  onDrawCreate: (coordinates: [number, number][]) => void;
  onDrawUpdate?: (coordinates: [number, number][]) => void;
  onDrawCancel?: () => void;
}

export default function GeofenceDrawTool({
  map,
  isDrawing,
  onDrawCreate,
  onDrawUpdate,
  onDrawCancel,
}: GeofenceDrawToolProps) {
  const drawRef = useRef<MapboxDraw | null>(null);
  const isDrawingRef = useRef(isDrawing);

  // Handle draw create event
  const handleDrawCreate = useCallback((e: DrawCreateEvent) => {
    const feature = e.features[0];
    if (feature && feature.geometry.type === 'Polygon') {
      const coordinates = feature.geometry.coordinates[0] as [number, number][];
      // Remove the closing coordinate (same as first)
      const openCoords = coordinates.slice(0, -1);
      onDrawCreate(openCoords);

      // Delete the drawn feature after creating
      if (drawRef.current) {
        drawRef.current.deleteAll();
        drawRef.current.changeMode('simple_select');
      }
    }
  }, [onDrawCreate]);

  // Handle draw update event
  const handleDrawUpdate = useCallback((e: DrawUpdateEvent) => {
    if (!onDrawUpdate) return;
    const feature = e.features[0];
    if (feature && feature.geometry.type === 'Polygon') {
      const coordinates = feature.geometry.coordinates[0] as [number, number][];
      const openCoords = coordinates.slice(0, -1);
      onDrawUpdate(openCoords);
    }
  }, [onDrawUpdate]);

  // Handle escape key to cancel drawing
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isDrawingRef.current) {
      if (drawRef.current) {
        drawRef.current.deleteAll();
        drawRef.current.changeMode('simple_select');
      }
      onDrawCancel?.();
    }
  }, [onDrawCancel]);

  // Initialize Mapbox Draw
  useEffect(() => {
    if (!map) return;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      defaultMode: 'simple_select',
      styles: DRAW_STYLES,
    });

    map.addControl(draw, 'top-left');
    drawRef.current = draw;

    // Add event listeners
    map.on('draw.create', handleDrawCreate as any);
    map.on('draw.update', handleDrawUpdate as any);

    // Add keyboard listener
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      map.off('draw.create', handleDrawCreate as any);
      map.off('draw.update', handleDrawUpdate as any);
      document.removeEventListener('keydown', handleKeyDown);

      if (map.hasControl(draw)) {
        map.removeControl(draw);
      }
      drawRef.current = null;
    };
  }, [map, handleDrawCreate, handleDrawUpdate, handleKeyDown]);

  // Handle drawing mode changes
  useEffect(() => {
    isDrawingRef.current = isDrawing;

    if (!drawRef.current) return;

    if (isDrawing) {
      drawRef.current.changeMode('draw_polygon');
    } else {
      drawRef.current.changeMode('simple_select');
      drawRef.current.deleteAll();
    }
  }, [isDrawing]);

  // This component doesn't render anything - it just manages the draw control
  return null;
}
