'use client';

import { FC } from 'react';
import { cn } from '@/lib/utils';
import { useProximityWarnings } from '@/hooks/usePredictions';
import type { ProximityWarning, ProximitySeverity } from '@/lib/types/predictions';
import {
  getProximitySeverityColor,
  getProximityWarningLabel,
  formatTimeToClosest,
} from '@/lib/types/predictions';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  Plane,
  RefreshCw,
  X,
} from 'lucide-react';

interface ProximityWarningPanelProps {
  aircraftId?: string;
  maxItems?: number;
  className?: string;
}

const ProximityWarningPanel: FC<ProximityWarningPanelProps> = ({
  aircraftId,
  maxItems = 10,
  className,
}) => {
  const { warnings, loading, error, acknowledge, refresh } = useProximityWarnings(aircraftId);

  const displayWarnings = warnings.slice(0, maxItems);

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h3 className="font-semibold">Proximity Warnings</h3>
          {warnings.length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/10 text-amber-500">
              {warnings.length}
            </span>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1 hover:bg-muted rounded"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {error ? (
          <div className="p-4 text-center text-red-500 text-sm">
            {error}
          </div>
        ) : displayWarnings.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p>No active proximity warnings</p>
          </div>
        ) : (
          <div className="divide-y">
            {displayWarnings.map((warning) => (
              <ProximityWarningItem
                key={warning.id}
                warning={warning}
                onAcknowledge={() => acknowledge(warning.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {warnings.length > maxItems && (
        <div className="px-4 py-2 border-t text-center text-xs text-muted-foreground">
          Showing {maxItems} of {warnings.length} warnings
        </div>
      )}
    </div>
  );
};

interface ProximityWarningItemProps {
  warning: ProximityWarning;
  onAcknowledge: () => void;
}

const ProximityWarningItem: FC<ProximityWarningItemProps> = ({
  warning,
  onAcknowledge,
}) => {
  const severityColor = getProximitySeverityColor(warning.severity);
  const warningLabel = getProximityWarningLabel(warning.warning_type);

  // Calculate time to closest approach
  const timeToClosest = warning.closest_approach_time
    ? (new Date(warning.closest_approach_time).getTime() - Date.now()) / 60000
    : null;

  return (
    <div
      className={cn(
        'p-4 hover:bg-muted/50 transition-colors',
        warning.is_acknowledged && 'opacity-60'
      )}
    >
      {/* Severity badge and type */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 text-xs font-medium rounded-full"
            style={{
              backgroundColor: `${severityColor}20`,
              color: severityColor,
            }}
          >
            {warning.severity.toUpperCase()}
          </span>
          <span className="text-sm font-medium">{warningLabel}</span>
        </div>
        {!warning.is_acknowledged && (
          <button
            onClick={onAcknowledge}
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
            title="Acknowledge"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Aircraft pair */}
      <div className="flex items-center gap-2 text-sm mb-2">
        <div className="flex items-center gap-1">
          <Plane className="h-3 w-3" />
          <span className="font-mono">{warning.icao_hex_1}</span>
        </div>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <div className="flex items-center gap-1">
          <Plane className="h-3 w-3" />
          <span className="font-mono">{warning.icao_hex_2}</span>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>
          <span className="block text-foreground font-medium">
            {warning.closest_approach_nm.toFixed(1)} nm
          </span>
          <span>Closest approach</span>
        </div>
        {timeToClosest !== null && timeToClosest > 0 && (
          <div>
            <span className="block text-foreground font-medium">
              {formatTimeToClosest(timeToClosest)}
            </span>
            <span>Time to closest</span>
          </div>
        )}
        {warning.closure_rate_kts && (
          <div>
            <span className="block text-foreground font-medium">
              {warning.closure_rate_kts} kts
            </span>
            <span>Closure rate</span>
          </div>
        )}
        {warning.vertical_separation_ft !== null && (
          <div>
            <span className="block text-foreground font-medium">
              {warning.vertical_separation_ft.toLocaleString()} ft
            </span>
            <span>Vertical sep.</span>
          </div>
        )}
      </div>

      {/* Confidence */}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${warning.confidence * 100}%`,
              backgroundColor: severityColor,
            }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {Math.round(warning.confidence * 100)}%
        </span>
      </div>

      {/* Timestamp */}
      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>
          First detected {formatTimestamp(warning.first_detected_at)}
        </span>
      </div>
    </div>
  );
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString();
}

export default ProximityWarningPanel;
