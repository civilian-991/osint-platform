'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, Newspaper, Loader2, ChevronDown } from 'lucide-react';
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
  { value: 'all', label: 'All Sources' },
  { value: 'high', label: 'High (80%+)' },
  { value: 'medium', label: 'Medium (60%+)' },
  { value: 'any', label: 'Any (40%+)' },
];

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'airstrike', label: 'Airstrikes' },
  { value: 'aircraft', label: 'Aircraft' },
  { value: 'missile', label: 'Missiles' },
  { value: 'drone', label: 'Drones' },
  { value: 'surveillance', label: 'Surveillance' },
  { value: 'deployment', label: 'Deployment' },
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Newspaper className="h-5 w-5" />
            News Feed
            <span className="text-muted-foreground font-normal">
              ({filteredNews.length})
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
            placeholder="Search news..."
            className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="pt-2 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Credibility
              </label>
              <div className="flex flex-wrap gap-1">
                {CREDIBILITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setCredibilityFilter(option.value)}
                    className={cn(
                      'px-2 py-1 rounded text-xs transition-colors',
                      credibilityFilter === option.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Category
              </label>
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
                  </button>
                ))}
              </div>
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
        ) : filteredNews.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Newspaper className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">No news found</p>
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
          <div className={cn('p-4', compact ? 'space-y-2' : 'space-y-4')}>
            {filteredNews.map((item) => (
              <NewsCard
                key={item.id}
                news={item}
                onClick={() => onNewsClick?.(item)}
                isSelected={item.id === selectedNewsId}
                compact={compact}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
