'use client';

import { Plane, ArrowUp, Gauge, MapPin, Brain } from 'lucide-react';
import type { PositionLatest, MilitaryCategory } from '@/lib/types/aircraft';
import type { ThreatLevel, IntentType, AnomalyType } from '@/lib/types/ml';
import { getMilitaryCategoryColor, getMilitaryCategoryLabel } from '@/lib/utils/military-db';
import { formatAltitude, formatSpeed, formatCoordinates } from '@/lib/utils/geo';
import { cn } from '@/lib/utils/cn';
import { formatDistanceToNow } from 'date-fns';
import { ThreatLevelBadge, IntentBadge, AnomalyCount, FormationBadge } from '@/components/ml';
import type { FormationType } from '@/lib/types/ml';

interface MLIndicators {
  threatLevel?: ThreatLevel;
  threatScore?: number;
  intent?: IntentType;
  intentConfidence?: number;
  anomalyCount?: number;
  maxAnomalySeverity?: number;
  formation?: {
    type: FormationType;
    aircraftCount: number;
  };
}

interface AircraftCardProps {
  position: PositionLatest;
  onClick?: () => void;
  isSelected?: boolean;
  compact?: boolean;
  mlData?: MLIndicators;
}

export default function AircraftCard({
  position,
  onClick,
  isSelected,
  compact = false,
  mlData,
}: AircraftCardProps) {
  const category = position.aircraft?.military_category as MilitaryCategory | null;
  const color = getMilitaryCategoryColor(category);
  const categoryLabel = getMilitaryCategoryLabel(category);

  const lastSeen = formatDistanceToNow(new Date(position.timestamp), {
    addSuffix: true,
  });

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all duration-200',
          isSelected
            ? 'bg-primary/10 border border-primary/50 shadow-lg'
            : 'hover:bg-muted/50 border border-transparent'
        )}
        style={isSelected ? { boxShadow: `0 0 20px ${color}20` } : undefined}
      >
        <div
          className="p-1.5 rounded-lg border relative"
          style={{
            backgroundColor: `${color}15`,
            borderColor: `${color}30`
          }}
        >
          <Plane className="h-4 w-4" style={{ color }} />
          {mlData?.threatLevel && mlData.threatLevel !== 'minimal' && mlData.threatLevel !== 'low' && (
            <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-foreground truncate">
              {position.callsign || position.icao_hex}
            </span>
            {mlData?.formation && (
              <FormationBadge type={mlData.formation.type} size="sm" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              {position.aircraft?.type_code || 'Unknown'}
            </span>
            {mlData?.intent && mlData.intent !== 'unknown' && (
              <IntentBadge intent={mlData.intent} size="sm" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mlData?.anomalyCount && mlData.anomalyCount > 0 && (
            <AnomalyCount count={mlData.anomalyCount} maxSeverity={mlData.maxAnomalySeverity || 0} />
          )}
          <div className="text-right text-xs">
            <div className="text-foreground font-medium">{formatAltitude(position.altitude)}</div>
            <div className="text-muted-foreground">{formatSpeed(position.ground_speed)}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'glass rounded-xl p-4 cursor-pointer card-interactive',
        isSelected
          ? 'border-primary/50 ring-1 ring-primary/30'
          : 'border-border/50 hover:border-primary/30'
      )}
      style={isSelected ? { boxShadow: `0 0 30px ${color}15` } : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-lg border"
            style={{
              backgroundColor: `${color}15`,
              borderColor: `${color}30`
            }}
          >
            <Plane className="h-5 w-5" style={{ color }} />
          </div>
          <div>
            <div className="font-mono font-bold text-lg text-foreground">
              {position.callsign || position.icao_hex}
            </div>
            <div className="text-sm text-muted-foreground">
              {position.aircraft?.type_description || position.aircraft?.type_code || 'Unknown Type'}
            </div>
          </div>
        </div>

        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full border"
          style={{
            backgroundColor: `${color}20`,
            color,
            borderColor: `${color}40`
          }}
        >
          {categoryLabel}
        </span>
      </div>

      {/* ML Intelligence Row */}
      {mlData && (mlData.threatLevel || mlData.intent || mlData.anomalyCount || mlData.formation) && (
        <div className="flex items-center flex-wrap gap-2 mb-4 p-2.5 rounded-lg bg-muted/20 border border-border/30">
          <Brain className="h-4 w-4 text-muted-foreground" />
          {mlData.threatLevel && mlData.threatLevel !== 'minimal' && (
            <ThreatLevelBadge
              level={mlData.threatLevel}
              score={mlData.threatScore}
              showScore
              size="sm"
              animated={mlData.threatLevel === 'critical' || mlData.threatLevel === 'high'}
            />
          )}
          {mlData.intent && mlData.intent !== 'unknown' && (
            <IntentBadge
              intent={mlData.intent}
              confidence={mlData.intentConfidence}
              showConfidence
              size="sm"
            />
          )}
          {mlData.formation && (
            <FormationBadge
              type={mlData.formation.type}
              aircraftCount={mlData.formation.aircraftCount}
              showDetails
              size="sm"
            />
          )}
          {mlData.anomalyCount && mlData.anomalyCount > 0 && (
            <AnomalyCount
              count={mlData.anomalyCount}
              maxSeverity={mlData.maxAnomalySeverity || 0}
            />
          )}
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30">
          <ArrowUp
            className="h-4 w-4 text-primary"
            style={{ transform: `rotate(${position.track || 0}deg)` }}
          />
          <div>
            <div className="text-xs text-muted-foreground">Altitude</div>
            <div className="font-semibold text-foreground">{formatAltitude(position.altitude)}</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30">
          <Gauge className="h-4 w-4 text-primary" />
          <div>
            <div className="text-xs text-muted-foreground">Speed</div>
            <div className="font-semibold text-foreground">{formatSpeed(position.ground_speed)}</div>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="flex items-center gap-2 text-sm mb-4 p-2 rounded-lg bg-muted/20">
        <MapPin className="h-4 w-4 text-accent" />
        <span className="font-mono text-foreground">{formatCoordinates(position.latitude, position.longitude)}</span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs pt-3 border-t border-border/50">
        <span className="font-mono text-muted-foreground">ICAO: <span className="text-foreground">{position.icao_hex}</span></span>
        <span className="text-muted-foreground">Updated {lastSeen}</span>
      </div>

      {/* Operator */}
      {position.aircraft?.operator && (
        <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/30">
          <span className="text-foreground/60">Operator:</span> <span className="text-foreground">{position.aircraft.operator}</span>
        </div>
      )}
    </div>
  );
}
