'use client';

import { Plane, ArrowUp, Gauge, MapPin } from 'lucide-react';
import type { PositionLatest, MilitaryCategory } from '@/lib/types/aircraft';
import { getMilitaryCategoryColor, getMilitaryCategoryLabel } from '@/lib/utils/military-db';
import { formatAltitude, formatSpeed, formatCoordinates } from '@/lib/utils/geo';
import { cn } from '@/lib/utils/cn';
import { formatDistanceToNow } from 'date-fns';

interface AircraftCardProps {
  position: PositionLatest;
  onClick?: () => void;
  isSelected?: boolean;
  compact?: boolean;
}

export default function AircraftCard({
  position,
  onClick,
  isSelected,
  compact = false,
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
          'flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors',
          isSelected ? 'bg-primary/10 border border-primary' : 'hover:bg-muted'
        )}
      >
        <div
          className="p-1.5 rounded"
          style={{ backgroundColor: `${color}20` }}
        >
          <Plane className="h-4 w-4" style={{ color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-mono font-medium truncate">
            {position.callsign || position.icao_hex}
          </div>
          <div className="text-xs text-muted-foreground">
            {position.aircraft?.type_code || 'Unknown'}
          </div>
        </div>

        <div className="text-right text-xs">
          <div>{formatAltitude(position.altitude)}</div>
          <div className="text-muted-foreground">{formatSpeed(position.ground_speed)}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-card border rounded-lg p-4 cursor-pointer transition-all',
        isSelected
          ? 'border-primary shadow-md ring-1 ring-primary'
          : 'border-border hover:border-primary/50 hover:shadow-sm'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${color}20` }}
          >
            <Plane className="h-5 w-5" style={{ color }} />
          </div>
          <div>
            <div className="font-mono font-semibold text-lg">
              {position.callsign || position.icao_hex}
            </div>
            <div className="text-sm text-muted-foreground">
              {position.aircraft?.type_description || position.aircraft?.type_code || 'Unknown Type'}
            </div>
          </div>
        </div>

        <span
          className="text-xs font-medium px-2 py-1 rounded-full"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {categoryLabel}
        </span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="flex items-center gap-2">
          <ArrowUp
            className="h-4 w-4 text-muted-foreground"
            style={{ transform: `rotate(${position.track || 0}deg)` }}
          />
          <div>
            <div className="text-xs text-muted-foreground">Altitude</div>
            <div className="font-medium">{formatAltitude(position.altitude)}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">Speed</div>
            <div className="font-medium">{formatSpeed(position.ground_speed)}</div>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
        <MapPin className="h-4 w-4" />
        <span>{formatCoordinates(position.latitude, position.longitude)}</span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
        <span>ICAO: {position.icao_hex}</span>
        <span>Updated {lastSeen}</span>
      </div>

      {/* Operator */}
      {position.aircraft?.operator && (
        <div className="text-xs text-muted-foreground mt-2">
          Operator: {position.aircraft.operator}
        </div>
      )}
    </div>
  );
}
