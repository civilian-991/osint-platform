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
    <div className="flex flex-col h-full glass">
      {/* Header */}
      <div className="p-4 border-b border-border/50 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" />
            Aircraft
            <span className="text-sm font-normal text-muted-foreground">
              ({filteredPositions.length})
            </span>
          </h2>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
              showFilters
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <Filter className="h-4 w-4" />
            Filter
            <ChevronDown
              className={cn('h-4 w-4 transition-transform duration-200', showFilters && 'rotate-180')}
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
            className="input-field pl-10"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="pt-2 space-y-2 animate-slide-up">
            <label className="text-xs font-medium text-foreground">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setCategoryFilter(option.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200',
                    categoryFilter === option.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-foreground hover:bg-muted border border-border/50'
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
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
              <Loader2 className="h-8 w-8 animate-spin text-primary relative" />
            </div>
          </div>
        ) : filteredPositions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <div className="p-4 rounded-full bg-muted/30 mb-3">
              <Plane className="h-8 w-8 opacity-50" />
            </div>
            <p className="text-sm font-medium text-foreground">No aircraft found</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-sm text-primary hover:underline mt-2"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className={cn('p-3', compact ? 'space-y-1' : 'space-y-2')}>
            {filteredPositions.map((position, index) => (
              <div
                key={position.icao_hex}
                className="animate-slide-up"
                style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
              >
                <AircraftCard
                  position={position}
                  onClick={() => onAircraftClick?.(position)}
                  isSelected={position.icao_hex === selectedAircraftId}
                  compact={compact}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
