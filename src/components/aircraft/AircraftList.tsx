'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, ChevronDown, Plane, Loader2 } from 'lucide-react';
import type { PositionLatest, MilitaryCategory } from '@/lib/types/aircraft';
import AircraftCard from './AircraftCard';
import { cn } from '@/lib/utils/cn';

interface AircraftListProps {
  positions: PositionLatest[];
  onAircraftClick?: (aircraft: PositionLatest) => void;
  selectedAircraftId?: string;
  loading?: boolean;
  compact?: boolean;
}

const CATEGORY_OPTIONS: { value: MilitaryCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'tanker', label: 'Tankers' },
  { value: 'awacs', label: 'AWACS' },
  { value: 'isr', label: 'ISR' },
  { value: 'transport', label: 'Transport' },
  { value: 'fighter', label: 'Fighter' },
  { value: 'helicopter', label: 'Helicopter' },
  { value: 'other', label: 'Other' },
];

export default function AircraftList({
  positions,
  onAircraftClick,
  selectedAircraftId,
  loading = false,
  compact = false,
}: AircraftListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MilitaryCategory | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredPositions = useMemo(() => {
    return positions.filter((position) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesCallsign = position.callsign?.toLowerCase().includes(query);
        const matchesIcao = position.icao_hex.toLowerCase().includes(query);
        const matchesType = position.aircraft?.type_code?.toLowerCase().includes(query);
        const matchesOperator = position.aircraft?.operator?.toLowerCase().includes(query);

        if (!matchesCallsign && !matchesIcao && !matchesType && !matchesOperator) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== 'all') {
        if (position.aircraft?.military_category !== categoryFilter) {
          return false;
        }
      }

      return true;
    });
  }, [positions, searchQuery, categoryFilter]);

  // Group by category for summary
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    positions.forEach((p) => {
      const cat = p.aircraft?.military_category || 'other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [positions]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Plane className="h-5 w-5" />
            Aircraft
            <span className="text-muted-foreground font-normal">
              ({filteredPositions.length})
            </span>
          </h2>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors',
              showFilters ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
            )}
          >
            <Filter className="h-4 w-4" />
            Filter
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', showFilters && 'rotate-180')}
            />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search callsign, ICAO, type..."
            className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="pt-2 space-y-2">
            <label className="text-xs text-muted-foreground">Category</label>
            <div className="flex flex-wrap gap-1">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setCategoryFilter(option.value)}
                  className={cn(
                    'px-2 py-1 rounded text-xs transition-colors',
                    categoryFilter === option.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  {option.label}
                  {option.value !== 'all' && categoryCounts[option.value] && (
                    <span className="ml-1 opacity-70">
                      ({categoryCounts[option.value]})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPositions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Plane className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">No aircraft found</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-sm text-primary hover:underline mt-1"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className={cn('p-4', compact ? 'space-y-1' : 'space-y-3')}>
            {filteredPositions.map((position) => (
              <AircraftCard
                key={position.icao_hex}
                position={position}
                onClick={() => onAircraftClick?.(position)}
                isSelected={position.icao_hex === selectedAircraftId}
                compact={compact}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
