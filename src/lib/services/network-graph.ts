import { query, queryOne } from '@/lib/db';
import type {
  NetworkGraph,
  NetworkNode,
  NetworkEdge,
  NetworkMetadata,
  NetworkGraphParams,
  NetworkScope,
  NetworkAnalysisResult,
  CentralityMetrics,
  CommunityResult,
  RelationshipType,
} from '@/lib/types/network';
import type { AircraftCooccurrence, AircraftRelationship } from '@/lib/types/network';

// Configuration
const CONFIG = {
  defaultMaxNodes: 100,
  minEdgeWeight: 0.1,
  layoutIterations: 50,
  // Color palette for communities
  communityColors: [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
  ],
};

export class NetworkGraphService {
  /**
   * Generate network graph from relationships and co-occurrences
   */
  async generateNetworkGraph(
    params: NetworkGraphParams = {}
  ): Promise<NetworkGraph> {
    const scope = params.scope || 'global';
    const maxNodes = params.max_nodes || CONFIG.defaultMaxNodes;
    const minCooccurrence = params.min_cooccurrence || 2;

    try {
      // Get nodes (aircraft)
      const nodes = await this.getNodes(params, maxNodes);

      if (nodes.length === 0) {
        return this.getEmptyGraph(scope);
      }

      const nodeIds = nodes.map((n) => n.id);

      // Get edges (relationships and co-occurrences)
      const edges = await this.getEdges(nodeIds, minCooccurrence);

      // Calculate node metrics
      const nodeMetrics = this.calculateNodeMetrics(nodes, edges);

      // Apply metrics to nodes
      const enrichedNodes = nodes.map((node) => ({
        ...node,
        degree: nodeMetrics.get(node.id)?.degree || 0,
        centrality: nodeMetrics.get(node.id)?.centrality || 0,
        size: Math.max(5, Math.min(20, 5 + (nodeMetrics.get(node.id)?.degree || 0) * 2)),
      }));

      // Generate metadata
      const metadata: NetworkMetadata = {
        node_count: enrichedNodes.length,
        edge_count: edges.length,
        density: this.calculateDensity(enrichedNodes.length, edges.length),
        avg_degree: this.calculateAvgDegree(enrichedNodes),
        generated_at: new Date().toISOString(),
        scope,
      };

      return {
        nodes: enrichedNodes,
        edges,
        metadata,
      };
    } catch (error) {
      console.error('Error generating network graph:', error);
      return this.getEmptyGraph(scope);
    }
  }

  /**
   * Get nodes for the graph
   */
  private async getNodes(
    params: NetworkGraphParams,
    maxNodes: number
  ): Promise<NetworkNode[]> {
    let whereClause = 'WHERE a.is_military = true';
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    // Apply scope filters
    if (params.aircraft_id) {
      // Ego network - get aircraft and its connections
      return await this.getEgoNetworkNodes(params.aircraft_id, maxNodes);
    }

    if (params.operator_id) {
      whereClause += ` AND a.operator_id = $${paramIndex}`;
      queryParams.push(params.operator_id);
      paramIndex++;
    }

    if (params.region) {
      // Would need region filtering logic
    }

    // Get aircraft that have co-occurrences
    const results = await query<{
      id: string;
      icao_hex: string;
      type_code: string | null;
      military_category: string | null;
      callsign: string | null;
      cooccurrence_score: number;
    }>(
      `SELECT DISTINCT
         a.id,
         a.icao_hex,
         a.type_code,
         a.military_category,
         pl.callsign,
         COALESCE(
           (SELECT SUM(weighted_score) FROM aircraft_cooccurrences
            WHERE aircraft_id_1 = a.id OR aircraft_id_2 = a.id),
           0
         ) as cooccurrence_score
       FROM aircraft a
       LEFT JOIN positions_latest pl ON pl.aircraft_id = a.id
       ${whereClause}
       HAVING COALESCE(
         (SELECT SUM(weighted_score) FROM aircraft_cooccurrences
          WHERE aircraft_id_1 = a.id OR aircraft_id_2 = a.id),
         0
       ) > 0
       ORDER BY cooccurrence_score DESC
       LIMIT $${paramIndex}`,
      [...queryParams, maxNodes]
    );

    return results.map((r) => ({
      id: r.id,
      type: 'aircraft' as const,
      icao_hex: r.icao_hex,
      aircraft_id: r.id,
      label: r.callsign || r.icao_hex,
      aircraft_type: r.type_code || undefined,
      military_category: r.military_category || undefined,
      degree: 0,
    }));
  }

