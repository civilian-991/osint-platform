'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, Loader2, ChevronDown, Sparkles, SlidersHorizontal } from 'lucide-react';
import type { NewsEvent } from '@/lib/types/news';
import NewsCard from './NewsCard';
import { cn } from '@/lib/utils/cn';

interface NewsFeedProps {
  news: NewsEvent[];
  onNewsClick?: (news: NewsEvent) => void;
  selectedNewsId?: string;
  loading?: boolean;
  compact?: boolean;
}

const CREDIBILITY_OPTIONS = [
  { value: 'all', label: 'All', color: 'text-foreground' },
  { value: 'high', label: '80%+', color: 'text-green-400' },
  { value: 'medium', label: '60%+', color: 'text-amber-400' },
  { value: 'any', label: '40%+', color: 'text-orange-400' },
];

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All', icon: '◉' },
  { value: 'airstrike', label: 'Airstrikes', icon: '💥' },
  { value: 'aircraft', label: 'Aircraft', icon: '✈️' },
  { value: 'missile', label: 'Missiles', icon: '🚀' },
  { value: 'drone', label: 'Drones', icon: '🛸' },
  { value: 'surveillance', label: 'Intel', icon: '📡' },
  { value: 'deployment', label: 'Deploy', icon: '🎯' },
];

export default function NewsFeed({
  news,
  onNewsClick,
  selectedNewsId,
  loading = false,
  compact = false,
}: NewsFeedProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [credibilityFilter, setCredibilityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredNews = useMemo(() => {
    return news.filter((item) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesContent = item.content?.toLowerCase().includes(query);
        const matchesLocation = item.locations.some((l) =>
          l.name.toLowerCase().includes(query)
        );
        const matchesEntity = item.entities.some((e) =>
          e.name.toLowerCase().includes(query)
        );

        if (!matchesTitle && !matchesContent && !matchesLocation && !matchesEntity) {
          return false;
        }
      }

      // Credibility filter
      if (credibilityFilter !== 'all') {
        const minScore = {
          high: 0.8,
          medium: 0.6,
          any: 0.4,
        }[credibilityFilter] || 0;

        if (item.credibility_score < minScore) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== 'all') {
        if (!item.categories.includes(categoryFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [news, searchQuery, credibilityFilter, categoryFilter]);

  const activeFiltersCount = [
    credibilityFilter !== 'all',
    categoryFilter !== 'all',
    searchQuery !== '',
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full">
      {/* Search & Filters */}
      <div className="p-4 space-y-3 border-b border-border/50">
        {/* Search Bar */}
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground
                             transition-colors group-focus-within:text-primary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reports, entities, locations..."
            className="w-full pl-10 pr-4 py-2.5 bg-muted/30 border border-border/50 rounded-lg text-sm
                       placeholder:text-muted-foreground/60 transition-all duration-200
                       focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50
                       focus:bg-muted/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground
                         hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-all duration-200',
            showFilters
              ? 'bg-primary/10 border border-primary/30 text-primary'
              : 'bg-muted/30 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="font-medium">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-bold bg-primary text-primary-foreground rounded">
                {activeFiltersCount}
              </span>
            )}
          </div>
          <ChevronDown
            className={cn('h-4 w-4 transition-transform duration-200', showFilters && 'rotate-180')}
          />
        </button>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="space-y-4 pt-2 animate-in slide-in-from-top-2 duration-200">
            {/* Credibility */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                <Sparkles className="h-3 w-3" />
                Source Credibility
              </label>
              <div className="flex gap-1">
                {CREDIBILITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setCredibilityFilter(option.value)}
                    className={cn(
                      'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
                      credibilityFilter === option.value
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                <Filter className="h-3 w-3" />
                Category
              </label>
              <div className="flex flex-wrap gap-1">
                {CATEGORY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setCategoryFilter(option.value)}
                    className={cn(
                      'px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 flex items-center gap-1',
                      categoryFilter === option.value
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span className="text-[10px]">{option.icon}</span>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCredibilityFilter('all');
                  setCategoryFilter('all');
                }}
                className="w-full py-2 text-xs text-muted-foreground hover:text-destructive
                           border border-dashed border-border/50 rounded-md transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border/30 bg-muted/20">
        <span className="font-mono text-primary">{filteredNews.length}</span>
        <span className="ml-1">reports</span>
        {activeFiltersCount > 0 && (
          <span className="ml-1 text-muted-foreground/60">
            (filtered from {news.length})
          </span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
              <Loader2 className="h-10 w-10 animate-spin text-primary relative" />
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">
              Loading intelligence reports...
            </p>
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-6">
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 mb-4">
              <Search className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No reports found</p>
            <p className="text-xs text-muted-foreground mb-4">
              {searchQuery
                ? `No results for "${searchQuery}"`
                : 'Try adjusting your filters'}
            </p>
            {(searchQuery || activeFiltersCount > 0) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCredibilityFilter('all');
                  setCategoryFilter('all');
                }}
                className="text-sm text-primary hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {filteredNews.map((item, index) => (
              <div
                key={item.id}
                style={{
                  animationDelay: `${Math.min(index * 30, 300)}ms`,
                }}
                className="animate-in fade-in slide-in-from-left-2 duration-300"
              >
                <NewsCard
                  news={item}
                  onClick={() => onNewsClick?.(item)}
                  isSelected={item.id === selectedNewsId}
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
