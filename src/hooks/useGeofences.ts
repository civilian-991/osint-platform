'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  GeofenceWithStats,
  GeofenceAlertWithGeofence,
  CreateGeofenceRequest,
  UpdateGeofenceRequest,
} from '@/lib/types/geofence';

interface UseGeofencesOptions {
  includeAlerts?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseGeofencesReturn {
  geofences: GeofenceWithStats[];
  alerts: GeofenceAlertWithGeofence[];
  unreadAlertCount: number;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  createGeofence: (input: CreateGeofenceRequest) => Promise<GeofenceWithStats>;
  updateGeofence: (id: string, input: UpdateGeofenceRequest) => Promise<GeofenceWithStats>;
  deleteGeofence: (id: string) => Promise<void>;
  markAlertRead: (alertId: string) => Promise<void>;
  markAllAlertsRead: () => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
}

export function useGeofences(options: UseGeofencesOptions = {}): UseGeofencesReturn {
  const {
    includeAlerts = true,
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds default for real-time updates
  } = options;

  const [geofences, setGeofences] = useState<GeofenceWithStats[]>([]);
  const [alerts, setAlerts] = useState<GeofenceAlertWithGeofence[]>([]);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchGeofences = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (includeAlerts) params.set('includeAlerts', 'true');

      const response = await fetch(`/api/geofences?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch geofences: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setGeofences(result.data || []);
        if (result.alerts) {
          setAlerts(result.alerts || []);
          setUnreadAlertCount(result.unread_alerts || 0);
        }
        setError(null);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [includeAlerts]);

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch('/api/geofences/alerts?limit=50');

      if (!response.ok) {
        throw new Error(`Failed to fetch alerts: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setAlerts(result.data || []);
        setUnreadAlertCount(result.unread_count || 0);
      }
    } catch (err) {
      console.error('Error fetching geofence alerts:', err);
    }
  }, []);

  const createGeofence = useCallback(async (input: CreateGeofenceRequest): Promise<GeofenceWithStats> => {
    const response = await fetch('/api/geofences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Failed to create geofence: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to create geofence');
    }

    await fetchGeofences();
    return result.data;
  }, [fetchGeofences]);

  const updateGeofence = useCallback(async (id: string, input: UpdateGeofenceRequest): Promise<GeofenceWithStats> => {
    const response = await fetch(`/api/geofences/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Failed to update geofence: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to update geofence');
    }

    await fetchGeofences();
    return result.data;
  }, [fetchGeofences]);

  const deleteGeofence = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`/api/geofences/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete geofence: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete geofence');
    }

    await fetchGeofences();
  }, [fetchGeofences]);

  const markAlertRead = useCallback(async (alertId: string): Promise<void> => {
    const response = await fetch('/api/geofences/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', alertId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to mark alert as read: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to mark alert as read');
    }

    await fetchAlerts();
  }, [fetchAlerts]);

  const markAllAlertsRead = useCallback(async (): Promise<void> => {
    const response = await fetch('/api/geofences/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_all_read' }),
    });

    if (!response.ok) {
      throw new Error(`Failed to mark all alerts as read: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to mark all alerts as read');
    }

    await fetchAlerts();
  }, [fetchAlerts]);

  const dismissAlert = useCallback(async (alertId: string): Promise<void> => {
    const response = await fetch('/api/geofences/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss', alertId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to dismiss alert: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to dismiss alert');
    }

    await fetchAlerts();
  }, [fetchAlerts]);

  // Initial fetch
  useEffect(() => {
    fetchGeofences();
  }, [fetchGeofences]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      fetchGeofences();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchGeofences, refreshInterval]);

  return {
    geofences,
    alerts,
    unreadAlertCount,
    loading,
    error,
    refresh: fetchGeofences,
    createGeofence,
    updateGeofence,
    deleteGeofence,
    markAlertRead,
    markAllAlertsRead,
    dismissAlert,
  };
}

// Hook for managing a single geofence
interface UseGeofenceOptions {
  includeAircraft?: boolean;
  includeAlerts?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseGeofenceReturn {
  geofence: GeofenceWithStats | null;
  aircraft: unknown[];
  alerts: GeofenceAlertWithGeofence[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  update: (input: UpdateGeofenceRequest) => Promise<void>;
  remove: () => Promise<void>;
}

export function useGeofence(id: string | null, options: UseGeofenceOptions = {}): UseGeofenceReturn {
  const {
    includeAircraft = true,
    includeAlerts = true,
    autoRefresh = true,
    refreshInterval = 30000,
  } = options;

  const [geofence, setGeofence] = useState<GeofenceWithStats | null>(null);
  const [aircraft, setAircraft] = useState<unknown[]>([]);
  const [alerts, setAlerts] = useState<GeofenceAlertWithGeofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchGeofence = useCallback(async () => {
    if (!id) {
      setGeofence(null);
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (includeAircraft) params.set('includeAircraft', 'true');
      if (includeAlerts) params.set('includeAlerts', 'true');

      const response = await fetch(`/api/geofences/${id}?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 404) {
          setGeofence(null);
          setError(new Error('Geofence not found'));
          return;
        }
        throw new Error(`Failed to fetch geofence: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setGeofence(result.data);
        if (result.aircraft_inside) {
          setAircraft(result.aircraft_inside);
        }
        if (result.alerts) {
          setAlerts(result.alerts);
        }
        setError(null);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [id, includeAircraft, includeAlerts]);

  const update = useCallback(async (input: UpdateGeofenceRequest): Promise<void> => {
    if (!id) throw new Error('No geofence ID');

    const response = await fetch(`/api/geofences/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Failed to update geofence: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to update geofence');
    }

    await fetchGeofence();
  }, [id, fetchGeofence]);

  const remove = useCallback(async (): Promise<void> => {
    if (!id) throw new Error('No geofence ID');

    const response = await fetch(`/api/geofences/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete geofence: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete geofence');
    }

    setGeofence(null);
  }, [id]);

  // Initial fetch
  useEffect(() => {
    fetchGeofence();
  }, [fetchGeofence]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0 || !id) return;

    const interval = setInterval(fetchGeofence, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchGeofence, refreshInterval, id]);

  return {
    geofence,
    aircraft,
    alerts,
    loading,
    error,
    refresh: fetchGeofence,
    update,
    remove,
  };
}
