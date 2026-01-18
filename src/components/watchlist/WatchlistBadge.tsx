'use client';

import { Eye } from 'lucide-react';
import type { WatchlistPriority } from '@/lib/types/watchlist';
import { cn } from '@/lib/utils/cn';

interface WatchlistBadgeProps {
  priority: WatchlistPriority;
  watchlistName?: string;
  compact?: boolean;
}

export default function WatchlistBadge({
  priority,
  watchlistName,
  compact = false,
}: WatchlistBadgeProps) {
  const priorityStyles: Record<WatchlistPriority, string> = {
    low: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
    medium: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    high: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
    critical: 'bg-red-500/20 text-red-500 border-red-500/30 animate-pulse',
  };

  if (compact) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border',
          priorityStyles[priority]
        )}
        title={watchlistName ? `On watchlist: ${watchlistName}` : 'On watchlist'}
      >
        <Eye className="h-3 w-3" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border',
        priorityStyles[priority]
      )}
    >
      <Eye className="h-3.5 w-3.5" />
      <span>{watchlistName || 'Watchlist'}</span>
    </div>
  );
}
