'use client';

import { useState } from 'react';
import { useAircraft } from '@/hooks/useAircraft';
import AircraftList from '@/components/aircraft/AircraftList';
import AircraftCard from '@/components/aircraft/AircraftCard';
import type { PositionLatest } from '@/lib/types/aircraft';
import { formatCoordinates, formatAltitude, formatSpeed } from '@/lib/utils/geo';
import { getMilitaryCategoryLabel, getMilitaryCategoryColor } from '@/lib/utils/military-db';
import { getAircraftPrior, getDefaultPriorByCategory, type AircraftPrior } from '@/lib/knowledge/aircraft-priors';
import { format } from 'date-fns';
import { X, ExternalLink, History, MapPin, Plane, Target, Gauge, Radar, Users, Info, Activity, Crosshair } from 'lucide-react';
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

  // Get rich aircraft data from priors knowledge base
  const typeCode = aircraft.aircraft?.type_code || '';
  const aircraftPrior = getAircraftPrior(typeCode);
  const categoryDefaults = category ? getDefaultPriorByCategory(category) : null;

  // Get role description based on category and prior
  const getRoleDescription = (): string => {
    if (aircraftPrior?.description) return aircraftPrior.description;

    const roleMap: Record<MilitaryCategory, string> = {
      tanker: 'Aerial refueling aircraft that extends the range and endurance of other military aircraft by providing in-flight fuel transfer.',
      awacs: 'Airborne Warning and Control System aircraft that provides all-weather surveillance, command, control, and communications.',
      isr: 'Intelligence, Surveillance, and Reconnaissance aircraft used for gathering information through aerial observation.',
      transport: 'Military cargo and personnel transport aircraft for strategic and tactical airlift operations.',
      fighter: 'Combat aircraft designed for air-to-air combat and/or air-to-ground attack missions.',
      helicopter: 'Rotary-wing aircraft used for transport, attack, reconnaissance, or search and rescue operations.',
      trainer: 'Aircraft used for training military pilots in various flight operations.',
      other: 'Military aircraft with specialized or unclassified mission profile.',
    };

    return category ? roleMap[category] : 'Unknown aircraft type or mission profile.';
  };

  // Get typical missions based on intent priors
  const getTypicalMissions = (): { mission: string; likelihood: number }[] => {
    const priors = aircraftPrior?.intentPriors || categoryDefaults?.intentPriors;
    if (!priors) return [];

    const missionLabels: Record<string, string> = {
      reconnaissance: 'Reconnaissance/ISR',
      transport: 'Transport/Airlift',
      training: 'Training/Exercise',
      combat: 'Combat/Strike',
      refueling: 'Aerial Refueling',
      patrol: 'Patrol/CAP',
    };

    return Object.entries(priors)
      .filter(([, likelihood]) => likelihood > 0.05)
      .sort(([, a], [, b]) => b - a)
      .map(([mission, likelihood]) => ({
        mission: missionLabels[mission] || mission,
        likelihood: likelihood * 100,
      }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="p-3 rounded-xl"
              style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}
            >
              <Plane className="h-8 w-8" style={{ color }} />
            </div>
            <div>
              <h1 className="text-3xl font-bold font-mono">
                {aircraft.callsign || aircraft.icao_hex}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="px-3 py-1 rounded-full text-sm font-medium"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {categoryLabel}
                </span>
                {aircraft.aircraft?.country && (
                  <span className="text-sm text-muted-foreground">
                    {aircraft.aircraft.country}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 hover:bg-muted rounded-md transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Aircraft Name & Description */}
      <div className="bg-gradient-to-r from-muted/50 to-transparent rounded-xl p-5 border border-border/50">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <h2 className="text-xl font-semibold mb-1">
              {aircraftPrior?.name || aircraft.aircraft?.type_description || aircraft.aircraft?.type_code || 'Unknown Aircraft'}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {getRoleDescription()}
            </p>
          </div>
        </div>
      </div>

      {/* Typical Missions / Role */}
      {getTypicalMissions().length > 0 && (
        <div className="bg-muted/30 rounded-xl p-5 border border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">Typical Missions</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {getTypicalMissions().map(({ mission, likelihood }) => (
              <div key={mission} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{mission}</span>
                    <span className="text-xs text-muted-foreground">{likelihood.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${likelihood}%`,
                        backgroundColor: likelihood > 50 ? color : `${color}80`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance & Current Status Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Performance Characteristics */}
        {(aircraftPrior || categoryDefaults) && (
          <div className="bg-muted/30 rounded-xl p-5 border border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Gauge className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Performance</h2>
            </div>
            <div className="space-y-3">
              {(aircraftPrior?.typicalAltitude || categoryDefaults?.typicalAltitude) && (
                <InfoRow
                  label="Typical Altitude"
                  value={`${((aircraftPrior?.typicalAltitude?.min || categoryDefaults?.typicalAltitude?.min || 0) / 1000).toFixed(0)}k - ${((aircraftPrior?.typicalAltitude?.max || categoryDefaults?.typicalAltitude?.max || 0) / 1000).toFixed(0)}k ft`}
                />
              )}
              {(aircraftPrior?.typicalSpeed || categoryDefaults?.typicalSpeed) && (
                <InfoRow
                  label="Typical Speed"
                  value={`${aircraftPrior?.typicalSpeed?.min || categoryDefaults?.typicalSpeed?.min || 0} - ${aircraftPrior?.typicalSpeed?.max || categoryDefaults?.typicalSpeed?.max || 0} kts`}
                />
              )}
              {aircraftPrior?.maxRange && (
                <InfoRow
                  label="Max Range"
                  value={`${aircraftPrior.maxRange.toLocaleString()} nm`}
                />
              )}
              {aircraftPrior?.maxClimbRate && (
                <InfoRow
                  label="Max Climb Rate"
                  value={`${aircraftPrior.maxClimbRate.toLocaleString()} ft/min`}
                />
              )}
              {aircraftPrior?.typicalMissionDuration && (
                <InfoRow
                  label="Mission Duration"
                  value={`${aircraftPrior.typicalMissionDuration.min} - ${aircraftPrior.typicalMissionDuration.max} hrs`}
                />
              )}
            </div>
          </div>
        )}

        {/* Current Status */}
        <div className="bg-muted/30 rounded-xl p-5 border border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">Current Status</h2>
          </div>
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

      {/* Aircraft Info & Operators */}
      <div className="grid grid-cols-2 gap-6">
        {/* Aircraft Identification */}
        <div className="bg-muted/30 rounded-xl p-5 border border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Radar className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">Identification</h2>
          </div>
          <div className="space-y-3">
            <InfoRow label="ICAO Hex" value={aircraft.icao_hex} mono />
            <InfoRow
              label="Registration"
              value={aircraft.aircraft?.registration || 'Unknown'}
              mono
            />
            <InfoRow
              label="Type Code"
              value={aircraft.aircraft?.type_code || 'Unknown'}
              mono
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

        {/* Known Operators */}
        {aircraftPrior?.operators && aircraftPrior.operators.length > 0 && (
          <div className="bg-muted/30 rounded-xl p-5 border border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Known Operators</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {aircraftPrior.operators.map((operator) => (
                <span
                  key={operator}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-muted border border-border/50"
                >
                  {operator}
                </span>
              ))}
            </div>
            {aircraftPrior.operatingRegions && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-sm text-muted-foreground mb-2">Operating Regions</p>
                <div className="flex flex-wrap gap-2">
                  {aircraftPrior.operatingRegions.map((region) => (
                    <span
                      key={region}
                      className="px-2 py-1 rounded text-xs bg-primary/10 text-primary border border-primary/20"
                    >
                      {region}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Position */}
      <div className="bg-muted/30 rounded-xl p-5 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Position</h2>
        </div>
        <p className="text-xl font-mono">
          {formatCoordinates(aircraft.latitude, aircraft.longitude)}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Last updated: {format(new Date(aircraft.timestamp), 'PPpp')}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <a
          href={`https://www.flightradar24.com/${aircraft.icao_hex.toLowerCase()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          <ExternalLink className="h-4 w-4" />
          FlightRadar24
        </a>

        <a
          href={`https://globe.adsbexchange.com/?icao=${aircraft.icao_hex.toLowerCase()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors font-medium"
        >
          <ExternalLink className="h-4 w-4" />
          ADS-B Exchange
        </a>

        <a
          href={`https://www.planespotters.net/hex/${aircraft.icao_hex.toUpperCase()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors font-medium"
        >
          <Crosshair className="h-4 w-4" />
          Planespotters
        </a>

        <button className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors font-medium">
          <History className="h-4 w-4" />
          View History
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className={`font-medium ${mono ? 'font-mono text-sm' : ''}`}>{value}</span>
    </div>
  );
}
