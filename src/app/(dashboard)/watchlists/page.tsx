'use client';

import { Eye } from 'lucide-react';
import { WatchlistManager } from '@/components/watchlist';

export default function WatchlistsPage() {
  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Eye className="h-6 w-6" />
          Watchlists
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track specific aircraft by ICAO hex, registration, callsign patterns, or type codes.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto">
          <WatchlistManager />
        </div>
      </div>
    </div>
  );
}
