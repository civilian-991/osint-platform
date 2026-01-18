'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useAircraft } from '@/hooks/useAircraft';
import AircraftList from '@/components/aircraft/AircraftList';
import type { PositionLatest } from '@/lib/types/aircraft';
import { RefreshCw, Wifi, WifiOff, Radio } from 'lucide-react';

// Dynamically import map to avoid SSR issues with Mapbox
const AircraftMap = dynamic(() => import('@/components/map/AircraftMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-background">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
        <div className="relative animate-spin rounded-full h-12 w-12 border-2 border-primary/30 border-t-primary" />
      </div>
    </div>
  ),
});

export default function MapPage() {
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
            className="flex items-center gap-2 px-3 py-2 glass rounded-lg text-sm font-medium text-foreground hover:bg-muted/50 transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-primary' : ''}`} />
            Refresh
          </button>

          <div className="flex items-center gap-2 px-3 py-2 glass rounded-lg text-sm font-medium">
            {error ? (
              <>
                <WifiOff className="h-4 w-4 text-destructive" />
                <span className="text-destructive">Offline</span>
              </>
            ) : (
              <>
                <div className="relative">
                  <Radio className="h-4 w-4 text-green-400" />
                  <div className="absolute inset-0 animate-ping">
                    <Radio className="h-4 w-4 text-green-400 opacity-50" />
                  </div>
                </div>
                <span className="text-green-400">Live</span>
              </>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="absolute bottom-4 left-4 right-4 max-w-md mx-auto glass border-destructive/50 text-foreground px-4 py-3 rounded-lg animate-slide-up">
            <div className="flex items-center gap-2">
              <WifiOff className="h-4 w-4 text-destructive" />
              <span className="text-destructive font-medium">Connection Error</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          </div>
        )}
      </div>

      {/* Sidebar - Aircraft List */}
      <div className="w-80 border-l border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
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
