'use client';

import { useState } from 'react';
import { useAircraft } from '@/hooks/useAircraft';
import AircraftList from '@/components/aircraft/AircraftList';
import AircraftCard from '@/components/aircraft/AircraftCard';
import type { PositionLatest } from '@/lib/types/aircraft';
import { formatCoordinates, formatAltitude, formatSpeed } from '@/lib/utils/geo';
import { getMilitaryCategoryLabel, getMilitaryCategoryColor } from '@/lib/utils/military-db';
import { format } from 'date-fns';
import { X, ExternalLink, History, MapPin } from 'lucide-react';
import type { MilitaryCategory } from '@/lib/types/aircraft';

export default function AircraftPage() {
  const [selectedAircraft, setSelectedAircraft] = useState<PositionLatest | null>(null);

  const { positions, loading, refresh } = useAircraft({
    live: true,
    refreshInterval: 30000,
    military: true,
  });

  const handleAircraftClick = (aircraft: PositionLatest) => {
    setSelectedAircraft(aircraft);
  };

  return (
    <div className="flex-1 flex h-screen">
      {/* Aircraft List */}
      <div className="w-96 border-r border-border overflow-hidden">
        <AircraftList
          positions={positions}
          onAircraftClick={handleAircraftClick}
          selectedAircraftId={selectedAircraft?.icao_hex}
          loading={loading}
          compact={false}
        />
      </div>

      {/* Aircraft Details */}
      <div className="flex-1 overflow-y-auto">
        {selectedAircraft ? (
          <AircraftDetails
            aircraft={selectedAircraft}
            onClose={() => setSelectedAircraft(null)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select an aircraft to view details
          </div>
        )}
      </div>
    </div>
  );
}

function AircraftDetails({
  aircraft,
  onClose,
}: {
  aircraft: PositionLatest;
  onClose: () => void;
}) {
  const category = aircraft.aircraft?.military_category as MilitaryCategory | null;
  const color = getMilitaryCategoryColor(category);
  const categoryLabel = getMilitaryCategoryLabel(category);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold font-mono">
              {aircraft.callsign || aircraft.icao_hex}
            </h1>
            <span
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {categoryLabel}
            </span>
          </div>
          <p className="text-muted-foreground">
            {aircraft.aircraft?.type_description || aircraft.aircraft?.type_code || 'Unknown Aircraft Type'}
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-2 hover:bg-muted rounded-md transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Aircraft Info</h2>

          <div className="space-y-3">
            <InfoRow label="ICAO Hex" value={aircraft.icao_hex} />
            <InfoRow
              label="Registration"
              value={aircraft.aircraft?.registration || 'Unknown'}
            />
            <InfoRow
              label="Type Code"
              value={aircraft.aircraft?.type_code || 'Unknown'}
            />
            <InfoRow
              label="Operator"
              value={aircraft.aircraft?.operator || 'Unknown'}
            />
            <InfoRow
              label="Country"
              value={aircraft.aircraft?.country || 'Unknown'}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Current Status</h2>

          <div className="space-y-3">
            <InfoRow
              label="Altitude"
              value={formatAltitude(aircraft.altitude)}
            />
            <InfoRow
              label="Ground Speed"
              value={formatSpeed(aircraft.ground_speed)}
            />
            <InfoRow
              label="Track"
              value={aircraft.track ? `${aircraft.track}°` : 'N/A'}
            />
            <InfoRow
              label="Vertical Rate"
              value={
                aircraft.vertical_rate
                  ? `${aircraft.vertical_rate > 0 ? '+' : ''}${aircraft.vertical_rate} ft/min`
                  : 'N/A'
              }
            />
            <InfoRow label="Squawk" value={aircraft.squawk || 'N/A'} />
            <InfoRow
              label="On Ground"
              value={aircraft.on_ground ? 'Yes' : 'No'}
            />
          </div>
        </div>
      </div>

      {/* Position */}
      <div className="bg-muted/50 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">Position</h2>
        </div>
        <p className="text-lg font-mono">
          {formatCoordinates(aircraft.latitude, aircraft.longitude)}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Last updated: {format(new Date(aircraft.timestamp), 'PPpp')}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <a
          href={`https://www.flightradar24.com/${aircraft.icao_hex.toLowerCase()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          View on FlightRadar24
        </a>

        <a
          href={`https://globe.adsbexchange.com/?icao=${aircraft.icao_hex.toLowerCase()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          View on ADS-B Exchange
        </a>

        <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors">
          <History className="h-4 w-4" />
          View History
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
