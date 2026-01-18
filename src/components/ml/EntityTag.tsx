'use client';

import {
  Plane,
  Target,
  Users,
  MapPin,
  Sword,
  User,
  Building,
  type LucideIcon,
} from 'lucide-react';
import type { EnhancedEntityType } from '@/lib/types/ml';
import { cn } from '@/lib/utils/cn';

interface EntityTagProps {
  name: string;
  type: EnhancedEntityType;
  confidence?: number;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

const entityConfig: Record<EnhancedEntityType, {
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  aircraft: {
    icon: Plane,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/25',
  },
  weapon_system: {
    icon: Target,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/25',
  },
  military_unit: {
    icon: Users,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/25',
  },
  operation_name: {
    icon: Sword,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/25',
  },
  equipment: {
    icon: Building,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/25',
  },
  personnel: {
    icon: User,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/25',
  },
  location: {
    icon: MapPin,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/25',
  },
};

export default function EntityTag({
  name,
  type,
  confidence,
  onClick,
  size = 'md',
}: EntityTagProps) {
  const config = entityConfig[type];
  const Icon = config.icon;

  const sizeClasses = {
    sm: {
      container: 'px-1.5 py-0.5 text-[10px] gap-1',
      icon: 'h-2.5 w-2.5',
    },
    md: {
      container: 'px-2 py-1 text-xs gap-1.5',
      icon: 'h-3 w-3',
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'inline-flex items-center rounded border font-medium transition-all',
        config.bgColor,
        config.color,
        config.borderColor,
        sizeClasses[size].container,
        onClick && 'hover:opacity-80 cursor-pointer',
        !onClick && 'cursor-default'
      )}
      title={`${type.replace('_', ' ')}: ${name}${confidence ? ` (${Math.round(confidence * 100)}% confidence)` : ''}`}
    >
      <Icon className={sizeClasses[size].icon} />
      <span className="truncate max-w-[120px]">{name}</span>
    </button>
  );
}

export function EntityTagList({
  entities,
  maxShow = 4,
  size = 'md',
}: {
  entities: Array<{ name: string; type: EnhancedEntityType; confidence?: number }>;
  maxShow?: number;
  size?: 'sm' | 'md';
}) {
  const displayed = entities.slice(0, maxShow);
  const remaining = entities.length - maxShow;

  return (
    <div className="flex flex-wrap gap-1.5">
      {displayed.map((entity, i) => (
        <EntityTag
          key={`${entity.type}-${entity.name}-${i}`}
          name={entity.name}
          type={entity.type}
          confidence={entity.confidence}
          size={size}
        />
      ))}
      {remaining > 0 && (
        <span className="text-xs text-muted-foreground self-center">
          +{remaining} more
        </span>
      )}
    </div>
  );
}
