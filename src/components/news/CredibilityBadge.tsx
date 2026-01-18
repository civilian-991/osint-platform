'use client';

import { Shield, ShieldCheck, ShieldAlert, ShieldQuestion, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface CredibilityBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const iconMap: Record<string, LucideIcon> = {
  'high': ShieldCheck,
  'medium': Shield,
  'low': ShieldQuestion,
  'very-low': ShieldAlert,
};

export default function CredibilityBadge({
  score,
  showLabel = true,
  size = 'md',
}: CredibilityBadgeProps) {
  const getCredibilityLevel = (score: number) => {
    if (score >= 0.8) return { level: 'high', label: 'Highly Credible', color: 'text-green-500', bgColor: 'bg-green-500/10' };
    if (score >= 0.6) return { level: 'medium', label: 'Credible', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' };
    if (score >= 0.4) return { level: 'low', label: 'Unverified', color: 'text-orange-500', bgColor: 'bg-orange-500/10' };
    return { level: 'very-low', label: 'Low Credibility', color: 'text-red-500', bgColor: 'bg-red-500/10' };
  };

  const { level, label, color, bgColor } = getCredibilityLevel(score);

  const Icon = iconMap[level];

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        bgColor,
        color,
        sizeClasses[size]
      )}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && <span>{label}</span>}
      <span className="opacity-75">({Math.round(score * 100)}%)</span>
    </div>
  );
}
