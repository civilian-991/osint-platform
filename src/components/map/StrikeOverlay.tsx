'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import type { StrikeEvent } from '@/lib/services/strike-tracker';

interface StrikeOverlayProps {
  map: mapboxgl.Map | null;
  enabled: boolean;
  onStrikeSelect?: (strike: StrikeEvent | null) => void;
}

// Strike type icons and colors
const STRIKE_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  airstrike: { color: '#ef4444', icon: '💥', label: 'Airstrike' },
  rocket: { color: '#f97316', icon: '🚀', label: 'Rocket' },
  drone: { color: '#8b5cf6', icon: '🛸', label: 'Drone' },
  explosion: { color: '#dc2626', icon: '💣', label: 'Explosion' },
  gunfire: { color: '#eab308', icon: '🔫', label: 'Gunfire' },
  shelling: { color: '#f59e0b', icon: '🎯', label: 'Shelling' },
};

export function StrikeOverlay({ map, enabled, onStrikeSelect }: StrikeOverlayProps) {
  const [strikes, setStrikes] = useState<StrikeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const pulseLayersRef = useRef<Set<string>>(new Set());

  // Fetch strikes from API
  const fetchStrikes = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    try {
      const response = await fetch('/api/strikes?maxAge=4');
      const data = await response.json();
      if (data.success) {
        setStrikes(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch strikes:', error);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Initial fetch and polling
  useEffect(() => {
    if (!enabled) return;

    fetchStrikes();
    const interval = setInterval(fetchStrikes, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [enabled, fetchStrikes]);

  // Create pulsing marker element
  const createStrikeMarkerElement = useCallback((strike: StrikeEvent) => {
    const config = STRIKE_CONFIG[strike.event_type] || STRIKE_CONFIG.explosion;

    const container = document.createElement('div');
    container.className = 'strike-marker-container';
    container.style.cssText = `
      position: relative;
      cursor: pointer;
    `;

    // Outer pulse ring
    const pulse = document.createElement('div');
    pulse.className = 'strike-pulse';
    pulse.style.cssText = `
      position: absolute;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: ${config.color}40;
      border: 2px solid ${config.color};
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      animation: strike-pulse 2s ease-out infinite;
    `;

    // Inner marker
    const marker = document.createElement('div');
    marker.className = 'strike-marker';
    marker.style.cssText = `
      position: relative;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: ${config.color};
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      z-index: 10;
    `;
    marker.textContent = config.icon;

    container.appendChild(pulse);
    container.appendChild(marker);

    // Click handler
    container.addEventListener('click', (e) => {
      e.stopPropagation();
      onStrikeSelect?.(strike);
    });

    return container;
  }, [onStrikeSelect]);

  // Manage markers on map
  useEffect(() => {
    if (!map || !enabled) {
      // Clear all markers when disabled
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();
      return;
    }

    const currentIds = new Set(strikes.map(s => s.id));

    // Remove markers for strikes no longer active
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add/update markers for current strikes
    strikes.forEach(strike => {
      if (!markersRef.current.has(strike.id)) {
        const el = createStrikeMarkerElement(strike);
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([strike.longitude, strike.latitude])
          .addTo(map);

        markersRef.current.set(strike.id, marker);
      }
    });

    // Add CSS animation if not already added
    if (!document.getElementById('strike-pulse-styles')) {
      const style = document.createElement('style');
      style.id = 'strike-pulse-styles';
      style.textContent = `
        @keyframes strike-pulse {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, [map, strikes, enabled, createStrikeMarkerElement]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      {/* Strike Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: '120px',
          left: '12px',
          background: 'rgba(0, 0, 0, 0.85)',
          borderRadius: '8px',
          padding: '12px',
          zIndex: 100,
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          minWidth: '140px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#ef4444',
            marginBottom: '8px',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}
        >
          Strikes {loading && '⟳'}
        </div>
        <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>
          {strikes.length} active
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {Object.entries(STRIKE_CONFIG).map(([type, config]) => {
            const count = strikes.filter(s => s.event_type === type).length;
            if (count === 0) return null;
            return (
              <div
                key={type}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  color: '#d1d5db',
                }}
              >
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: config.color,
                  }}
                />
                <span>{config.icon}</span>
                <span>{config.label}</span>
                <span style={{ color: '#6b7280', marginLeft: 'auto' }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// Strike detail panel component
export function StrikeDetailPanel({
  strike,
  onClose,
}: {
  strike: StrikeEvent;
  onClose: () => void;
}) {
  const config = STRIKE_CONFIG[strike.event_type] || STRIKE_CONFIG.explosion;
  const reportedAt = new Date(strike.reported_at);
  const timeAgo = getTimeAgo(reportedAt);

  return (
    <div
      style={{
        position: 'absolute',
        top: '80px',
        right: '12px',
        width: '320px',
        background: 'rgba(0, 0, 0, 0.92)',
        borderRadius: '12px',
        padding: '16px',
        zIndex: 200,
        backdropFilter: 'blur(12px)',
        border: `1px solid ${config.color}40`,
        boxShadow: `0 0 20px ${config.color}20`,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: config.color,
              animation: 'strike-pulse 2s ease-out infinite',
            }}
          />
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: config.color,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {config.icon} {config.label}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '4px',
          }}
        >
          ×
        </button>
      </div>

      {/* Location */}
      <div style={{ marginBottom: '12px' }}>
        <div
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#f3f4f6',
            marginBottom: '4px',
          }}
        >
          {strike.location_name || 'Unknown Location'}
        </div>
        <div style={{ fontSize: '12px', color: '#9ca3af' }}>
          {strike.region || 'Unknown Region'}
        </div>
      </div>

      {/* Time */}
      <div
        style={{
          fontSize: '12px',
          color: '#f97316',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>🕐</span>
        <span>{timeAgo}</span>
        <span style={{ color: '#6b7280' }}>
          ({reportedAt.toLocaleTimeString()})
        </span>
      </div>

      {/* Description */}
      {strike.description && (
        <div
          style={{
            fontSize: '12px',
            color: '#d1d5db',
            lineHeight: 1.5,
            marginBottom: '12px',
            padding: '10px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '6px',
            maxHeight: '100px',
            overflow: 'auto',
          }}
        >
          {strike.description}
        </div>
      )}

      {/* Coordinates */}
      <div
        style={{
          fontSize: '11px',
          color: '#6b7280',
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          paddingTop: '10px',
        }}
      >
        <span>
          {strike.latitude.toFixed(4)}, {strike.longitude.toFixed(4)}
        </span>
        <span>Confidence: {(strike.confidence * 100).toFixed(0)}%</span>
      </div>

      {/* Source */}
      {strike.source_channel && (
        <div
          style={{
            fontSize: '10px',
            color: '#4b5563',
            marginTop: '8px',
          }}
        >
          Source: {strike.source_channel}
        </div>
      )}
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
