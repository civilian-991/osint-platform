'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TrendData, TrendPeriod, MetricScope } from '@/lib/types/dashboard';

interface UseTrendsResult {
  trends: TrendData[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTrends(
  metrics: string[],
  period: TrendPeriod = '7d',
  scope: MetricScope = 'global',
  scopeValue?: string
): UseTrendsResult {
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    if (metrics.length === 0) {
      setTrends([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('metrics', metrics.join(','));
      params.set('period', period);
      params.set('scope', scope);
      if (scopeValue) params.set('scopeValue', scopeValue);

      const response = await fetch(`/api/metrics/trends?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setTrends(data.data || []);
      } else {
        setError(data.error || 'Failed to fetch trends');
      }
    } catch (err) {
      setError('Failed to fetch trends');
      console.error('Error fetching trends:', err);
    } finally {
      setLoading(false);
    }
  }, [metrics.join(','), period, scope, scopeValue]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  return {
    trends,
    loading,
    error,
    refresh: fetchTrends,
  };
}

// Hook for getting comparison metrics (current vs previous period)
interface UseComparisonMetricsResult {
  current: Record<string, number>;
  previous: Record<string, number>;
  changes: Record<string, number>;
  loading: boolean;
  error: string | null;
}

export function useComparisonMetrics(
  period: TrendPeriod = '7d'
): UseComparisonMetricsResult {
  const metrics = [
    'total_aircraft',
    'unique_aircraft',
    'formations_detected',
    'anomalies_detected',
    'alerts_generated',
  ];

  const { trends, loading, error } = useTrends(metrics, period);

  const current: Record<string, number> = {};
  const previous: Record<string, number> = {};
  const changes: Record<string, number> = {};

  for (const trend of trends) {
    current[trend.metric] = trend.current_value;
    previous[trend.metric] = trend.previous_value;
    changes[trend.metric] = trend.change_percent;
  }

  return {
    current,
    previous,
    changes,
    loading,
    error,
  };
}
