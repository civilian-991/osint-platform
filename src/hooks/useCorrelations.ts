'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CorrelationWithRelations, CorrelationStatus } from '@/lib/types/correlation';

interface UseCorrelationsOptions {
  status?: CorrelationStatus | 'all';
  minConfidence?: number;
  refreshInterval?: number;
}

interface UseCorrelationsReturn {
  correlations: CorrelationWithRelations[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  updateStatus: (id: string, status: CorrelationStatus, notes?: string) => Promise<void>;
}

export function useCorrelations(
  options: UseCorrelationsOptions = {}
): UseCorrelationsReturn {
  const { status = 'all', minConfidence, refreshInterval = 60000 } = options;

  const [correlations, setCorrelations] = useState<CorrelationWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCorrelations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (minConfidence) params.set('minConfidence', minConfidence.toString());

      const response = await fetch(`/api/correlations?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch correlations: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setCorrelations(result.data || []);
        setError(null);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [status, minConfidence]);

  const updateStatus = useCallback(
    async (id: string, newStatus: CorrelationStatus, notes?: string) => {
      try {
        const response = await fetch('/api/correlations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            status: newStatus,
            notes,
            verified: newStatus === 'verified',
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update correlation: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          // Update local state
          setCorrelations((prev) =>
            prev.map((c) =>
              c.id === id ? { ...c, status: newStatus, notes: notes || c.notes } : c
            )
          );
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      }
    },
    []
  );

  // Initial fetch
  useEffect(() => {
    fetchCorrelations();
  }, [fetchCorrelations]);

  // Refresh interval
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(fetchCorrelations, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchCorrelations, refreshInterval]);

  return {
    correlations,
    loading,
    error,
    refresh: fetchCorrelations,
    updateStatus,
  };
}
