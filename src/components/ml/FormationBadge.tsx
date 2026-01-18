'use client';

import {
  Fuel,
  Shield,
  Crosshair,
  Circle,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { FormationType } from '@/lib/types/ml';
import { cn } from '@/lib/utils/cn';

interface FormationBadgeProps {
  type: FormationType;
  aircraftCount?: number;
  confidence?: number;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const formationConfig: Record<FormationType, {
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}> = {
  tanker_receiver: {
    label: 'Refueling',
    icon: Fuel,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    description: 'Tanker-receiver refueling operation',
  },
  escort: {
    label: 'Escort',
    icon: Shield,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    description: 'Fighter escort formation',
  },
  strike_package: {
    label: 'Strike',
    icon: Crosshair,
    color: 'text-red-400',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-500/40',
    description: 'Coordinated strike package',
  },
  cap: {
    label: 'CAP',
    icon: Circle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    description: 'Combat Air Patrol',
  },
  unknown: {
    label: 'Formation',
    icon: Users,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/30',
    description: 'Unclassified formation',
  },
};

export default function FormationBadge({
  type,
  aircraftCount,
  confidence,
  showDetails = false,
  size = 'md',
}: FormationBadgeProps) {
  const config = formationConfig[type];
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
      {showDetails && aircraftCount && aircraftCount > 1 && (
        <span className="opacity-70">×{aircraftCount}</span>
      )}
      {showDetails && confidence !== undefined && (
        <span className="opacity-60 text-[10px]">{Math.round(confidence * 100)}%</span>
      )}
    </div>
  );
}

export function getFormationConfig(type: FormationType) {
  return formationConfig[type];
}