  /**
   * Get nodes for ego network (single aircraft's connections)
   */
  private async getEgoNetworkNodes(
    aircraftId: string,
    maxNodes: number
  ): Promise<NetworkNode[]> {
    // Get the central aircraft
    const central = await queryOne<{
      id: string;
      icao_hex: string;
      type_code: string | null;
      military_category: string | null;
      callsign: string | null;
    }>(
      `SELECT a.id, a.icao_hex, a.type_code, a.military_category, pl.callsign
       FROM aircraft a
       LEFT JOIN positions_latest pl ON pl.aircraft_id = a.id
       WHERE a.id = $1`,
      [aircraftId]
    );

    if (!central) return [];

    // Get connected aircraft
    const connected = await query<{
      id: string;
      icao_hex: string;
      type_code: string | null;
      military_category: string | null;
      callsign: string | null;
      score: number;
    }>(
      `SELECT DISTINCT
         a.id, a.icao_hex, a.type_code, a.military_category, pl.callsign,
         c.weighted_score as score
       FROM aircraft_cooccurrences c
       JOIN aircraft a ON (
         (c.aircraft_id_1 = $1 AND c.aircraft_id_2 = a.id) OR
         (c.aircraft_id_2 = $1 AND c.aircraft_id_1 = a.id)
       )
       LEFT JOIN positions_latest pl ON pl.aircraft_id = a.id
       ORDER BY c.weighted_score DESC
       LIMIT $2`,
      [aircraftId, maxNodes - 1]
    );

    const nodes: NetworkNode[] = [
      {
        id: central.id,
        type: 'aircraft',
        icao_hex: central.icao_hex,
        aircraft_id: central.id,
        label: central.callsign || central.icao_hex,
        aircraft_type: central.type_code || undefined,
        military_category: central.military_category || undefined,
        degree: 0,
        color: '#dc2626', // Highlight central node
      },
    ];

    for (const c of connected) {
      nodes.push({
        id: c.id,
        type: 'aircraft',
        icao_hex: c.icao_hex,
        aircraft_id: c.id,
        label: c.callsign || c.icao_hex,
        aircraft_type: c.type_code || undefined,
        military_category: c.military_category || undefined,
        degree: 0,
      });
    }

    return nodes;
  }

  /**
   * Get edges for the graph
   */
  private async getEdges(
    nodeIds: string[],
    minCooccurrence: number
  ): Promise<NetworkEdge[]> {
    if (nodeIds.length < 2) return [];

    // Get co-occurrences between nodes
    const cooccurrences = await query<AircraftCooccurrence>(
      `SELECT * FROM aircraft_cooccurrences
       WHERE aircraft_id_1 = ANY($1) AND aircraft_id_2 = ANY($1)
       AND cooccurrence_count >= $2`,
      [nodeIds, minCooccurrence]
    );

    // Get relationships between nodes
    const relationships = await query<AircraftRelationship>(
      `SELECT * FROM aircraft_relationships
       WHERE aircraft_id_1 = ANY($1) AND aircraft_id_2 = ANY($1)
       AND is_active = true`,
      [nodeIds]
    );

    const edges: NetworkEdge[] = [];
    const edgeSet = new Set<string>();

    // Add relationship edges (higher priority)
    for (const rel of relationships) {
      const edgeKey = `${rel.aircraft_id_1}-${rel.aircraft_id_2}`;
      if (!edgeSet.has(edgeKey)) {
        edges.push({
          id: rel.id,
          source: rel.aircraft_id_1,
          target: rel.aircraft_id_2,
          relationship_type: rel.relationship_type,
          weight: rel.relationship_strength,
          width: Math.max(1, rel.relationship_strength * 5),
          color: this.getRelationshipColor(rel.relationship_type),
          dashed: !rel.is_confirmed,
        });
        edgeSet.add(edgeKey);
      }
    }

    // Add co-occurrence edges (if no relationship exists)
    for (const coo of cooccurrences) {
      const edgeKey = `${coo.aircraft_id_1}-${coo.aircraft_id_2}`;
      if (!edgeSet.has(edgeKey)) {
        const normalizedWeight = Math.min(1, coo.weighted_score / 10);
        if (normalizedWeight >= CONFIG.minEdgeWeight) {
          edges.push({
            id: coo.id,
            source: coo.aircraft_id_1,
            target: coo.aircraft_id_2,
            relationship_type: 'cooccurrence',
            weight: normalizedWeight,
            cooccurrence_count: coo.cooccurrence_count,
            formation_count: coo.formation_count,
            width: Math.max(1, normalizedWeight * 3),
            color: '#94a3b8', // gray
            dashed: true,
          });
          edgeSet.add(edgeKey);
        }
      }
    }

    return edges;
  }

