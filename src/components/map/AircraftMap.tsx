'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { PositionLatest, MilitaryCategory } from '@/lib/types/aircraft';
import type { SSEConnectionStatus } from '@/hooks/useSSEPositions';
import { getMilitaryCategoryColor, getMilitaryCategoryLabel } from '@/lib/utils/military-db';
import { formatAltitude, formatSpeed } from '@/lib/utils/geo';
import ConnectionStatus from './ConnectionStatus';

interface AircraftMapProps {
  positions: PositionLatest[];
  onAircraftClick?: (aircraft: PositionLatest) => void;
  selectedAircraftId?: string;
  showRegions?: boolean;
  connectionStatus?: SSEConnectionStatus;
  lastUpdate?: Date | null;
  onReconnect?: () => void;
}

// Middle East center
const DEFAULT_CENTER: [number, number] = [42, 30];
const DEFAULT_ZOOM = 4;
const MAX_TRAIL_POINTS = 50; // Maximum points to keep in trail

export default function AircraftMap({
  positions,
  onAircraftClick,
  selectedAircraftId,
  showRegions = true,
  connectionStatus,
  lastUpdate,
  onReconnect,
}: AircraftMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);

  // Track position history for trails
  const positionHistory = useRef<Map<string, Array<[number, number]>>>(new Map());

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

      // Initialize trails source and layer
      if (map.current) {
        initializeTrailsLayer(map.current);
      }
    });

    return () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current.clear();
      positionHistory.current.clear();
      map.current?.remove();
      map.current = null;
    };
  }, [showRegions]);

  // Initialize trails layer
  const initializeTrailsLayer = useCallback((mapInstance: mapboxgl.Map) => {
    // Source for all aircraft trails
    mapInstance.addSource('aircraft-trails', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    // Layer for non-selected aircraft trails (subtle)
    mapInstance.addLayer({
      id: 'aircraft-trails-bg',
      type: 'line',
      source: 'aircraft-trails',
      filter: ['!=', ['get', 'selected'], true],
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.5,
        'line-opacity': 0.3,
      },
    });

    // Layer for selected aircraft trail (prominent)
    mapInstance.addLayer({
      id: 'aircraft-trails-selected',
      type: 'line',
      source: 'aircraft-trails',
      filter: ['==', ['get', 'selected'], true],
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 3,
        'line-opacity': 0.8,
        'line-blur': 1,
      },
    });

    // Glow effect for selected trail
    mapInstance.addLayer({
      id: 'aircraft-trails-glow',
      type: 'line',
      source: 'aircraft-trails',
      filter: ['==', ['get', 'selected'], true],
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 8,
        'line-opacity': 0.2,
        'line-blur': 3,
      },
    }, 'aircraft-trails-selected');
  }, []);

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
        'circle-color': 'rgba(0, 212, 255, 0.05)',
        'circle-stroke-color': 'rgba(0, 212, 255, 0.3)',
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
        'text-color': 'rgba(0, 212, 255, 0.6)',
        'text-halo-color': 'rgba(0, 0, 0, 0.8)',
        'text-halo-width': 1,
      },
    });
  }, []);

  // Store positions in a ref so click handlers can access latest data
  const positionsRef = useRef<PositionLatest[]>([]);
  positionsRef.current = positions;

  // Create click handler that looks up current position data
  const handleMarkerClick = useCallback((icaoHex: string) => {
    const currentPosition = positionsRef.current.find((p) => p.icao_hex === icaoHex);
    if (currentPosition && onAircraftClick) {
      onAircraftClick(currentPosition);
    }
  }, [onAircraftClick]);

  // Update position history and trails
  const updateTrails = useCallback(() => {
    if (!map.current || !mapLoaded) return;

    const source = map.current.getSource('aircraft-trails') as mapboxgl.GeoJSONSource;
    if (!source) return;

    // Build GeoJSON features for all trails
    const features: GeoJSON.Feature[] = [];

    positionHistory.current.forEach((trail, icaoHex) => {
      if (trail.length < 2) return;

      const position = positions.find((p) => p.icao_hex === icaoHex);
      const category = position?.aircraft?.military_category as MilitaryCategory | null;
      const color = getMilitaryCategoryColor(category);
      const isSelected = icaoHex === selectedAircraftId;

      features.push({
        type: 'Feature',
        properties: {
          icao_hex: icaoHex,
          color,
          selected: isSelected,
        },
        geometry: {
          type: 'LineString',
          coordinates: trail,
        },
      });
    });

    source.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [positions, selectedAircraftId, mapLoaded]);

  // Update markers and trails when positions change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const currentPositionIds = new Set(positions.map((p) => p.icao_hex));

    // Remove markers and history for aircraft no longer in view
    markers.current.forEach((marker, id) => {
      if (!currentPositionIds.has(id)) {
        marker.remove();
        markers.current.delete(id);
        positionHistory.current.delete(id);
      }
    });

    // Update or create markers for current positions
    positions.forEach((position) => {
      const existingMarker = markers.current.get(position.icao_hex);
      const coord: [number, number] = [position.longitude, position.latitude];

      // Update position history
      let trail = positionHistory.current.get(position.icao_hex);
      if (!trail) {
        trail = [];
        positionHistory.current.set(position.icao_hex, trail);
      }

      // Only add point if it's different from the last one
      const lastPoint = trail[trail.length - 1];
      if (!lastPoint || lastPoint[0] !== coord[0] || lastPoint[1] !== coord[1]) {
        trail.push(coord);
        // Keep trail length manageable
        if (trail.length > MAX_TRAIL_POINTS) {
          trail.shift();
        }
      }

      if (existingMarker) {
        // Update existing marker position
        existingMarker.setLngLat(coord);

        // Update rotation if track is available
        if (position.track !== null) {
          const el = existingMarker.getElement();
          const icon = el.querySelector('.aircraft-icon') as HTMLElement;
          if (icon) {
            icon.style.transform = `rotate(${position.track}deg)`;
          }
        }
      } else {
        // Create new marker with icao_hex for lookup
        const marker = createAircraftMarker(position, handleMarkerClick);
        marker.addTo(map.current!);
        markers.current.set(position.icao_hex, marker);
      }
    });

    // Update trails visualization
    updateTrails();
  }, [positions, mapLoaded, handleMarkerClick, updateTrails]);

  // Update trail styling when selection changes
  useEffect(() => {
    updateTrails();
  }, [selectedAircraftId, updateTrails]);

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
      <div className="absolute bottom-4 right-4 glass rounded-lg p-3 text-xs">
        <div className="font-semibold mb-2 text-foreground">Aircraft Types</div>
        <div className="space-y-1">
          {(['tanker', 'awacs', 'isr', 'transport', 'fighter', 'other'] as MilitaryCategory[]).map(
            (category) => (
              <div key={category} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getMilitaryCategoryColor(category) }}
                />
                <span className="text-foreground">{getMilitaryCategoryLabel(category)}</span>
              </div>
            )
          )}
        </div>
        <div className="mt-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-6 h-0.5 bg-primary rounded" />
            <span>Flight trail</span>
          </div>
        </div>
      </div>

      {/* Aircraft count */}
      <div className="absolute top-4 left-4 glass rounded-lg px-3 py-2 text-sm">
        <span className="font-semibold text-primary">{positions.length}</span>{' '}
        <span className="text-muted-foreground">aircraft tracked</span>
      </div>

      {/* Connection status */}
      {connectionStatus && (
        <ConnectionStatus
          status={connectionStatus}
          lastUpdate={lastUpdate ?? null}
          onReconnect={onReconnect}
          className="absolute top-4 right-16"
        />
      )}
    </div>
  );
}

function createAircraftMarker(
  position: PositionLatest,
  onClick?: (icaoHex: string) => void
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

  // Pass icao_hex to click handler so it can look up fresh position data
  const icaoHex = position.icao_hex;
  el.addEventListener('click', () => {
    onClick?.(icaoHex);
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
