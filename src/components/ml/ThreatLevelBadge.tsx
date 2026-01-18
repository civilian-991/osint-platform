'use client';

import { AlertTriangle, Shield, AlertOctagon, ShieldAlert, ShieldOff } from 'lucide-react';
import type { ThreatLevel } from '@/lib/types/ml';
import { cn } from '@/lib/utils/cn';

interface ThreatLevelBadgeProps {
  level: ThreatLevel;
  score?: number;
  showLabel?: boolean;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

const threatConfig: Record<ThreatLevel, {
  label: string;
  icon: typeof Shield;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
}> = {
  minimal: {
    label: 'Minimal',
    icon: Shield,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/30',
    glowColor: '',
  },
  low: {
    label: 'Low',
    icon: Shield,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    glowColor: '',
  },
  elevated: {
    label: 'Elevated',
    icon: ShieldAlert,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    borderColor: 'border-amber-500/40',
    glowColor: 'shadow-amber-500/20',
  },
  high: {
    label: 'High',
    icon: AlertTriangle,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/15',
    borderColor: 'border-orange-500/40',
    glowColor: 'shadow-orange-500/25',
  },
  critical: {
    label: 'Critical',
    icon: AlertOctagon,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/50',
    glowColor: 'shadow-red-500/30',
  },
};

export default function ThreatLevelBadge({
  level,
  score,
  showLabel = true,
  showScore = false,
  size = 'md',
  animated = false,
}: ThreatLevelBadgeProps) {
  const config = threatConfig[level];
  const Icon = config.icon;

  const sizeClasses = {
    sm: {
      container: 'px-1.5 py-0.5 text-xs gap-1',
      icon: 'h-3 w-3',
    },
    md: {
      container: 'px-2 py-1 text-xs gap-1.5',
      icon: 'h-3.5 w-3.5',
    },
    lg: {
      container: 'px-3 py-1.5 text-sm gap-2',
      icon: 'h-4 w-4',
    },
  };

  const shouldAnimate = animated && (level === 'high' || level === 'critical');

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full font-medium border transition-all',
        config.bgColor,
        config.color,
        config.borderColor,
        config.glowColor && `shadow-lg ${config.glowColor}`,
        sizeClasses[size].container,
        shouldAnimate && 'animate-pulse'
      )}
    >
      <Icon className={sizeClasses[size].icon} />
      {showLabel && <span>{config.label}</span>}
      {showScore && score !== undefined && (
        <span className="opacity-70">({Math.round(score * 100)}%)</span>
      )}
    </div>
  );
}

export function getThreatLevelFromScore(score: number): ThreatLevel {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.4) return 'elevated';
  if (score >= 0.2) return 'low';
  return 'minimal';
}
