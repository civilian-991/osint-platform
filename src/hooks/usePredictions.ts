'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TrajectoryPrediction, ProximityWarning } from '@/lib/types/predictions';

interface UsePredictionsResult {
  predictions: TrajectoryPrediction[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePredictions(aircraftId: string | null): UsePredictionsResult {
  const [predictions, setPredictions] = useState<TrajectoryPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPredictions = useCallback(async () => {
    if (!aircraftId) {
      setPredictions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/predictions/trajectory?aircraftId=${encodeURIComponent(aircraftId)}`
      );
      const data = await response.json();

      if (data.success) {
        setPredictions(data.data || []);
      } else {
        setError(data.error || 'Failed to fetch predictions');
      }
    } catch (err) {
      setError('Failed to fetch predictions');
      console.error('Error fetching predictions:', err);
    } finally {
      setLoading(false);
    }
  }, [aircraftId]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  return {
    predictions,
    loading,
    error,
    refresh: fetchPredictions,
  };
}

interface UseProximityWarningsResult {
  warnings: ProximityWarning[];
  loading: boolean;
  error: string | null;
  acknowledge: (warningId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useProximityWarnings(
  aircraftId?: string | null,
  severity?: string
): UseProximityWarningsResult {
  const [warnings, setWarnings] = useState<ProximityWarning[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWarnings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (aircraftId) params.set('aircraftId', aircraftId);
      if (severity) params.set('severity', severity);

      const response = await fetch(
        `/api/predictions/proximity?${params.toString()}`
      );
      const data = await response.json();

      if (data.success) {
        setWarnings(data.data || []);
      } else {
        setError(data.error || 'Failed to fetch warnings');
      }
    } catch (err) {
      setError('Failed to fetch warnings');
      console.error('Error fetching warnings:', err);
    } finally {
      setLoading(false);
    }
  }, [aircraftId, severity]);

  useEffect(() => {
    fetchWarnings();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchWarnings, 30000);
    return () => clearInterval(interval);
  }, [fetchWarnings]);

  const acknowledge = useCallback(
    async (warningId: string): Promise<boolean> => {
      try {
        const response = await fetch('/api/predictions/proximity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'acknowledge',
            warning_id: warningId,
            user_id: 'current-user', // Would come from auth context
          }),
        });
        const data = await response.json();

        if (data.success) {
          // Update local state
          setWarnings((prev) =>
            prev.map((w) =>
              w.id === warningId
                ? { ...w, is_acknowledged: true, acknowledged_at: new Date().toISOString() }
                : w
            )
          );
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error acknowledging warning:', err);
        return false;
      }
    },
    []
  );

  return {
    warnings,
    loading,
    error,
    acknowledge,
    refresh: fetchWarnings,
  };
}
