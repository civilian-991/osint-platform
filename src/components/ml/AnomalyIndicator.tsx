'use client';

import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Navigation,
  Clock,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { AnomalyType } from '@/lib/types/ml';
import { cn } from '@/lib/utils/cn';

interface AnomalyIndicatorProps {
  type: AnomalyType;
  severity: number;
  description?: string;
  compact?: boolean;
}

const anomalyConfig: Record<AnomalyType, {
  label: string;
  icon: LucideIcon;
}> = {
  speed: {
    label: 'Speed Anomaly',
    icon: TrendingUp,
  },
  altitude: {
    label: 'Altitude Anomaly',
    icon: TrendingDown,
  },
  route: {
    label: 'Route Deviation',
    icon: Navigation,
  },
  timing: {
    label: 'Timing Anomaly',
    icon: Clock,
  },
  formation: {
    label: 'Formation Anomaly',
    icon: Users,
  },
  behavioral: {
    label: 'Behavioral Anomaly',
    icon: Zap,
  },
};

function getSeverityColors(severity: number) {
  if (severity >= 0.8) {
    return {
      color: 'text-red-400',
      bgColor: 'bg-red-500/15',
      borderColor: 'border-red-500/40',
      barColor: 'bg-red-500',
    };
  }
  if (severity >= 0.6) {
    return {
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/15',
      borderColor: 'border-orange-500/40',
      barColor: 'bg-orange-500',
    };
  }
  if (severity >= 0.4) {
    return {
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/15',
      borderColor: 'border-amber-500/40',
      barColor: 'bg-amber-500',
    };
  }
  return {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    barColor: 'bg-yellow-500',
  };
}

export default function AnomalyIndicator({
  type,
  severity,
  description,
  compact = false,
}: AnomalyIndicatorProps) {
  const config = anomalyConfig[type];
  const colors = getSeverityColors(severity);
  const Icon = config.icon;

  if (compact) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border',
          colors.bgColor,
          colors.color,
          colors.borderColor
        )}
        title={`${config.label}: ${Math.round(severity * 100)}% severity`}
      >
        <AlertCircle className="h-3 w-3" />
        <Icon className="h-3 w-3" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        colors.bgColor,
        colors.borderColor
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-lg', colors.bgColor, colors.borderColor, 'border')}>
          <Icon className={cn('h-4 w-4', colors.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('font-medium text-sm', colors.color)}>
              {config.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {Math.round(severity * 100)}%
            </span>
          </div>
          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {description}
            </p>
          )}
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', colors.barColor)}
              style={{ width: `${severity * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnomalyCount({ count, maxSeverity }: { count: number; maxSeverity: number }) {
  const colors = getSeverityColors(maxSeverity);

  if (count === 0) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        colors.bgColor,
        colors.color,
        colors.borderColor,
        maxSeverity >= 0.7 && 'animate-pulse'
      )}
    >
      <AlertCircle className="h-3 w-3" />
      <span>{count} anomal{count === 1 ? 'y' : 'ies'}</span>
    </div>
  );
}
