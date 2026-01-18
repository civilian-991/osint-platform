'use client';

import { cn } from '@/lib/utils/cn';
import { getConfidenceLevel } from '@/lib/types/correlation';

interface ConfidenceIndicatorProps {
  score: number;
  showLabel?: boolean;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function ConfidenceIndicator({
  score,
  showLabel = true,
  showPercentage = true,
  size = 'md',
}: ConfidenceIndicatorProps) {
  const level = getConfidenceLevel(score);
  const percentage = Math.round(score * 100);

  const config = {
    high: {
      label: 'High Confidence',
      color: 'bg-green-500',
      textColor: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    medium: {
      label: 'Medium Confidence',
      color: 'bg-yellow-500',
      textColor: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    low: {
      label: 'Low Confidence',
      color: 'bg-red-500',
      textColor: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
  }[level];

  const sizeClasses = {
    sm: { bar: 'h-1', text: 'text-xs', container: 'w-16' },
    md: { bar: 'h-1.5', text: 'text-sm', container: 'w-24' },
    lg: { bar: 'h-2', text: 'text-base', container: 'w-32' },
  }[size];

  return (
    <div className="flex items-center gap-2">
      {/* Progress bar */}
      <div
        className={cn(
          'rounded-full overflow-hidden bg-muted',
          sizeClasses.bar,
          sizeClasses.container
        )}
      >
        <div
          className={cn('h-full rounded-full transition-all', config.color)}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Label */}
      {(showLabel || showPercentage) && (
        <span className={cn(sizeClasses.text, config.textColor)}>
          {showPercentage && `${percentage}%`}
          {showLabel && showPercentage && ' - '}
          {showLabel && config.label}
        </span>
      )}
    </div>
  );
}
