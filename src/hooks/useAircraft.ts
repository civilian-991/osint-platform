'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PositionLatest, ADSBAircraft } from '@/lib/types/aircraft';
import { detectMilitary } from '@/lib/utils/military-db';

interface UseAircraftOptions {
  live?: boolean;
  refreshInterval?: number;
  military?: boolean;
  all?: boolean; // Fetch all aircraft (military + civilian) like ADSBexchange
}

interface UseAircraftReturn {
  positions: PositionLatest[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useAircraft(options: UseAircraftOptions = {}): UseAircraftReturn {
  const { live = false, refreshInterval = 30000, military = true, all = false } = options;

  const [positions, setPositions] = useState<PositionLatest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAircraft = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (live) params.set('live', 'true');
      if (all) {
        params.set('all', 'true');
        params.set('military', 'false'); // When all=true, show all aircraft
      } else if (military) {
        params.set('military', 'true');
      }

      const response = await fetch(`/api/aircraft?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch aircraft: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Transform live data to PositionLatest format if needed
        if (live && result.data) {
          const transformed = result.data
            .map((ac: Record<string, unknown>) => {
              // Convert to ADSBAircraft format for detection
              const adsbAircraft: ADSBAircraft = {
                hex: (ac.hex as string) || '',
                flight: ac.flight?.toString().trim() || undefined,
                t: (ac.t as string) || undefined,
                r: (ac.r as string) || undefined,
                desc: (ac.desc as string) || undefined,
                ownOp: (ac.ownOp as string) || undefined,
                mil: (ac.mil as boolean) || false,
                lat: ac.lat as number,
                lon: ac.lon as number,
                alt_baro: ac.alt_baro as number | 'ground' | undefined,
                gs: ac.gs as number | undefined,
                track: ac.track as number | undefined,
                baro_rate: ac.baro_rate as number | undefined,
                squawk: (ac.squawk as string) || undefined,
              };

              // Detect military category - this also filters out false positives
              const detection = detectMilitary(adsbAircraft);

              return {
                id: ac.hex,
                aircraft_id: null,
                icao_hex: (ac.hex as string).toUpperCase(),
                callsign: ac.flight?.toString().trim() || null,
                latitude: ac.lat as number,
                longitude: ac.lon as number,
                altitude: typeof ac.alt_baro === 'number' ? ac.alt_baro : null,
                ground_speed: ac.gs ? Math.round(ac.gs as number) : null,
                track: ac.track ? Math.round(ac.track as number) : null,
                vertical_rate: (ac.baro_rate as number) || null,
                squawk: (ac.squawk as string) || null,
                on_ground: ac.alt_baro === 'ground',
                timestamp: new Date().toISOString(),
                source: 'adsb.lol',
                aircraft: {
                  id: ac.hex,
                  icao_hex: (ac.hex as string).toUpperCase(),
                  registration: (ac.r as string) || null,
                  type_code: (ac.t as string) || null,
                  type_description: (ac.desc as string) || null,
                  operator: (ac.ownOp as string) || null,
                  country: detection.country,
                  is_military: detection.isMilitary,
                  military_category: detection.category,
                  watchlist_category: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              };
            })
            // Filter to ONLY military aircraft when military mode is enabled
            .filter((pos: PositionLatest) => {
              if (!military) return true; // Show all if military mode disabled
              return pos.aircraft?.is_military === true;
            });

          setPositions(transformed);
        } else {
          setPositions(result.data || []);
        }
        setError(null);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [live, military, all]);

  // Initial fetch
  useEffect(() => {
    fetchAircraft();
  }, [fetchAircraft]);

  // Refresh interval
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(fetchAircraft, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchAircraft, refreshInterval]);

  return {
    positions,
    loading,
    error,
    refresh: fetchAircraft,
  };
}
