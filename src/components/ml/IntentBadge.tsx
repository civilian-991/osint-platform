'use client';

import {
  Target,
  Eye,
  Fuel,
  Crosshair,
  Route,
  Users,
  GraduationCap,
  CircleDot,
  type LucideIcon,
} from 'lucide-react';
import type { IntentType } from '@/lib/types/ml';
import { cn } from '@/lib/utils/cn';

interface IntentBadgeProps {
  intent: IntentType;
  confidence?: number;
  showConfidence?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const intentConfig: Record<IntentType, {
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}> = {
  training: {
    label: 'Training',
    icon: GraduationCap,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    description: 'Routine training exercise',
  },
  patrol: {
    label: 'Patrol',
    icon: Eye,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    description: 'Border or airspace patrol',
  },
  refueling: {
    label: 'Refueling',
    icon: Fuel,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    description: 'Aerial refueling operation',
  },
  surveillance: {
    label: 'Surveillance',
    icon: Target,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    description: 'ISR / reconnaissance mission',
  },
  combat: {
    label: 'Combat',
    icon: Crosshair,
    color: 'text-red-400',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-500/40',
    description: 'Active combat operations',
  },
  transit: {
    label: 'Transit',
    icon: Route,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    description: 'Point-to-point transit',
  },
  exercise: {
    label: 'Exercise',
    icon: Users,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30',
    description: 'Multi-unit exercise',
  },
  unknown: {
    label: 'Unknown',
    icon: CircleDot,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/30',
    description: 'Unclassified activity',
  },
};

export default function IntentBadge({
  intent,
  confidence,
  showConfidence = false,
  size = 'md',
}: IntentBadgeProps) {
  const config = intentConfig[intent];
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

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full font-medium border',
        config.bgColor,
        config.color,
        config.borderColor,
        sizeClasses[size].container
      )}
      title={config.description}
    >
      <Icon className={sizeClasses[size].icon} />
      <span>{config.label}</span>
      {showConfidence && confidence !== undefined && (
        <span className="opacity-60 text-[10px]">{Math.round(confidence * 100)}%</span>
      )}
    </div>
  );
}

export function getIntentConfig(intent: IntentType) {
  return intentConfig[intent];
}
