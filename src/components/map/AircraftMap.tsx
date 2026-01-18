'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { PositionLatest, MilitaryCategory } from '@/lib/types/aircraft';
import { getMilitaryCategoryColor, getMilitaryCategoryLabel } from '@/lib/utils/military-db';
import { formatAltitude, formatSpeed } from '@/lib/utils/geo';

interface AircraftMapProps {
  positions: PositionLatest[];
  onAircraftClick?: (aircraft: PositionLatest) => void;
  selectedAircraftId?: string;
  showRegions?: boolean;
}

// Middle East center
const DEFAULT_CENTER: [number, number] = [42, 30];
const DEFAULT_ZOOM = 4;

export default function AircraftMap({
  positions,
  onAircraftClick,
  selectedAircraftId,
  showRegions = true,
}: AircraftMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error('Mapbox token not found');
      return;
    }

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      projection: 'mercator',
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

    map.current.on('load', () => {
      setMapLoaded(true);

      // Add regions layer if enabled
      if (showRegions && map.current) {
        addRegionsLayer(map.current);
      }
    });

    return () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current.clear();
      map.current?.remove();
      map.current = null;
    };
  }, [showRegions]);

  // Add coverage regions as a layer
  const addRegionsLayer = useCallback((mapInstance: mapboxgl.Map) => {
    const regions = [
      { name: 'Lebanon', lat: 33.85, lon: 35.86, radius: 100 },
      { name: 'Israel', lat: 31.77, lon: 35.23, radius: 100 },
      { name: 'Cyprus', lat: 35.13, lon: 33.43, radius: 80 },
      { name: 'Syria', lat: 34.80, lon: 38.99, radius: 150 },
      { name: 'Iran', lat: 32.43, lon: 53.69, radius: 400 },
      { name: 'Iraq', lat: 33.31, lon: 44.37, radius: 200 },
      { name: 'Turkey', lat: 39.93, lon: 32.86, radius: 300 },
      { name: 'Egypt', lat: 26.82, lon: 30.80, radius: 250 },
      { name: 'GCC', lat: 24.47, lon: 54.37, radius: 400 },
    ];

    // Create GeoJSON for regions
    const regionsGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: regions.map((region) => ({
        type: 'Feature',
        properties: { name: region.name },
        geometry: {
          type: 'Point',
          coordinates: [region.lon, region.lat],
        },
      })),
    };

    mapInstance.addSource('regions', {
      type: 'geojson',
      data: regionsGeoJSON,
    });

    mapInstance.addLayer({
      id: 'region-circles',
      type: 'circle',
      source: 'regions',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3, 20,
          6, 50,
          10, 100,
        ],
        'circle-color': 'rgba(14, 165, 233, 0.1)',
        'circle-stroke-color': 'rgba(14, 165, 233, 0.5)',
        'circle-stroke-width': 1,
      },
    });

    mapInstance.addLayer({
      id: 'region-labels',
      type: 'symbol',
      source: 'regions',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 12,
        'text-offset': [0, 0],
      },
      paint: {
        'text-color': 'rgba(14, 165, 233, 0.8)',
        'text-halo-color': 'rgba(0, 0, 0, 0.8)',
        'text-halo-width': 1,
      },
    });
  }, []);

  // Update markers when positions change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const currentPositionIds = new Set(positions.map((p) => p.icao_hex));

    // Remove markers for aircraft no longer in view
    markers.current.forEach((marker, id) => {
      if (!currentPositionIds.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    });

    // Update or create markers for current positions
    positions.forEach((position) => {
      const existingMarker = markers.current.get(position.icao_hex);

      if (existingMarker) {
        // Update existing marker position
        existingMarker.setLngLat([position.longitude, position.latitude]);

        // Update rotation if track is available
        if (position.track !== null) {
          const el = existingMarker.getElement();
          const icon = el.querySelector('.aircraft-icon') as HTMLElement;
          if (icon) {
            icon.style.transform = `rotate(${position.track}deg)`;
          }
        }
      } else {
        // Create new marker
        const marker = createAircraftMarker(position, onAircraftClick);
        marker.addTo(map.current!);
        markers.current.set(position.icao_hex, marker);
      }
    });
  }, [positions, mapLoaded, onAircraftClick]);

  // Highlight selected aircraft
  useEffect(() => {
    markers.current.forEach((marker, id) => {
      const el = marker.getElement();
      if (id === selectedAircraftId) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });

    // Pan to selected aircraft
    if (selectedAircraftId) {
      const position = positions.find((p) => p.icao_hex === selectedAircraftId);
      if (position && map.current) {
        map.current.flyTo({
          center: [position.longitude, position.latitude],
          zoom: 8,
          duration: 1000,
        });
      }
    }
  }, [selectedAircraftId, positions]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-card/90 backdrop-blur-sm rounded-lg border border-border p-3 text-xs">
        <div className="font-semibold mb-2">Aircraft Types</div>
        <div className="space-y-1">
          {(['tanker', 'awacs', 'isr', 'transport', 'fighter', 'other'] as MilitaryCategory[]).map(
            (category) => (
              <div key={category} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getMilitaryCategoryColor(category) }}
                />
                <span>{getMilitaryCategoryLabel(category)}</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Aircraft count */}
      <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg border border-border px-3 py-2 text-sm">
        <span className="font-semibold">{positions.length}</span>{' '}
        <span className="text-muted-foreground">aircraft tracked</span>
      </div>
    </div>
  );
}

