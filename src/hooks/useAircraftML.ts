'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  AnomalyDetection,
  IntentClassification,
  ThreatAssessment,
  FormationDetection,
  BehavioralProfile,
} from '@/lib/types/ml';

interface AircraftMLData {
  anomalies: AnomalyDetection[];
  intent: IntentClassification | null;
  threat: ThreatAssessment | null;
  formations: FormationDetection[];
  profile: BehavioralProfile | null;
}

interface UseAircraftMLResult {
  data: AircraftMLData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useAircraftML(aircraftId: string | null): UseAircraftMLResult {
  const [data, setData] = useState<AircraftMLData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMLData = useCallback(async () => {
    if (!aircraftId) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/aircraft/${aircraftId}/ml`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch ML data');
      }
    } catch (err) {
      setError('Network error');
      console.error('Error fetching aircraft ML data:', err);
    } finally {
      setLoading(false);
    }
  }, [aircraftId]);

  useEffect(() => {
    fetchMLData();
  }, [fetchMLData]);

  return { data, loading, error, refresh: fetchMLData };
}

// Hook for fetching active formations
export function useFormations(activeOnly = true) {
  const [formations, setFormations] = useState<FormationDetection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFormations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/formations?active=${activeOnly}`);
      const result = await response.json();

      if (result.success) {
        setFormations(result.data);
      } else {
        setError(result.error || 'Failed to fetch formations');
      }
    } catch (err) {
      setError('Network error');
      console.error('Error fetching formations:', err);
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    fetchFormations();
    // Refresh every 30 seconds for active formations
    const interval = setInterval(fetchFormations, 30000);
    return () => clearInterval(interval);
  }, [fetchFormations]);

  return { formations, loading, error, refresh: fetchFormations };
}

// Hook for ML stats
export function useMLStats() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ml/stats');
      const result = await response.json();

      if (result.success) {
        setStats(result.data);
      } else {
        setError(result.error || 'Failed to fetch ML stats');
      }
    } catch (err) {
      setError('Network error');
      console.error('Error fetching ML stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Refresh every minute
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading, error, refresh: fetchStats };
}
