'use client';

import { Calendar, Radio } from 'lucide-react';

export type CategoryFilter = 'all' | 'strat' | 'recon' | 'tank' | 'cargo' | 'oth';

interface CategoryTabsProps {
  activeCategory: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  onHistoryClick?: () => void;
  isLive: boolean;
}

const CATEGORIES: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'strat', label: 'STRAT' },
  { id: 'recon', label: 'RECON' },
  { id: 'tank', label: 'TANK' },
  { id: 'cargo', label: 'CARGO' },
  { id: 'oth', label: 'OTH' },
];

export function CategoryTabs({
  activeCategory,
  onCategoryChange,
  onHistoryClick,
  isLive,
}: CategoryTabsProps) {
  return (
    <div className="category-tabs-container">
      <div className="category-tabs-history">
        <span className="history-label">HISTORY:</span>
        <input
          type="date"
          className="history-date-input"
          onChange={(e) => {
            if (e.target.value && onHistoryClick) {
              onHistoryClick();
            }
          }}
        />
        <button
          className={`live-button ${isLive ? 'active' : ''}`}
          onClick={() => onCategoryChange('all')}
        >
          <Radio className="w-3 h-3" />
          LIVE
        </button>
      </div>

      <div className="category-tabs">
        {CATEGORIES.map(({ id, label }) => (
          <button
            key={id}
            className={`category-tab ${activeCategory === id ? 'active' : ''}`}
            onClick={() => onCategoryChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
