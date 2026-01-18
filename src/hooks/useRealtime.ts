'use client';

import { useEffect, useState } from 'react';
import { getClient } from '@/lib/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

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
  const { table, event = '*', filter, onInsert, onUpdate, onDelete } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const subscribe = async () => {
      try {
        const supabase = getClient();

        // Build channel config
        const channelConfig: {
          event: RealtimeEvent;
          schema: string;
          table: string;
          filter?: string;
        } = {
          event,
          schema: 'public',
          table,
        };

        if (filter) {
          channelConfig.filter = filter;
        }

        channel = supabase
          .channel(`${table}-changes`)
          .on(
            'postgres_changes',
            channelConfig,
            (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
              switch (payload.eventType) {
                case 'INSERT':
                  onInsert?.(payload.new as T);
                  break;
                case 'UPDATE':
                  onUpdate?.(payload.new as T);
                  break;
                case 'DELETE':
                  onDelete?.({ old_record: payload.old as T });
                  break;
              }
            }
          )
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
              setError(null);
            } else if (status === 'CHANNEL_ERROR') {
              setError(new Error('Failed to subscribe to realtime channel'));
              setIsConnected(false);
            }
          });
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Subscription error'));
        setIsConnected(false);
      }
    };

    subscribe();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [table, event, filter, onInsert, onUpdate, onDelete]);

  return { isConnected, error };
}

// Specialized hook for positions
export function useRealtimePositions(
  onPositionUpdate: (position: Record<string, unknown>) => void
) {
  return useRealtime({
    table: 'positions_latest',
    event: '*',
    onInsert: onPositionUpdate,
    onUpdate: onPositionUpdate,
  });
}

// Specialized hook for alerts
export function useRealtimeAlerts(
  onNewAlert: (alert: Record<string, unknown>) => void
) {
  return useRealtime({
    table: 'alerts',
    event: 'INSERT',
    onInsert: onNewAlert,
  });
}