function createAircraftMarker(
  position: PositionLatest,
  onClick?: (aircraft: PositionLatest) => void
): mapboxgl.Marker {
  const category = position.aircraft?.military_category as MilitaryCategory | null;
  const color = getMilitaryCategoryColor(category);

  // Create custom marker element
  const el = document.createElement('div');
  el.className = 'aircraft-marker cursor-pointer';
  el.innerHTML = `
    <div class="aircraft-icon" style="transform: rotate(${position.track || 0}deg)">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}">
        <path d="M12 2L4 12l2 2 4-2v8l-3 2v1h10v-1l-3-2v-8l4 2 2-2L12 2z"/>
      </svg>
    </div>
    <div class="aircraft-callsign text-xs font-mono mt-1 text-center whitespace-nowrap" style="color: ${color}">
      ${position.callsign || position.icao_hex}
    </div>
  `;

  el.addEventListener('click', () => {
    onClick?.(position);
  });

  // Create popup
  const popup = new mapboxgl.Popup({
    offset: 25,
    closeButton: true,
    closeOnClick: false,
    className: 'aircraft-popup',
  }).setHTML(`
    <div class="p-3 min-w-48">
      <div class="font-semibold text-lg mb-2" style="color: ${color}">
        ${position.callsign || position.icao_hex}
      </div>
      <div class="space-y-1 text-sm">
        <div class="flex justify-between">
          <span class="text-muted-foreground">Type:</span>
          <span>${position.aircraft?.type_code || 'Unknown'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Altitude:</span>
          <span>${formatAltitude(position.altitude)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Speed:</span>
          <span>${formatSpeed(position.ground_speed)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Track:</span>
          <span>${position.track ? `${position.track}°` : 'N/A'}</span>
        </div>
        ${position.aircraft?.operator ? `
          <div class="flex justify-between">
            <span class="text-muted-foreground">Operator:</span>
            <span>${position.aircraft.operator}</span>
          </div>
        ` : ''}
        <div class="flex justify-between">
          <span class="text-muted-foreground">Category:</span>
          <span style="color: ${color}">${getMilitaryCategoryLabel(category)}</span>
        </div>
      </div>
    </div>
  `);

  return new mapboxgl.Marker({ element: el, anchor: 'center' })
    .setLngLat([position.longitude, position.latitude])
    .setPopup(popup);
}
