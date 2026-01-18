'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useAircraft } from '@/hooks/useAircraft';
import { useFormations } from '@/hooks/useAircraftML';
import AircraftList from '@/components/aircraft/AircraftList';
import SmartAlertsPanel from '@/components/alerts/SmartAlertsPanel';
import { MLDashboard } from '@/components/ml';
import type { PositionLatest } from '@/lib/types/aircraft';
import { RefreshCw, Wifi, WifiOff, Brain, Bell } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// Dynamically import map to avoid SSR issues with Mapbox
const AircraftMap = dynamic(() => import('@/components/map/AircraftMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  ),
});

// Dynamically import formation overlay
const FormationOverlay = dynamic(() => import('@/components/map/FormationOverlay'), {
  ssr: false,
});

export default function DashboardPage() {
  const [selectedAircraft, setSelectedAircraft] = useState<PositionLatest | null>(null);
  const [showMLPanel, setShowMLPanel] = useState(false);
  const [showAlertsPanel, setShowAlertsPanel] = useState(true);

  const { positions, loading, error, refresh } = useAircraft({
    live: true,
    refreshInterval: 30000,
    military: true,
  });

  const { formations } = useFormations(true);

  const handleAircraftClick = (aircraft: PositionLatest) => {
    setSelectedAircraft(aircraft);
  };

  const handleMapClick = () => {
    setSelectedAircraft(null);
  };

  return (
    <div className="flex-1 flex h-screen">
      {/* Map */}
      <div className="flex-1 relative">
        <AircraftMap
          positions={positions}
          onAircraftClick={handleAircraftClick}
          onMapClick={handleMapClick}
          selectedAircraftId={selectedAircraft?.icao_hex}
          showRegions={true}
        />

        {/* Status bar */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {/* ML Dashboard Toggle */}
          <button
            onClick={() => setShowMLPanel(!showMLPanel)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 backdrop-blur-sm rounded-md border text-sm transition-colors',
              showMLPanel
                ? 'bg-primary/20 border-primary/50 text-primary'
                : 'bg-card/90 border-border hover:bg-card'
            )}
          >
            <Brain className="h-4 w-4" />
            ML
          </button>

          {/* Alerts Toggle */}
          <button
            onClick={() => setShowAlertsPanel(!showAlertsPanel)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 backdrop-blur-sm rounded-md border text-sm transition-colors',
              showAlertsPanel
                ? 'bg-primary/20 border-primary/50 text-primary'
                : 'bg-card/90 border-border hover:bg-card'
            )}
          >
            <Bell className="h-4 w-4" />
            Alerts
          </button>

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

        {/* ML Dashboard Panel */}
        {showMLPanel && (
          <div className="absolute top-16 right-4 w-96 animate-slide-up">
            <MLDashboard />
          </div>
        )}

        {/* Formation count indicator */}
        {formations.length > 0 && (
          <div className="absolute bottom-4 left-4 glass rounded-lg px-3 py-2 text-sm">
            <span className="font-semibold text-purple-400">{formations.length}</span>{' '}
            <span className="text-muted-foreground">active formations</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="absolute bottom-4 left-4 right-4 max-w-md mx-auto bg-destructive/10 border border-destructive text-destructive px-4 py-2 rounded-md text-sm">
            {error.message}
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      <div className="w-80 border-l border-border bg-card flex flex-col overflow-hidden">
        {/* Smart Alerts Panel */}
        {showAlertsPanel && (
          <div className="border-b border-border max-h-[40%] overflow-hidden">
            <SmartAlertsPanel maxAlerts={5} />
          </div>
        )}

        {/* Aircraft List */}
        <div className="flex-1 overflow-hidden">
          <AircraftList
            positions={positions}
            onAircraftClick={handleAircraftClick}
            selectedAircraftId={selectedAircraft?.icao_hex}
            loading={loading}
            compact={true}
          />
        </div>
      </div>
    </div>
  );
}
