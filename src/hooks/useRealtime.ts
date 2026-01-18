'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface UsePollingOptions<T> {
  fetchFn: () => Promise<T[]>;
  interval?: number;
  enabled?: boolean;
  onData?: (data: T[]) => void;
  compareKey?: keyof T;
}

interface UsePollingReturn<T> {
  data: T[];
  isConnected: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePolling<T>({
  fetchFn,
  interval = 5000,
  enabled = true,
  onData,
  compareKey,
}: UsePollingOptions<T>): UsePollingReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const previousDataRef = useRef<T[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const newData = await fetchFn();
      setData(newData);
      setIsConnected(true);
      setError(null);

      // Check for new items if compareKey is provided
      if (compareKey && onData) {
        const previousKeys = new Set(
          previousDataRef.current.map((item) => item[compareKey])
        );
        const newItems = newData.filter(
          (item) => !previousKeys.has(item[compareKey])
        );
        if (newItems.length > 0) {
          onData(newItems);
        }
      } else if (onData) {
        onData(newData);
      }

      previousDataRef.current = newData;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fetch error'));
      setIsConnected(false);
    }
  }, [fetchFn, onData, compareKey]);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchData();

    // Set up polling interval
    const intervalId = setInterval(fetchData, interval);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, interval, fetchData]);

  return { data, isConnected, error, refetch: fetchData };
}

// Hook to simulate realtime positions using polling
export function useRealtimePositions(
  onPositionUpdate?: (positions: Record<string, unknown>[]) => void
) {
  const fetchPositions = useCallback(async () => {
    const response = await fetch('/api/positions?latest=true&limit=100');
    const result = await response.json();
    return result.success ? result.data : [];
  }, []);

  return usePolling({
    fetchFn: fetchPositions,
    interval: 5000, // Poll every 5 seconds
    enabled: true,
    onData: onPositionUpdate,
    compareKey: 'id' as never,
  });
}

// Hook to simulate realtime alerts using polling
export function useRealtimeAlerts(
  onNewAlert?: (alerts: Record<string, unknown>[]) => void
) {
  const fetchAlerts = useCallback(async () => {
    const response = await fetch('/api/alerts?status=active&limit=20');
    const result = await response.json();
    return result.success ? result.data : [];
  }, []);

  return usePolling({
    fetchFn: fetchAlerts,
    interval: 10000, // Poll every 10 seconds
    enabled: true,
    onData: onNewAlert,
    compareKey: 'id' as never,
  });
}

// Legacy hook for backwards compatibility
type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeOptions<T> {
  table: string;
  event?: RealtimeEvent;
  filter?: string;
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: { old_record: T }) => void;
}

interface UseRealtimeReturn {
  isConnected: boolean;
  error: Error | null;
}

export function useRealtime<T>(options: UseRealtimeOptions<T>): UseRealtimeReturn {
  const { table, onInsert, onUpdate } = options;

  const fetchData = useCallback(async () => {
    // Map table to API endpoint
    const endpoints: Record<string, string> = {
      positions_latest: '/api/positions?latest=true&limit=100',
      alerts: '/api/alerts?status=active&limit=20',
      aircraft: '/api/aircraft?limit=100',
      news_events: '/api/news?limit=50',
      correlations: '/api/correlations?limit=50',
    };

    const endpoint = endpoints[table] || `/api/${table}`;
    const response = await fetch(endpoint);
    const result = await response.json();
    return result.success ? result.data : [];
  }, [table]);

  const handleData = useCallback(
    (data: T[]) => {
      data.forEach((item) => {
        onInsert?.(item);
        onUpdate?.(item);
      });
    },
    [onInsert, onUpdate]
  );

  const { isConnected, error } = usePolling({
    fetchFn: fetchData,
    interval: 5000,
    enabled: true,
    onData: handleData,
  });

  return { isConnected, error };
}
