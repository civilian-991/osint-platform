'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  Watchlist,
  WatchlistWithItems,
  WatchlistItem,
  CreateWatchlistInput,
  UpdateWatchlistInput,
  CreateWatchlistItemInput,
  UpdateWatchlistItemInput,
} from '@/lib/types/watchlist';

interface UseWatchlistsOptions {
  includeItems?: boolean;
  activeOnly?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseWatchlistsReturn {
  watchlists: WatchlistWithItems[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  createWatchlist: (input: CreateWatchlistInput) => Promise<Watchlist>;
  updateWatchlist: (id: string, input: UpdateWatchlistInput) => Promise<Watchlist>;
  deleteWatchlist: (id: string) => Promise<void>;
  addItem: (watchlistId: string, input: CreateWatchlistItemInput) => Promise<WatchlistItem>;
  updateItem: (watchlistId: string, itemId: string, input: UpdateWatchlistItemInput) => Promise<WatchlistItem>;
  deleteItem: (watchlistId: string, itemId: string) => Promise<void>;
}

export function useWatchlists(options: UseWatchlistsOptions = {}): UseWatchlistsReturn {
  const {
    includeItems = true,
    activeOnly = false,
    autoRefresh = false,
    refreshInterval = 60000,
  } = options;

  const [watchlists, setWatchlists] = useState<WatchlistWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWatchlists = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (includeItems) params.set('includeItems', 'true');
      if (activeOnly) params.set('activeOnly', 'true');

      const response = await fetch(`/api/watchlists?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch watchlists: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setWatchlists(result.data || []);
        setError(null);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [includeItems, activeOnly]);

  const createWatchlist = useCallback(async (input: CreateWatchlistInput): Promise<Watchlist> => {
    const response = await fetch('/api/watchlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to create watchlist');
    }

    await fetchWatchlists();
    return result.data;
  }, [fetchWatchlists]);

  const updateWatchlist = useCallback(async (id: string, input: UpdateWatchlistInput): Promise<Watchlist> => {
    const response = await fetch(`/api/watchlists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to update watchlist');
    }

    await fetchWatchlists();
    return result.data;
  }, [fetchWatchlists]);

  const deleteWatchlist = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`/api/watchlists/${id}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete watchlist');
    }

    await fetchWatchlists();
  }, [fetchWatchlists]);

  const addItem = useCallback(async (
    watchlistId: string,
    input: CreateWatchlistItemInput
  ): Promise<WatchlistItem> => {
    const response = await fetch(`/api/watchlists/${watchlistId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to add item');
    }

    await fetchWatchlists();
    return result.data;
  }, [fetchWatchlists]);

  const updateItem = useCallback(async (
    watchlistId: string,
    itemId: string,
    input: UpdateWatchlistItemInput
  ): Promise<WatchlistItem> => {
    const response = await fetch(`/api/watchlists/${watchlistId}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to update item');
    }

    await fetchWatchlists();
    return result.data;
  }, [fetchWatchlists]);

  const deleteItem = useCallback(async (watchlistId: string, itemId: string): Promise<void> => {
    const response = await fetch(`/api/watchlists/${watchlistId}/items/${itemId}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete item');
    }

    await fetchWatchlists();
  }, [fetchWatchlists]);

  // Initial fetch
  useEffect(() => {
    fetchWatchlists();
  }, [fetchWatchlists]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const interval = setInterval(fetchWatchlists, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchWatchlists, refreshInterval]);

  return {
    watchlists,
    loading,
    error,
    refresh: fetchWatchlists,
    createWatchlist,
    updateWatchlist,
    deleteWatchlist,
    addItem,
    updateItem,
    deleteItem,
  };
}
