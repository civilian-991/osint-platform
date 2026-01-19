'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  NetworkGraph,
  NetworkGraphParams,
  AircraftRelationship,
  AircraftCooccurrence,
  CentralityMetrics,
} from '@/lib/types/network';

interface UseNetworkGraphResult {
  graph: NetworkGraph | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useNetworkGraph(params: NetworkGraphParams = {}): UseNetworkGraphResult {
  const [graph, setGraph] = useState<NetworkGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (params.scope) queryParams.set('scope', params.scope);
      if (params.operator_id) queryParams.set('operatorId', params.operator_id);
      if (params.region) queryParams.set('region', params.region);
      if (params.min_cooccurrence)
        queryParams.set('minCooccurrence', String(params.min_cooccurrence));
      if (params.max_nodes)
        queryParams.set('maxNodes', String(params.max_nodes));

      const response = await fetch(`/api/network/graph?${queryParams.toString()}`);
      const data = await response.json();

      if (data.success) {
        setGraph(data.data);
      } else {
        setError(data.error || 'Failed to fetch graph');
      }
    } catch (err) {
      setError('Failed to fetch graph');
      console.error('Error fetching graph:', err);
    } finally {
      setLoading(false);
    }
  }, [params.scope, params.operator_id, params.region, params.min_cooccurrence, params.max_nodes]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  return {
    graph,
    loading,
    error,
    refresh: fetchGraph,
  };
}

interface UseAircraftNetworkResult {
  graph: NetworkGraph | null;
  centrality: CentralityMetrics | null;
  relationships: AircraftRelationship[];
  cooccurrences: AircraftCooccurrence[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAircraftNetwork(
  aircraftId: string | null
): UseAircraftNetworkResult {
  const [graph, setGraph] = useState<NetworkGraph | null>(null);
  const [centrality, setCentrality] = useState<CentralityMetrics | null>(null);
  const [relationships, setRelationships] = useState<AircraftRelationship[]>([]);
  const [cooccurrences, setCooccurrences] = useState<AircraftCooccurrence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNetwork = useCallback(async () => {
    if (!aircraftId) {
      setGraph(null);
      setCentrality(null);
      setRelationships([]);
      setCooccurrences([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/network/graph/aircraft/${aircraftId}`);
      const data = await response.json();

      if (data.success) {
        setGraph(data.data.graph);
        setCentrality(data.data.centrality);
        setRelationships(data.data.relationships || []);
        setCooccurrences(data.data.cooccurrences || []);
      } else {
        setError(data.error || 'Failed to fetch network');
      }
    } catch (err) {
      setError('Failed to fetch network');
      console.error('Error fetching network:', err);
    } finally {
      setLoading(false);
    }
  }, [aircraftId]);

  useEffect(() => {
    fetchNetwork();
  }, [fetchNetwork]);

  return {
    graph,
    centrality,
    relationships,
    cooccurrences,
    loading,
    error,
    refresh: fetchNetwork,
  };
}