  /**
   * Calculate node metrics (degree, centrality)
   */
  private calculateNodeMetrics(
    nodes: NetworkNode[],
    edges: NetworkEdge[]
  ): Map<string, { degree: number; centrality: number }> {
    const metrics = new Map<string, { degree: number; centrality: number }>();

    // Initialize
    for (const node of nodes) {
      metrics.set(node.id, { degree: 0, centrality: 0 });
    }

    // Calculate degree
    for (const edge of edges) {
      const sourceMetrics = metrics.get(edge.source);
      const targetMetrics = metrics.get(edge.target);

      if (sourceMetrics) {
        sourceMetrics.degree++;
      }
      if (targetMetrics) {
        targetMetrics.degree++;
      }
    }

    // Calculate degree centrality (normalized)
    const maxDegree = Math.max(...Array.from(metrics.values()).map((m) => m.degree), 1);
    for (const [, m] of metrics) {
      m.centrality = m.degree / maxDegree;
    }

    return metrics;
  }

  /**
   * Calculate network density
   */
  private calculateDensity(nodeCount: number, edgeCount: number): number {
    if (nodeCount < 2) return 0;
    const maxEdges = (nodeCount * (nodeCount - 1)) / 2;
    return edgeCount / maxEdges;
  }

  /**
   * Calculate average degree
   */
  private calculateAvgDegree(nodes: NetworkNode[]): number {
    if (nodes.length === 0) return 0;
    const totalDegree = nodes.reduce((sum, n) => sum + (n.degree || 0), 0);
    return totalDegree / nodes.length;
  }

  /**
   * Get color for relationship type
   */
  private getRelationshipColor(type: RelationshipType | 'cooccurrence'): string {
    switch (type) {
      case 'same_operator':
        return '#3b82f6';
      case 'same_unit':
        return '#8b5cf6';
      case 'tanker_pair':
        return '#f59e0b';
      case 'escort_pair':
        return '#ef4444';
      case 'training_pair':
        return '#10b981';
      case 'exercise_group':
        return '#06b6d4';
      case 'command_subordinate':
        return '#ec4899';
      default:
        return '#94a3b8';
    }
  }

  /**
   * Get empty graph
   */
  private getEmptyGraph(scope: NetworkScope): NetworkGraph {
    return {
      nodes: [],
      edges: [],
      metadata: {
        node_count: 0,
        edge_count: 0,
        density: 0,
        avg_degree: 0,
        generated_at: new Date().toISOString(),
        scope,
      },
    };
  }

