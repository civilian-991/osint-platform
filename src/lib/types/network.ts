// Relationship Intelligence Types
// Network analysis, operator groupings, and aircraft relationships

// ============================================
// OPERATOR GROUPS
// ============================================

export interface OperatorGroup {
  id: string;
  name: string;
  normalized_name: string;
  // Classification
  operator_type: OperatorType;
  country_code: string | null;
  parent_group_id: string | null;
  // Identification patterns
  callsign_prefixes: string[];
  registration_patterns: string[];
  // Statistics
  aircraft_count: number;
  active_aircraft_count: number;
  total_flights_tracked: number;
  // Metadata
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type OperatorType =
  | 'air_force'
  | 'navy'
  | 'army'
  | 'marines'
  | 'coast_guard'
  | 'national_guard'
  | 'contractor'
  | 'government'
  | 'civilian'
  | 'unknown';

export interface OperatorGroupInput {
  name: string;
  operator_type: OperatorType;
  country_code?: string;
  parent_group_id?: string;
  callsign_prefixes?: string[];
  registration_patterns?: string[];
  description?: string;
}

// ============================================
// AIRCRAFT CO-OCCURRENCES
// ============================================

export interface AircraftCooccurrence {
  id: string;
  aircraft_id_1: string;
  aircraft_id_2: string;
  icao_hex_1: string;
  icao_hex_2: string;
  // Metrics
  cooccurrence_count: number;
  formation_count: number;
  proximity_count: number;
  weighted_score: number;
  // Temporal
  first_seen_together: string;
  last_seen_together: string;
  // Formation breakdown
  formation_types_seen: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface CooccurrenceUpdate {
  aircraft_id_1: string;
  aircraft_id_2: string;
  icao_hex_1: string;
  icao_hex_2: string;
  formation_type?: string;
  is_formation: boolean;
  is_proximity: boolean;
}

// ============================================
// AIRCRAFT RELATIONSHIPS
// ============================================

export interface AircraftRelationship {
  id: string;
  aircraft_id_1: string;
  aircraft_id_2: string;
  icao_hex_1: string;
  icao_hex_2: string;
  // Relationship details
  relationship_type: RelationshipType;
  relationship_strength: number; // 0-1
  // Source
  source: RelationshipSource;
  inference_method: string | null;
  // Evidence
  evidence: RelationshipEvidence[];
  confidence: number;
  // Manual override
  is_confirmed: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  // Status
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type RelationshipType =
  | 'same_operator' // Same operator/unit
  | 'same_unit' // Same specific unit
  | 'tanker_pair' // Tanker and receiver pair
  | 'escort_pair' // Escort relationship
  | 'training_pair' // Training together
  | 'exercise_group' // Part of same exercise
  | 'command_subordinate'; // Command relationship

export type RelationshipSource =
  | 'inferred' // Automatically inferred
  | 'manual' // Manually entered
  | 'imported'; // Imported from external source

export interface RelationshipEvidence {
  type: string; // 'cooccurrence', 'callsign', 'registration', 'formation'
  description: string;
  weight: number;
  timestamp?: string;
}

export interface RelationshipInput {
  aircraft_id_1: string;
  aircraft_id_2: string;
  icao_hex_1: string;
  icao_hex_2: string;
  relationship_type: RelationshipType;
  evidence?: RelationshipEvidence[];
  confidence?: number;
}

// ============================================
// NETWORK GRAPH
// ============================================

export interface NetworkGraph {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  metadata: NetworkMetadata;
}

export interface NetworkNode {
  id: string;
  type: 'aircraft' | 'operator' | 'formation';
  // Identification
  icao_hex?: string;
  aircraft_id?: string;
  operator_id?: string;
  // Display
  label: string;
  icon?: string;
  // Properties
  aircraft_type?: string;
  military_category?: string;
  operator_name?: string;
  // Metrics
  degree: number;
  centrality?: number;
  community_id?: number;
  // Visual
  size?: number;
  color?: string;
  x?: number;
  y?: number;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  // Properties
  relationship_type: RelationshipType | 'cooccurrence';
  weight: number;
  // Metrics
  cooccurrence_count?: number;
  formation_count?: number;
  // Visual
  width?: number;
  color?: string;
  dashed?: boolean;
}

export interface NetworkMetadata {
  node_count: number;
  edge_count: number;
  density: number;
  avg_degree: number;
  communities?: number;
  generated_at: string;
  scope: NetworkScope;
}

export type NetworkScope =
  | 'global'
  | 'regional'
  | 'operator'
  | 'formation'
  | 'ego'; // Single aircraft's network

export interface NetworkGraphParams {
  scope?: NetworkScope;
  region?: string;
  operator_id?: string;
  aircraft_id?: string;
  min_cooccurrence?: number;
  include_inactive?: boolean;
  max_nodes?: number;
}

// ============================================
// NETWORK ANALYSIS
// ============================================

export interface NetworkAnalysisResult {
  id: string;
  analysis_type: NetworkAnalysisType;
  // Entity reference
  aircraft_id?: string;
  icao_hex?: string;
  operator_group_id?: string;
  // Metrics
  metric_name: string;
  metric_value: number;
  metric_rank: number | null;
  // Context
  network_scope: NetworkScope;
  node_count: number;
  edge_count: number;
  // Timestamp
  analysis_timestamp: string;
  expires_at: string;
  created_at: string;
}

export type NetworkAnalysisType =
  | 'centrality'
  | 'community'
  | 'influence'
  | 'bridge';

export interface CentralityMetrics {
  degree: number;
  degree_centrality: number;
  betweenness_centrality: number;
  closeness_centrality: number;
  eigenvector_centrality: number;
  pagerank: number;
}

export interface CommunityResult {
  community_id: number;
  member_count: number;
  members: string[]; // Aircraft IDs
  dominant_operator?: string;
  dominant_type?: string;
  cohesion_score: number;
}

// ============================================
// COMMAND INFERENCE
// ============================================

export interface CommandStructure {
  formation_id: string;
  lead_aircraft_id: string;
  lead_icao_hex: string;
  // Subordinates
  subordinates: CommandSubordinate[];
  // Analysis
  confidence: number;
  inference_basis: string[];
}

export interface CommandSubordinate {
  aircraft_id: string;
  icao_hex: string;
  role: string; // 'wingman', 'element_lead', 'receiver', etc.
  position_in_formation?: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getRelationshipTypeLabel(type: RelationshipType): string {
  switch (type) {
    case 'same_operator':
      return 'Same Operator';
    case 'same_unit':
      return 'Same Unit';
    case 'tanker_pair':
      return 'Tanker-Receiver';
    case 'escort_pair':
      return 'Escort';
    case 'training_pair':
      return 'Training Partners';
    case 'exercise_group':
      return 'Exercise Group';
    case 'command_subordinate':
      return 'Command Structure';
    default:
      return 'Unknown';
  }
}

export function getRelationshipColor(type: RelationshipType): string {
  switch (type) {
    case 'same_operator':
      return '#3b82f6'; // blue
    case 'same_unit':
      return '#8b5cf6'; // purple
    case 'tanker_pair':
      return '#f59e0b'; // amber
    case 'escort_pair':
      return '#ef4444'; // red
    case 'training_pair':
      return '#10b981'; // emerald
    case 'exercise_group':
      return '#06b6d4'; // cyan
    case 'command_subordinate':
      return '#ec4899'; // pink
    default:
      return '#6b7280'; // gray
  }
}

export function getOperatorTypeLabel(type: OperatorType): string {
  switch (type) {
    case 'air_force':
      return 'Air Force';
    case 'navy':
      return 'Navy';
    case 'army':
      return 'Army';
    case 'marines':
      return 'Marines';
    case 'coast_guard':
      return 'Coast Guard';
    case 'national_guard':
      return 'National Guard';
    case 'contractor':
      return 'Contractor';
    case 'government':
      return 'Government';
    case 'civilian':
      return 'Civilian';
    default:
      return 'Unknown';
  }
}

// Relationship strength thresholds
export const RELATIONSHIP_THRESHOLDS = {
  strong: 0.8,
  moderate: 0.5,
  weak: 0.2,
} as const;

// Co-occurrence decay rate (daily)
export const COOCCURRENCE_DECAY_RATE = 0.05; // 5% per day

// Minimum co-occurrences to infer relationship
export const MIN_COOCCURRENCES_FOR_RELATIONSHIP = 3;
