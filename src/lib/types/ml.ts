// ML/AI Enhancement Types

// ============================================
// EMBEDDINGS
// ============================================

export interface Embedding {
  id: string;
  entity_type: EmbeddingEntityType;
  entity_id: string;
  embedding: number[];
  model: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type EmbeddingEntityType = 'news_event' | 'aircraft' | 'correlation';

// ============================================
// ANOMALY DETECTION
// ============================================

export interface AnomalyDetection {
  id: string;
  aircraft_id: string;
  flight_id: string | null;
  anomaly_type: AnomalyType;
  severity: number; // 0-1
  detected_value: Record<string, unknown>;
  expected_value: Record<string, unknown> | null;
  deviation_score: number | null;
  analysis: string | null;
  confidence: number;
  is_acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export type AnomalyType =
  | 'speed'
  | 'altitude'
  | 'route'
  | 'timing'
  | 'formation'
  | 'behavioral';

export interface AnomalyDetectionInput {
  aircraft_id: string;
  flight_id?: string;
  positions: PositionData[];
  profile?: BehavioralProfile;
}

export interface PositionData {
  latitude: number;
  longitude: number;
  altitude: number | null;
  ground_speed: number | null;
  track: number | null;
  timestamp: string;
}

// ============================================
// INTENT CLASSIFICATION
// ============================================

export interface IntentClassification {
  id: string;
  aircraft_id: string;
  flight_id: string | null;
  intent: FlightIntent;
  confidence: number;
  evidence: IntentEvidence[];
  reasoning: string | null;
  alternative_intents: AlternativeIntent[];
  model_version: string | null;
  created_at: string;
  updated_at: string;
}

export type FlightIntent =
  | 'training'
  | 'patrol'
  | 'refueling'
  | 'surveillance'
  | 'combat'
  | 'transit'
  | 'exercise';

// Alias for UI components with 'unknown' option
export type IntentType = FlightIntent | 'unknown';

export interface IntentEvidence {
  type: string;
  description: string;
  weight: number;
}

export interface AlternativeIntent {
  intent: FlightIntent;
  confidence: number;
}

export interface IntentClassificationInput {
  aircraft_id: string;
  flight_id?: string;
  aircraft_type?: string;
  military_category?: string;
  positions: PositionData[];
  pattern?: string;
  nearby_aircraft?: NearbyAircraft[];
}

export interface NearbyAircraft {
  icao_hex: string;
  aircraft_type?: string;
  military_category?: string;
  distance_nm: number;
  relative_heading: number;
}

// ============================================
// THREAT ASSESSMENT
// ============================================

export interface ThreatAssessment {
  id: string;
  entity_type: ThreatEntityType;
  entity_id: string;
  threat_score: number; // 0-1
  threat_level: ThreatLevel;
  pattern_anomaly_score: number;
  regional_tension_score: number;
  news_correlation_score: number;
  historical_context_score: number;
  formation_activity_score: number;
  location_context_score: number;
  factors: ThreatFactors;
  analysis: string | null;
  recommendations: ThreatRecommendation[];
  confidence: number;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export type ThreatEntityType = 'aircraft' | 'region' | 'news_event' | 'correlation';

export type ThreatLevel = 'minimal' | 'low' | 'elevated' | 'high' | 'critical';

export interface ThreatFactors {
  anomalies?: string[];
  tensions?: string[];
  correlations?: string[];
  historical?: string[];
  formations?: string[];
  location?: string[];
}

export interface ThreatRecommendation {
  action: string;
  priority: 'low' | 'medium' | 'high';
  rationale: string;
}

export const THREAT_WEIGHTS = {
  patternAnomaly: 0.20,
  regionalTension: 0.15,
  newsCorrelation: 0.20,
  historicalContext: 0.15,
  formationActivity: 0.10,
  locationContext: 0.20,
} as const;

export function getThreatLevel(score: number): ThreatLevel {
  if (score < 0.2) return 'minimal';
  if (score < 0.4) return 'low';
  if (score < 0.6) return 'elevated';
  if (score < 0.8) return 'high';
  return 'critical';
}

// ============================================
// ARTICLE CORROBORATION
// ============================================

export interface ArticleCorroboration {
  id: string;
  article_a_id: string;
  article_b_id: string;
  similarity_score: number;
  topic_overlap: string[];
  source_diversity_bonus: number;
  temporal_proximity_bonus: number;
  created_at: string;
}

// ============================================
// ENHANCED ENTITIES
// ============================================

export interface EnhancedEntity {
  id: string;
  source_type: 'news_event' | 'social_post';
  source_id: string;
  entity_type: MilitaryEntityType;
  entity_name: string;
  name: string; // Alias for entity_name for UI compatibility
  normalized_name: string | null;
  confidence: number;
  context: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type MilitaryEntityType =
  | 'weapon_system'
  | 'military_unit'
  | 'operation_name'
  | 'equipment'
  | 'personnel'
  | 'aircraft'
  | 'location';

// Alias for UI components
export type EnhancedEntityType = MilitaryEntityType;

export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  raw_response?: string;
}

export interface ExtractedEntity {
  name: string;
  type: MilitaryEntityType;
  normalized_name?: string;
  confidence: number;
  context?: string;
}

// ============================================
// FORMATION DETECTION
// ============================================

export interface FormationDetection {
  id: string;
  formation_type: FormationType;
  confidence: number;
  lead_aircraft_id: string | null;
  aircraft_ids: string[];
  center_lat: number;
  center_lon: number;
  spread_nm: number | null;
  heading: number | null;
  altitude_band_low: number | null;
  altitude_band_high: number | null;
  detection_method: FormationDetectionMethod | null;
  analysis: string | null;
  metadata: Record<string, unknown>;
  first_detected_at: string;
  last_seen_at: string;
  is_active: boolean;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
}

export type FormationType =
  | 'tanker_receiver'
  | 'escort'
  | 'strike_package'
  | 'cap'
  | 'unknown';

export type FormationDetectionMethod =
  | 'spatial_clustering'
  | 'temporal_correlation'
  | 'gemini_analysis';

export interface FormationCandidate {
  aircraft_ids: string[];
  positions: Map<string, PositionData>;
  aircraft_types: Map<string, string>;
  military_categories: Map<string, string>;
}

// ============================================
// BEHAVIORAL PROFILES
// ============================================

export interface BehavioralProfile {
  id: string;
  aircraft_id: string;
  typical_patterns: PatternDistribution;
  typical_regions: TypicalRegion[];
  altitude_min: number | null;
  altitude_max: number | null;
  altitude_avg: number | null;
  altitude_stddev: number | null;
  speed_min: number | null;
  speed_max: number | null;
  speed_avg: number | null;
  speed_stddev: number | null;
  hourly_activity: Record<string, number>;
  daily_activity: Record<string, number>;
  sample_count: number;
  is_trained: boolean;
  decay_factor: number;
  last_flight_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatternDistribution {
  orbit: number;
  racetrack: number;
  holding: number;
  tanker_track: number;
  straight: number;
}

export interface TypicalRegion {
  center_lat: number;
  center_lon: number;
  radius_nm: number;
  frequency: number;
}

export interface ProfileUpdateInput {
  aircraft_id: string;
  pattern?: string;
  positions: PositionData[];
  flight_time?: { departure: string; arrival?: string };
}

// ============================================
// SMART ALERTING
// ============================================

export interface AlertInteraction {
  id: string;
  alert_id: string;
  user_id: string;
  interaction_type: InteractionType;
  time_to_action_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type InteractionType =
  | 'viewed'
  | 'read'
  | 'dismissed'
  | 'clicked'
  | 'expanded'
  | 'ignored';

export interface UserAlertModel {
  id: string;
  user_id: string;
  type_preferences: Record<string, number>;
  region_preferences: Record<string, number>;
  aircraft_type_preferences: Record<string, number>;
  active_hours: Record<string, number>;
  active_days: Record<string, number>;
  click_through_rate: number;
  dismiss_rate: number;
  avg_time_to_action_ms: number;
  learning_rate: number;
  decay_rate: number;
  total_interactions: number;
  created_at: string;
  updated_at: string;
}

export interface PrioritizedAlert {
  alert_id: string;
  base_score: number;
  user_relevance: number;
  context_boost: number;
  final_score: number;
  recommendation: 'send' | 'batch' | 'skip';
}

// ============================================
// GEMINI CACHE
// ============================================

export interface GeminiCache {
  id: string;
  cache_key: string;
  model: string;
  request_hash: string;
  response: Record<string, unknown>;
  tokens_used: number | null;
  created_at: string;
  expires_at: string;
  hits: number;
}

// ============================================
// ML PROCESSING QUEUE
// ============================================

export interface MLTask {
  id: string;
  task_type: MLTaskType;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  priority: number;
  status: MLTaskStatus;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  scheduled_for: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export type MLTaskType =
  | 'anomaly_detection'
  | 'formation_detection'
  | 'entity_extraction'
  | 'embedding_generation'
  | 'intent_classification'
  | 'threat_assessment'
  | 'profile_update'
  | 'corroboration_scoring'
  | 'trajectory_prediction'
  | 'proximity_analysis'
  | 'network_analysis'
  | 'context_scoring';

export type MLTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

// ============================================
// GEMINI API TYPES
// ============================================

export type GeminiModel = 'flash' | 'pro';

export interface GeminiGenerateRequest {
  prompt: string;
  model?: GeminiModel;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface GeminiGenerateResponse {
  text: string;
  tokens_used: number;
  cached: boolean;
}

export interface GeminiEmbeddingRequest {
  text: string | string[];
}

export interface GeminiEmbeddingResponse {
  embeddings: number[][];
  tokens_used: number;
}