  /**
   * Calculate centrality metrics for aircraft
   */
  async calculateCentrality(aircraftId: string): Promise<CentralityMetrics | null> {
    try {
      // Get degree
      const degreeResult = await queryOne<{ degree: string }>(
        `SELECT COUNT(*) as degree FROM aircraft_cooccurrences
         WHERE aircraft_id_1 = $1 OR aircraft_id_2 = $1`,
        [aircraftId]
      );

      const degree = parseInt(degreeResult?.degree || '0', 10);

      // Get total nodes for normalization
      const totalNodes = await queryOne<{ count: string }>(
        `SELECT COUNT(DISTINCT aircraft_id) as count FROM (
           SELECT aircraft_id_1 as aircraft_id FROM aircraft_cooccurrences
           UNION
           SELECT aircraft_id_2 FROM aircraft_cooccurrences
         ) t`
      );

      const nodeCount = parseInt(totalNodes?.count || '1', 10);

      // Calculate degree centrality
      const degreeCentrality = nodeCount > 1 ? degree / (nodeCount - 1) : 0;

      // Simplified metrics (full betweenness/closeness would require graph algorithms)
      return {
        degree,
        degree_centrality: degreeCentrality,
        betweenness_centrality: 0, // Would need full graph traversal
        closeness_centrality: 0, // Would need full graph traversal
        eigenvector_centrality: 0, // Would need power iteration
        pagerank: degreeCentrality, // Approximation
      };
    } catch (error) {
      console.error('Error calculating centrality:', error);
      return null;
    }
  }

  /**
   * Simple community detection using connected components
   */
  async detectCommunities(): Promise<CommunityResult[]> {
    try {
      // Get all edges
      const edges = await query<{ aircraft_id_1: string; aircraft_id_2: string }>(
        `SELECT DISTINCT aircraft_id_1, aircraft_id_2
         FROM aircraft_cooccurrences
         WHERE weighted_score > 1`
      );

      // Build adjacency list
      const adjacency = new Map<string, Set<string>>();

      for (const edge of edges) {
        if (!adjacency.has(edge.aircraft_id_1)) {
          adjacency.set(edge.aircraft_id_1, new Set());
        }
        if (!adjacency.has(edge.aircraft_id_2)) {
          adjacency.set(edge.aircraft_id_2, new Set());
        }
        adjacency.get(edge.aircraft_id_1)!.add(edge.aircraft_id_2);
        adjacency.get(edge.aircraft_id_2)!.add(edge.aircraft_id_1);
      }

      // Find connected components using BFS
      const visited = new Set<string>();
      const communities: CommunityResult[] = [];
      let communityId = 0;

      for (const node of adjacency.keys()) {
        if (visited.has(node)) continue;

        const members: string[] = [];
        const queue = [node];

        while (queue.length > 0) {
          const current = queue.shift()!;
          if (visited.has(current)) continue;

          visited.add(current);
          members.push(current);

          const neighbors = adjacency.get(current);
          if (neighbors) {
            for (const neighbor of neighbors) {
              if (!visited.has(neighbor)) {
                queue.push(neighbor);
              }
            }
          }
        }

        if (members.length >= 2) {
          communities.push({
            community_id: communityId++,
            member_count: members.length,
            members,
            cohesion_score: this.calculateCohesion(members, adjacency),
          });
        }
      }

      return communities.sort((a, b) => b.member_count - a.member_count);
    } catch (error) {
      console.error('Error detecting communities:', error);
      return [];
    }
  }

  /**
   * Calculate cohesion score for a community
   */
  private calculateCohesion(
    members: string[],
    adjacency: Map<string, Set<string>>
  ): number {
    if (members.length < 2) return 0;

    let internalEdges = 0;
    const maxEdges = (members.length * (members.length - 1)) / 2;
    const memberSet = new Set(members);

    for (const member of members) {
      const neighbors = adjacency.get(member);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (memberSet.has(neighbor) && member < neighbor) {
            internalEdges++;
          }
        }
      }
    }

    return internalEdges / maxEdges;
  }

  /**
   * Store network analysis results
   */
  async storeAnalysisResult(
    analysisType: string,
    aircraftId: string | null,
    icaoHex: string | null,
    metricName: string,
    metricValue: number,
    metricRank: number | null,
    scope: NetworkScope
  ): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await query(
        `INSERT INTO network_analysis_results (
           analysis_type, aircraft_id, icao_hex,
           metric_name, metric_value, metric_rank,
           network_scope, analysis_timestamp, expires_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
        [
          analysisType,
          aircraftId,
          icaoHex,
          metricName,
          metricValue,
          metricRank,
          scope,
          expiresAt.toISOString(),
        ]
      );
    } catch (error) {
      console.error('Error storing analysis result:', error);
    }
  }
}

// Export singleton instance
export const networkGraphService = new NetworkGraphService();
