'use client';

import { FC } from 'react';
import { cn } from '@/lib/utils';
import { useQuickFilters } from '@/hooks/useDashboard';
import type { FilterCategory, SearchFilters } from '@/lib/types/dashboard';
import * as Icons from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface QuickFiltersProps {
  category?: FilterCategory;
  activeFilters?: SearchFilters;
  onFilterSelect?: (filters: SearchFilters) => void;
  className?: string;
}

const QuickFilters: FC<QuickFiltersProps> = ({
  category,
  activeFilters,
  onFilterSelect,
  className,
}) => {
  const { filters, loading } = useQuickFilters(category);

  const handleFilterClick = (filterFilters: SearchFilters) => {
    onFilterSelect?.(filterFilters);
  };

  const isActive = (filterFilters: SearchFilters): boolean => {
    if (!activeFilters) return false;
    return JSON.stringify(filterFilters) === JSON.stringify(activeFilters);
  };

  if (loading) {
    return (
      <div className={cn('flex gap-2 flex-wrap', className)}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-8 w-24 rounded-full bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2 flex-wrap', className)}>
      {filters.map((filter) => {
        const IconComponent = filter.icon
          ? (Icons[filter.icon as keyof typeof Icons] as LucideIcon)
          : null;

        return (
          <button
            key={filter.id}
            onClick={() => handleFilterClick(filter.filters)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              'border hover:bg-muted',
              isActive(filter.filters)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background'
            )}
            style={{
              borderColor: !isActive(filter.filters) && filter.color
                ? `${filter.color}40`
                : undefined,
            }}
          >
            {IconComponent && (
              <IconComponent
                className="h-3.5 w-3.5"
                style={{
                  color: !isActive(filter.filters) ? (filter.color ?? undefined) : undefined,
                }}
              />
            )}
            <span>{filter.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default QuickFilters;

// QuickFilters with categories
interface QuickFiltersCategorizedProps {
  activeFilters?: SearchFilters;
  onFilterSelect?: (filters: SearchFilters) => void;
  showCategories?: FilterCategory[];
  className?: string;
}

export const QuickFiltersCategorized: FC<QuickFiltersCategorizedProps> = ({
  activeFilters,
  onFilterSelect,
  showCategories = ['aircraft_type', 'threat_level', 'status'],
  className,
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {showCategories.includes('aircraft_type') && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            Aircraft Type
          </h4>
          <QuickFilters
            category="aircraft_type"
            activeFilters={activeFilters}
            onFilterSelect={onFilterSelect}
          />
        </div>
      )}

      {showCategories.includes('threat_level') && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            Threat Level
          </h4>
          <QuickFilters
            category="threat_level"
            activeFilters={activeFilters}
            onFilterSelect={onFilterSelect}
          />
        </div>
      )}

      {showCategories.includes('status') && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            Status
          </h4>
          <QuickFilters
            category="status"
            activeFilters={activeFilters}
            onFilterSelect={onFilterSelect}
          />
        </div>
      )}

      {showCategories.includes('region') && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            Region
          </h4>
          <QuickFilters
            category="region"
            activeFilters={activeFilters}
            onFilterSelect={onFilterSelect}
          />
        </div>
      )}
    </div>
  );
};
