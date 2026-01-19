'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  SavedSearch,
  SavedSearchInput,
  DashboardLayout,
  WidgetLayout,
  QuickFilterPreset,
  FilterCategory,
} from '@/lib/types/dashboard';
import { getDefaultLayout } from '@/lib/types/dashboard';

// ============================================
// SAVED SEARCHES
// ============================================

interface UseSavedSearchesResult {
  searches: SavedSearch[];
  loading: boolean;
  error: string | null;
  create: (input: SavedSearchInput) => Promise<SavedSearch | null>;
  update: (id: string, updates: Partial<SavedSearchInput>) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useSavedSearches(folder?: string): UseSavedSearchesResult {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSearches = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (folder) params.set('folder', folder);

      const response = await fetch(`/api/saved-searches?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setSearches(data.data || []);
      } else {
        setError(data.error || 'Failed to fetch searches');
      }
    } catch (err) {
      setError('Failed to fetch searches');
      console.error('Error fetching searches:', err);
    } finally {
      setLoading(false);
    }
  }, [folder]);

  useEffect(() => {
    fetchSearches();
  }, [fetchSearches]);

  const create = useCallback(
    async (input: SavedSearchInput): Promise<SavedSearch | null> => {
      try {
        const response = await fetch('/api/saved-searches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const data = await response.json();

        if (data.success) {
          setSearches((prev) => [data.data, ...prev]);
          return data.data;
        }
        return null;
      } catch (err) {
        console.error('Error creating search:', err);
        return null;
      }
    },
    []
  );

  const update = useCallback(
    async (id: string, updates: Partial<SavedSearchInput>): Promise<boolean> => {
      try {
        const response = await fetch('/api/saved-searches', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...updates }),
        });
        const data = await response.json();

        if (data.success) {
          setSearches((prev) =>
            prev.map((s) => (s.id === id ? { ...s, ...data.data } : s))
          );
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error updating search:', err);
        return false;
      }
    },
    []
  );

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/saved-searches?id=${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        setSearches((prev) => prev.filter((s) => s.id !== id));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error deleting search:', err);
      return false;
    }
  }, []);

  return {
    searches,
    loading,
    error,
    create,
    update,
    remove,
    refresh: fetchSearches,
  };
}

// ============================================
// DASHBOARD LAYOUT
// ============================================

interface UseDashboardLayoutResult {
  layout: WidgetLayout[];
  loading: boolean;
  error: string | null;
  updateLayout: (layout: WidgetLayout[]) => Promise<boolean>;
  resetToDefault: () => void;
}

export function useDashboardLayout(): UseDashboardLayoutResult {
  const [layout, setLayout] = useState<WidgetLayout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLayout = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/dashboard/layout');
      const data = await response.json();

      if (data.success) {
        if (data.data.is_default) {
          setLayout(getDefaultLayout());
        } else {
          setLayout(data.data.layout || []);
        }
      } else {
        // Fall back to default layout
        setLayout(getDefaultLayout());
      }
    } catch (err) {
      console.error('Error fetching layout:', err);
      setLayout(getDefaultLayout());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLayout();
  }, [fetchLayout]);

  const updateLayout = useCallback(
    async (newLayout: WidgetLayout[]): Promise<boolean> => {
      setLayout(newLayout);

      try {
        const response = await fetch('/api/dashboard/layout', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout: newLayout }),
        });
        const data = await response.json();
        return data.success;
      } catch (err) {
        console.error('Error updating layout:', err);
        return false;
      }
    },
    []
  );

  const resetToDefault = useCallback(() => {
    setLayout(getDefaultLayout());
  }, []);

  return {
    layout,
    loading,
    error,
    updateLayout,
    resetToDefault,
  };
}

// ============================================
// QUICK FILTERS
// ============================================

interface UseQuickFiltersResult {
  filters: QuickFilterPreset[];
  loading: boolean;
  error: string | null;
  create: (input: Omit<QuickFilterPreset, 'id' | 'user_id' | 'use_count' | 'created_at' | 'updated_at'>) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useQuickFilters(category?: FilterCategory): UseQuickFiltersResult {
  const [filters, setFilters] = useState<QuickFilterPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFilters = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);

      const response = await fetch(`/api/quick-filters?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setFilters(data.data || []);
      } else {
        setError(data.error || 'Failed to fetch filters');
      }
    } catch (err) {
      setError('Failed to fetch filters');
      console.error('Error fetching filters:', err);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  const create = useCallback(
    async (input: Omit<QuickFilterPreset, 'id' | 'user_id' | 'use_count' | 'created_at' | 'updated_at'>): Promise<boolean> => {
      try {
        const response = await fetch('/api/quick-filters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const data = await response.json();

        if (data.success) {
          setFilters((prev) => [...prev, data.data]);
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error creating filter:', err);
        return false;
      }
    },
    []
  );

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/quick-filters?id=${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        setFilters((prev) => prev.filter((f) => f.id !== id));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error deleting filter:', err);
      return false;
    }
  }, []);

  return {
    filters,
    loading,
    error,
    create,
    remove,
    refresh: fetchFilters,
  };
}
