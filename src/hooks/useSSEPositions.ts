'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PositionLatest } from '@/lib/types/aircraft';

export type SSEConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'polling';

interface UseSSEPositionsOptions {
  enabled?: boolean;
  interval?: number;
  fallbackToPolling?: boolean;
  pollingInterval?: number;
  onPositions?: (positions: PositionLatest[]) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: SSEConnectionStatus) => void;
}

interface UseSSEPositionsReturn {
  positions: PositionLatest[];
  status: SSEConnectionStatus;
  error: Error | null;
  lastUpdate: Date | null;
  reconnect: () => void;
}

export function useSSEPositions(options: UseSSEPositionsOptions = {}): UseSSEPositionsReturn {
  const {
    enabled = true,
    interval = 5000,
    fallbackToPolling = true,
    pollingInterval = 10000,
    onPositions,
    onError,
    onStatusChange,
  } = options;

  const [positions, setPositions] = useState<PositionLatest[]>([]);
  const [status, setStatus] = useState<SSEConnectionStatus>('disconnected');
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const updateStatus = useCallback((newStatus: SSEConnectionStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  const handlePositions = useCallback((newPositions: PositionLatest[]) => {
    setPositions(newPositions);
    setLastUpdate(new Date());
    setError(null);
    onPositions?.(newPositions);
  }, [onPositions]);

  const handleError = useCallback((err: Error) => {
    setError(err);
    onError?.(err);
  }, [onError]);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    updateStatus('polling');

    const poll = async () => {
      try {
        const response = await fetch('/api/positions?latest=true&limit=500');
        if (!response.ok) {
          throw new Error(`Polling failed: ${response.status}`);
        }
        const result = await response.json();
        if (result.success && result.data) {
          handlePositions(result.data);
        }
      } catch (err) {
        handleError(err instanceof Error ? err : new Error('Polling failed'));
      }
    };

    poll();
    pollingIntervalRef.current = setInterval(poll, pollingInterval);
  }, [pollingInterval, handlePositions, handleError, updateStatus]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    stopPolling();

    if (!enabled) {
      updateStatus('disconnected');
      return;
    }

    updateStatus('connecting');

    try {
      const url = `/api/sse/positions?interval=${interval}`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        updateStatus('connected');
        reconnectAttempts.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'positions' && parsed.data) {
            handlePositions(parsed.data);
          } else if (parsed.type === 'error') {
            handleError(new Error(parsed.message));
          }
        } catch (parseError) {
          console.error('Failed to parse SSE message:', parseError);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        eventSourceRef.current = null;

        reconnectAttempts.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);

        if (reconnectAttempts.current <= 3) {
          // Try to reconnect
          updateStatus('connecting');
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (fallbackToPolling) {
          // Fall back to polling
          console.log('SSE failed, falling back to polling');
          startPolling();
        } else {
          updateStatus('error');
          handleError(new Error('SSE connection failed'));
        }
      };
    } catch (err) {
      updateStatus('error');
      handleError(err instanceof Error ? err : new Error('Failed to create SSE connection'));

      if (fallbackToPolling) {
        startPolling();
      }
    }
  }, [enabled, interval, fallbackToPolling, handlePositions, handleError, updateStatus, startPolling, stopPolling]);

  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      stopPolling();
      updateStatus('disconnected');
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      stopPolling();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [enabled, connect, stopPolling, updateStatus]);

  return {
    positions,
    status,
    error,
    lastUpdate,
    reconnect,
  };
}
