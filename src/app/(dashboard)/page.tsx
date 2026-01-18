'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useAircraft } from '@/hooks/useAircraft';
import AircraftList from '@/components/aircraft/AircraftList';
import type { PositionLatest } from '@/lib/types/aircraft';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

// Dynamically import map to avoid SSR issues with Mapbox
const AircraftMap = dynamic(() => import('@/components/map/AircraftMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  ),
});

export default function DashboardPage() {
  const [selectedAircraft, setSelectedAircraft] = useState<PositionLatest | null>(null);

  const { positions, loading, error, refresh } = useAircraft({
    live: true,
    refreshInterval: 30000, // 30 seconds
    military: true,
  });

  const handleAircraftClick = (aircraft: PositionLatest) => {
    setSelectedAircraft(aircraft);
  };

  return (
    <div className="flex-1 flex h-screen">
      {/* Map */}
      <div className="flex-1 relative">
        <AircraftMap
          positions={positions}
          onAircraftClick={handleAircraftClick}
          selectedAircraftId={selectedAircraft?.icao_hex}
          showRegions={true}
        />

        {/* Status bar */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-card/90 backdrop-blur-sm rounded-md border border-border text-sm hover:bg-card transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <div className="flex items-center gap-1 px-3 py-1.5 bg-card/90 backdrop-blur-sm rounded-md border border-border text-sm">
            {error ? (
              <>
                <WifiOff className="h-4 w-4 text-destructive" />
                <span className="text-destructive">Offline</span>
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-green-500">Live</span>
              </>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="absolute bottom-4 left-4 right-4 max-w-md mx-auto bg-destructive/10 border border-destructive text-destructive px-4 py-2 rounded-md text-sm">
            {error.message}
          </div>
        )}
      </div>

      {/* Sidebar - Aircraft List */}
      <div className="w-80 border-l border-border bg-card overflow-hidden">
        <AircraftList
          positions={positions}
          onAircraftClick={handleAircraftClick}
          selectedAircraftId={selectedAircraft?.icao_hex}
          loading={loading}
          compact={true}
        />
      </div>
    </div>
  );
}
