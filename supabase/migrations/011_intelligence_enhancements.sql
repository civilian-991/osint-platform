-- Migration: Intelligence Platform Enhancements
-- Description: Add predictive, relationship, contextual intelligence, and dashboard capabilities

-- ================================================
-- PREDICTIVE INTELLIGENCE
-- Trajectory forecasting and conflict warnings
-- ================================================

-- Trajectory predictions at various time horizons
CREATE TABLE IF NOT EXISTS trajectory_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_id UUID NOT NULL,
  icao_hex VARCHAR(6) NOT NULL,
  -- Prediction horizons (5, 15, 30 minutes)
  horizon_minutes INTEGER NOT NULL,
  -- Predicted position
  predicted_lat NUMERIC(10, 6) NOT NULL,
  predicted_lon NUMERIC(10, 6) NOT NULL,
  predicted_altitude INTEGER,
  predicted_heading NUMERIC(5, 2),
  predicted_speed INTEGER,
  -- Uncertainty cone (radius in nautical miles)
  uncertainty_radius_nm NUMERIC(6, 2) NOT NULL,
  -- Confidence decays with time
  confidence NUMERIC(5, 4) NOT NULL,
  -- Input data used for prediction
  source_lat NUMERIC(10, 6) NOT NULL,
  source_lon NUMERIC(10, 6) NOT NULL,
  source_altitude INTEGER,
  source_heading NUMERIC(5, 2),
  source_speed INTEGER,
  turn_rate NUMERIC(5, 2), -- degrees per second
  vertical_rate INTEGER, -- feet per minute
  -- Method and model version
  prediction_method VARCHAR(50) DEFAULT 'physics_behavioral',
  model_version VARCHAR(20) DEFAULT '1.0',
  -- Timestamps
  predicted_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trajectory_predictions_aircraft ON trajectory_predictions (aircraft_id, horizon_minutes);
CREATE INDEX idx_trajectory_predictions_icao ON trajectory_predictions (icao_hex, horizon_minutes);
CREATE INDEX idx_trajectory_predictions_expires ON trajectory_predictions (expires_at);
CREATE INDEX idx_trajectory_predictions_active ON trajectory_predictions (expires_at)
  WHERE expires_at > NOW();

-- Proximity warnings between aircraft
CREATE TABLE IF NOT EXISTS proximity_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Aircraft pair
  aircraft_id_1 UUID NOT NULL,
  aircraft_id_2 UUID NOT NULL,
  icao_hex_1 VARCHAR(6) NOT NULL,
  icao_hex_2 VARCHAR(6) NOT NULL,
  -- Warning details
  warning_type VARCHAR(50) NOT NULL, -- 'convergence', 'parallel_approach', 'crossing', 'same_altitude'
  severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
  -- Predicted closest approach
  closest_approach_nm NUMERIC(6, 2) NOT NULL,
  closest_approach_time TIMESTAMPTZ NOT NULL,
  -- Current positions at time of warning
  lat_1 NUMERIC(10, 6) NOT NULL,
  lon_1 NUMERIC(10, 6) NOT NULL,
  altitude_1 INTEGER,
  lat_2 NUMERIC(10, 6) NOT NULL,
  lon_2 NUMERIC(10, 6) NOT NULL,
  altitude_2 INTEGER,
  -- Convergence rate
  closure_rate_kts INTEGER, -- knots
  vertical_separation_ft INTEGER,
  -- Status
  confidence NUMERIC(5, 4) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  -- Timestamps
  first_detected_at TIMESTAMPTZ NOT NULL,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proximity_warnings_aircraft_1 ON proximity_warnings (aircraft_id_1);
CREATE INDEX idx_proximity_warnings_aircraft_2 ON proximity_warnings (aircraft_id_2);
CREATE INDEX idx_proximity_warnings_active ON proximity_warnings (is_active) WHERE is_active = true;
CREATE INDEX idx_proximity_warnings_severity ON proximity_warnings (severity, is_active);

-- Formation predictions (future composition forecasts)
CREATE TABLE IF NOT EXISTS formation_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Reference to current or predicted formation
  formation_id UUID,
  formation_type VARCHAR(50) NOT NULL,
  -- Predicted aircraft that may join
  predicted_aircraft_ids UUID[] NOT NULL,
  predicted_icao_hexes VARCHAR(6)[] NOT NULL,
  -- Prediction details
  join_probability NUMERIC(5, 4) NOT NULL,
  predicted_join_time TIMESTAMPTZ,
  predicted_location_lat NUMERIC(10, 6),
  predicted_location_lon NUMERIC(10, 6),
  -- Reasoning
  prediction_basis TEXT, -- e.g., 'trajectory_convergence', 'historical_pattern', 'callsign_sequence'
  confidence NUMERIC(5, 4) NOT NULL,
  -- Status
  expires_at TIMESTAMPTZ NOT NULL,
  validated BOOLEAN,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_formation_predictions_formation ON formation_predictions (formation_id);
CREATE INDEX idx_formation_predictions_expires ON formation_predictions (expires_at);

-- Prediction validation statistics for model improvement
CREATE TABLE IF NOT EXISTS prediction_validation_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_type VARCHAR(50) NOT NULL, -- 'trajectory', 'proximity', 'formation'
  horizon_minutes INTEGER,
  -- Accuracy metrics
  total_predictions INTEGER DEFAULT 0,
  validated_predictions INTEGER DEFAULT 0,
  accurate_predictions INTEGER DEFAULT 0,
  -- Error statistics
  mean_error NUMERIC(10, 4),
  median_error NUMERIC(10, 4),
  error_std_dev NUMERIC(10, 4),
  max_error NUMERIC(10, 4),
  -- Time window
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(prediction_type, horizon_minutes, period_start)
);

CREATE INDEX idx_prediction_validation_type ON prediction_validation_stats (prediction_type, period_start DESC);

-- ================================================
-- RELATIONSHIP INTELLIGENCE
-- Network analysis and operator groupings
-- ================================================

-- Normalized operator/unit groupings
CREATE TABLE IF NOT EXISTS operator_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  normalized_name VARCHAR(255) NOT NULL,
  -- Classification
  operator_type VARCHAR(50), -- 'air_force', 'navy', 'army', 'contractor', 'government', 'unknown'
  country_code VARCHAR(3),
  parent_group_id UUID REFERENCES operator_groups(id),
  -- Identification patterns
  callsign_prefixes TEXT[], -- e.g., ['RCH', 'REACH'] for USAF airlift
  registration_patterns TEXT[], -- e.g., ['16-*', '17-*'] for newer C-17s
  -- Statistics
  aircraft_count INTEGER DEFAULT 0,
  active_aircraft_count INTEGER DEFAULT 0,
  total_flights_tracked INTEGER DEFAULT 0,
  -- Metadata
  description TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_operator_groups_type ON operator_groups (operator_type);
CREATE INDEX idx_operator_groups_country ON operator_groups (country_code);
CREATE INDEX idx_operator_groups_parent ON operator_groups (parent_group_id);

-- Aircraft co-occurrence matrix (tracks aircraft flying together)
CREATE TABLE IF NOT EXISTS aircraft_cooccurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_id_1 UUID NOT NULL,
  aircraft_id_2 UUID NOT NULL,
  icao_hex_1 VARCHAR(6) NOT NULL,
  icao_hex_2 VARCHAR(6) NOT NULL,
  -- Co-occurrence metrics
  cooccurrence_count INTEGER DEFAULT 1,
  formation_count INTEGER DEFAULT 0, -- Times seen in same formation
  proximity_count INTEGER DEFAULT 0, -- Times within 20nm
  -- Time-weighted score (recent co-occurrences weighted higher)
  weighted_score NUMERIC(10, 4) DEFAULT 1.0,
  -- Temporal tracking
  first_seen_together TIMESTAMPTZ NOT NULL,
  last_seen_together TIMESTAMPTZ NOT NULL,
  -- Formation type breakdown
  formation_types_seen JSONB DEFAULT '{}', -- {formation_type: count}
  -- Ensure aircraft_id_1 < aircraft_id_2 to avoid duplicates
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(aircraft_id_1, aircraft_id_2),
  CHECK (aircraft_id_1 < aircraft_id_2)
);

CREATE INDEX idx_cooccurrences_aircraft_1 ON aircraft_cooccurrences (aircraft_id_1);
CREATE INDEX idx_cooccurrences_aircraft_2 ON aircraft_cooccurrences (aircraft_id_2);
CREATE INDEX idx_cooccurrences_score ON aircraft_cooccurrences (weighted_score DESC);
CREATE INDEX idx_cooccurrences_recent ON aircraft_cooccurrences (last_seen_together DESC);

-- Inferred and manual aircraft relationships
CREATE TABLE IF NOT EXISTS aircraft_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_id_1 UUID NOT NULL,
  aircraft_id_2 UUID NOT NULL,
  icao_hex_1 VARCHAR(6) NOT NULL,
  icao_hex_2 VARCHAR(6) NOT NULL,
  -- Relationship details
  relationship_type VARCHAR(50) NOT NULL, -- 'same_operator', 'same_unit', 'tanker_pair', 'escort_pair', 'training_pair'
  relationship_strength NUMERIC(5, 4) NOT NULL, -- 0-1
  -- Source of relationship
  source VARCHAR(50) NOT NULL, -- 'inferred', 'manual', 'imported'
  inference_method VARCHAR(100), -- 'cooccurrence_analysis', 'callsign_pattern', 'registration_pattern'
  -- Evidence
  evidence JSONB DEFAULT '[]', -- Array of evidence items
  confidence NUMERIC(5, 4) NOT NULL,
  -- Manual override
  is_confirmed BOOLEAN DEFAULT false,
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(aircraft_id_1, aircraft_id_2, relationship_type)
);

CREATE INDEX idx_relationships_aircraft_1 ON aircraft_relationships (aircraft_id_1);
CREATE INDEX idx_relationships_aircraft_2 ON aircraft_relationships (aircraft_id_2);
CREATE INDEX idx_relationships_type ON aircraft_relationships (relationship_type);
CREATE INDEX idx_relationships_strength ON aircraft_relationships (relationship_strength DESC);

-- Network analysis results (centrality, community detection)
CREATE TABLE IF NOT EXISTS network_analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_type VARCHAR(50) NOT NULL, -- 'centrality', 'community', 'influence', 'bridge'
  -- For aircraft-level analysis
  aircraft_id UUID,
  icao_hex VARCHAR(6),
  -- For operator-level analysis
  operator_group_id UUID REFERENCES operator_groups(id),
  -- Metrics
  metric_name VARCHAR(100) NOT NULL, -- 'degree_centrality', 'betweenness_centrality', 'community_id', etc.
  metric_value NUMERIC(10, 6) NOT NULL,
  metric_rank INTEGER,
  -- Context
  network_scope VARCHAR(50) DEFAULT 'global', -- 'global', 'regional', 'operator'
  node_count INTEGER,
  edge_count INTEGER,
  -- Timestamp
  analysis_timestamp TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_network_analysis_aircraft ON network_analysis_results (aircraft_id, analysis_type);
CREATE INDEX idx_network_analysis_operator ON network_analysis_results (operator_group_id, analysis_type);
CREATE INDEX idx_network_analysis_type ON network_analysis_results (analysis_type, analysis_timestamp DESC);

-- ================================================
-- CONTEXTUAL INTELLIGENCE
-- Infrastructure, airspace, and activity awareness
-- ================================================

-- Military bases, airports, strategic infrastructure (PostGIS)
CREATE TABLE IF NOT EXISTS infrastructure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  -- Type classification
  infrastructure_type VARCHAR(50) NOT NULL, -- 'military_base', 'airport', 'port', 'refinery', 'power_plant', 'government'
  sub_type VARCHAR(100), -- 'air_force_base', 'naval_station', 'commercial_airport', etc.
  -- Location (PostGIS point)
  location GEOMETRY(Point, 4326) NOT NULL,
  -- Additional spatial data
  boundary GEOMETRY(Polygon, 4326), -- Optional boundary polygon
  runway_headings INTEGER[], -- For airfields
  -- Identification
  icao_code VARCHAR(4), -- For airports
  iata_code VARCHAR(3), -- For airports
  country_code VARCHAR(3),
  region VARCHAR(100),
  -- Strategic assessment
  strategic_importance VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  military_presence BOOLEAN DEFAULT false,
  -- Metadata
  description TEXT,
  source VARCHAR(100), -- 'osm', 'manual', 'imported'
  source_id VARCHAR(255), -- External ID from source
  -- Status
  is_active BOOLEAN DEFAULT true,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_infrastructure_type ON infrastructure (infrastructure_type);
CREATE INDEX idx_infrastructure_location ON infrastructure USING GIST (location);
CREATE INDEX idx_infrastructure_boundary ON infrastructure USING GIST (boundary) WHERE boundary IS NOT NULL;
CREATE INDEX idx_infrastructure_icao ON infrastructure (icao_code) WHERE icao_code IS NOT NULL;
CREATE INDEX idx_infrastructure_country ON infrastructure (country_code);
CREATE INDEX idx_infrastructure_importance ON infrastructure (strategic_importance);

-- Airspace definitions (PostGIS polygons with classification)
CREATE TABLE IF NOT EXISTS airspace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  -- Classification
  airspace_class VARCHAR(20) NOT NULL, -- 'A', 'B', 'C', 'D', 'E', 'G', 'restricted', 'prohibited', 'danger', 'moa', 'alert', 'warning'
  airspace_type VARCHAR(50), -- 'CTR', 'TMA', 'FIR', 'UIR', 'ADIZ', 'TFR', etc.
  -- Geometry (PostGIS polygon)
  geom GEOMETRY(Polygon, 4326) NOT NULL,
  -- Vertical limits
  lower_limit_ft INTEGER, -- AGL or MSL
  lower_limit_reference VARCHAR(10) DEFAULT 'MSL', -- 'MSL', 'AGL', 'FL'
  upper_limit_ft INTEGER,
  upper_limit_reference VARCHAR(10) DEFAULT 'MSL',
  -- Operational details
  controlling_agency VARCHAR(255),
  frequency_mhz NUMERIC(7, 3),
  operating_hours VARCHAR(255), -- 'H24', 'SR-SS', 'HX', etc.
  -- Significance for intelligence
  military_significance VARCHAR(20) DEFAULT 'low', -- 'low', 'medium', 'high'
  activity_typical VARCHAR(100), -- e.g., 'training', 'testing', 'alert'
  -- Metadata
  country_code VARCHAR(3),
  source VARCHAR(100),
  source_id VARCHAR(255),
  -- Status
  is_active BOOLEAN DEFAULT true,
  effective_from TIMESTAMPTZ,
  effective_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_airspace_class ON airspace (airspace_class);
CREATE INDEX idx_airspace_type ON airspace (airspace_type);
CREATE INDEX idx_airspace_geom ON airspace USING GIST (geom);
CREATE INDEX idx_airspace_country ON airspace (country_code);
CREATE INDEX idx_airspace_military ON airspace (military_significance) WHERE military_significance != 'low';

-- Dynamic activity zones (high-activity clusters detected from data)
CREATE TABLE IF NOT EXISTS activity_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Zone geometry (PostGIS polygon or circle)
  geom GEOMETRY(Polygon, 4326) NOT NULL,
  center_lat NUMERIC(10, 6) NOT NULL,
  center_lon NUMERIC(10, 6) NOT NULL,
  radius_nm NUMERIC(8, 2),
  -- Activity metrics
  activity_level VARCHAR(20) NOT NULL, -- 'low', 'moderate', 'high', 'intense'
  aircraft_count INTEGER NOT NULL,
  unique_aircraft_count INTEGER NOT NULL,
  military_aircraft_count INTEGER DEFAULT 0,
  formation_count INTEGER DEFAULT 0,
  -- Activity characteristics
  dominant_activity VARCHAR(50), -- 'training', 'patrol', 'transit', 'refueling', 'exercise'
  dominant_aircraft_types TEXT[],
  -- Temporal patterns
  peak_hours INTEGER[], -- Hours of day with peak activity (0-23)
  active_days INTEGER DEFAULT 0, -- Days active in last 30 days
  -- Time window
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  -- Status
  is_active BOOLEAN DEFAULT true,
  confidence NUMERIC(5, 4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_zones_geom ON activity_zones USING GIST (geom);
CREATE INDEX idx_activity_zones_level ON activity_zones (activity_level);
CREATE INDEX idx_activity_zones_active ON activity_zones (is_active) WHERE is_active = true;
CREATE INDEX idx_activity_zones_period ON activity_zones (period_start DESC, period_end DESC);

-- Position context cache (pre-computed context scores)
CREATE TABLE IF NOT EXISTS position_context_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Grid cell (geohash or H3 index for efficient spatial lookups)
  grid_cell VARCHAR(20) NOT NULL UNIQUE,
  center_lat NUMERIC(10, 6) NOT NULL,
  center_lon NUMERIC(10, 6) NOT NULL,
  -- Context scores (0-1)
  infrastructure_score NUMERIC(5, 4) NOT NULL,
  airspace_score NUMERIC(5, 4) NOT NULL,
  activity_score NUMERIC(5, 4) NOT NULL,
  combined_score NUMERIC(5, 4) NOT NULL,
  -- Nearest features
  nearest_infrastructure_id UUID REFERENCES infrastructure(id),
  nearest_infrastructure_distance_nm NUMERIC(8, 2),
  nearest_airspace_id UUID REFERENCES airspace(id),
  nearest_activity_zone_id UUID REFERENCES activity_zones(id),
  -- Component details
  infrastructure_details JSONB, -- Array of nearby infrastructure
  airspace_details JSONB, -- Array of containing/nearby airspace
  -- Cache validity
  computed_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_context_cache_cell ON position_context_cache (grid_cell);
CREATE INDEX idx_context_cache_expires ON position_context_cache (expires_at);

-- ================================================
-- DASHBOARD & UX TABLES
-- Saved searches, layouts, metrics
-- ================================================

-- User-saved filter combinations
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  -- Filter criteria (flexible JSON)
  filters JSONB NOT NULL, -- {aircraft_types: [], regions: [], operators: [], threat_level: [], etc.}
  -- Display options
  sort_by VARCHAR(50),
  sort_order VARCHAR(10) DEFAULT 'desc',
  view_mode VARCHAR(20) DEFAULT 'list', -- 'list', 'map', 'grid'
  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  -- Sharing
  is_shared BOOLEAN DEFAULT false,
  shared_with UUID[], -- User IDs
  -- Organization
  folder VARCHAR(100),
  color VARCHAR(7), -- Hex color for visual distinction
  icon VARCHAR(50),
  position INTEGER DEFAULT 0, -- Sort order in UI
  -- Status
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_searches_user ON saved_searches (user_id);
CREATE INDEX idx_saved_searches_shared ON saved_searches (is_shared) WHERE is_shared = true;
CREATE INDEX idx_saved_searches_pinned ON saved_searches (user_id, is_pinned) WHERE is_pinned = true;

-- Dashboard widget layouts
CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT 'Default',
  -- Layout definition
  layout JSONB NOT NULL, -- Array of {widget_id, x, y, w, h, config}
  -- Dashboard settings
  grid_columns INTEGER DEFAULT 12,
  row_height INTEGER DEFAULT 50,
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dashboard_layouts_user ON dashboard_layouts (user_id);
CREATE INDEX idx_dashboard_layouts_active ON dashboard_layouts (user_id, is_active) WHERE is_active = true;

-- Quick filter presets (system + user-defined)
CREATE TABLE IF NOT EXISTS quick_filter_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Ownership (null = system preset)
  user_id UUID,
  -- Filter definition
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'aircraft_type', 'region', 'threat_level', 'operator', 'custom'
  filters JSONB NOT NULL,
  -- Display
  label VARCHAR(50) NOT NULL,
  icon VARCHAR(50),
  color VARCHAR(7),
  position INTEGER DEFAULT 0,
  -- Usage
  is_active BOOLEAN DEFAULT true,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quick_filters_user ON quick_filter_presets (user_id);
CREATE INDEX idx_quick_filters_category ON quick_filter_presets (category);
CREATE INDEX idx_quick_filters_system ON quick_filter_presets (user_id) WHERE user_id IS NULL;

-- Daily aggregated metrics for trend analysis
CREATE TABLE IF NOT EXISTS activity_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL,
  -- Scope
  scope_type VARCHAR(50) NOT NULL DEFAULT 'global', -- 'global', 'region', 'operator'
  scope_value VARCHAR(255), -- Region name or operator ID
  -- Aircraft metrics
  total_aircraft INTEGER DEFAULT 0,
  unique_aircraft INTEGER DEFAULT 0,
  military_aircraft INTEGER DEFAULT 0,
  civilian_aircraft INTEGER DEFAULT 0,
  -- Flight metrics
  total_flights INTEGER DEFAULT 0,
  total_flight_hours NUMERIC(10, 2) DEFAULT 0,
  avg_flight_duration_minutes INTEGER,
  -- Activity metrics
  formations_detected INTEGER DEFAULT 0,
  anomalies_detected INTEGER DEFAULT 0,
  alerts_generated INTEGER DEFAULT 0,
  -- Threat metrics
  high_threat_events INTEGER DEFAULT 0,
  avg_threat_score NUMERIC(5, 4),
  max_threat_score NUMERIC(5, 4),
  -- Position metrics
  total_positions INTEGER DEFAULT 0,
  positions_per_aircraft NUMERIC(10, 2),
  -- Breakdown by type
  aircraft_type_breakdown JSONB DEFAULT '{}', -- {type: count}
  formation_type_breakdown JSONB DEFAULT '{}',
  intent_breakdown JSONB DEFAULT '{}',
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_date, scope_type, scope_value)
);

CREATE INDEX idx_activity_metrics_date ON activity_metrics (metric_date DESC);
CREATE INDEX idx_activity_metrics_scope ON activity_metrics (scope_type, scope_value);
CREATE INDEX idx_activity_metrics_global ON activity_metrics (metric_date DESC)
  WHERE scope_type = 'global';

-- ================================================
-- POSTGIS HELPER FUNCTIONS
-- ================================================

-- Calculate context score for a position
CREATE OR REPLACE FUNCTION calculate_position_context(
  p_lat NUMERIC,
  p_lon NUMERIC,
  p_altitude INTEGER DEFAULT NULL
)
RETURNS TABLE (
  infrastructure_score NUMERIC,
  airspace_score NUMERIC,
  activity_score NUMERIC,
  combined_score NUMERIC,
  nearest_infrastructure_name VARCHAR,
  nearest_infrastructure_distance_nm NUMERIC,
  containing_airspace TEXT[],
  activity_zone_level VARCHAR
) AS $$
DECLARE
  v_point GEOMETRY;
  v_infra_score NUMERIC := 0;
  v_airspace_score NUMERIC := 0;
  v_activity_score NUMERIC := 0;
  v_nearest_infra_name VARCHAR;
  v_nearest_infra_dist NUMERIC;
  v_airspace_list TEXT[];
  v_activity_level VARCHAR;
BEGIN
  -- Create point geometry
  v_point := ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326);

  -- Calculate infrastructure score (inverse distance weighting)
  SELECT
    i.name,
    ST_Distance(i.location::geography, v_point::geography) / 1852 AS dist_nm, -- Convert meters to nm
    CASE i.strategic_importance
      WHEN 'critical' THEN 1.0
      WHEN 'high' THEN 0.8
      WHEN 'medium' THEN 0.5
      ELSE 0.3
    END * GREATEST(0, 1 - (ST_Distance(i.location::geography, v_point::geography) / 1852 / 100)) -- Decay over 100nm
  INTO v_nearest_infra_name, v_nearest_infra_dist, v_infra_score
  FROM infrastructure i
  WHERE i.is_active = true
  ORDER BY ST_Distance(i.location::geography, v_point::geography)
  LIMIT 1;

  -- Calculate airspace score
  SELECT
    ARRAY_AGG(a.name),
    MAX(CASE a.airspace_class
      WHEN 'prohibited' THEN 1.0
      WHEN 'restricted' THEN 0.9
      WHEN 'danger' THEN 0.8
      WHEN 'moa' THEN 0.7
      WHEN 'warning' THEN 0.6
      WHEN 'alert' THEN 0.5
      ELSE 0.2
    END)
  INTO v_airspace_list, v_airspace_score
  FROM airspace a
  WHERE a.is_active = true
    AND ST_Contains(a.geom, v_point)
    AND (a.lower_limit_ft IS NULL OR p_altitude IS NULL OR p_altitude >= a.lower_limit_ft)
    AND (a.upper_limit_ft IS NULL OR p_altitude IS NULL OR p_altitude <= a.upper_limit_ft);

  -- Calculate activity zone score
  SELECT
    az.activity_level,
    CASE az.activity_level
      WHEN 'intense' THEN 1.0
      WHEN 'high' THEN 0.8
      WHEN 'moderate' THEN 0.5
      ELSE 0.2
    END
  INTO v_activity_level, v_activity_score
  FROM activity_zones az
  WHERE az.is_active = true
    AND ST_Contains(az.geom, v_point)
  ORDER BY
    CASE az.activity_level
      WHEN 'intense' THEN 4
      WHEN 'high' THEN 3
      WHEN 'moderate' THEN 2
      ELSE 1
    END DESC
  LIMIT 1;

  -- Return results
  RETURN QUERY SELECT
    COALESCE(v_infra_score, 0)::NUMERIC,
    COALESCE(v_airspace_score, 0)::NUMERIC,
    COALESCE(v_activity_score, 0)::NUMERIC,
    -- Combined score with weights: infra 0.35, airspace 0.35, activity 0.30
    (COALESCE(v_infra_score, 0) * 0.35 +
     COALESCE(v_airspace_score, 0) * 0.35 +
     COALESCE(v_activity_score, 0) * 0.30)::NUMERIC,
    v_nearest_infra_name,
    v_nearest_infra_dist,
    v_airspace_list,
    v_activity_level;
END;
$$ LANGUAGE plpgsql;

-- Get aircraft within radius of a point
CREATE OR REPLACE FUNCTION get_aircraft_in_radius(
  p_lat NUMERIC,
  p_lon NUMERIC,
  p_radius_nm NUMERIC DEFAULT 50
)
RETURNS TABLE (
  icao_hex VARCHAR,
  distance_nm NUMERIC,
  bearing INTEGER,
  latitude NUMERIC,
  longitude NUMERIC,
  altitude INTEGER,
  ground_speed INTEGER,
  heading INTEGER
) AS $$
DECLARE
  v_point GEOMETRY;
  v_radius_m NUMERIC;
BEGIN
  v_point := ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326);
  v_radius_m := p_radius_nm * 1852; -- Convert nm to meters

  RETURN QUERY
  SELECT
    pl.icao_hex,
    (ST_Distance(
      ST_SetSRID(ST_MakePoint(pl.longitude, pl.latitude), 4326)::geography,
      v_point::geography
    ) / 1852)::NUMERIC AS distance_nm,
    DEGREES(ST_Azimuth(
      v_point::geography,
      ST_SetSRID(ST_MakePoint(pl.longitude, pl.latitude), 4326)::geography
    ))::INTEGER AS bearing,
    pl.latitude,
    pl.longitude,
    pl.altitude,
    pl.ground_speed,
    pl.track::INTEGER
  FROM positions_latest pl
  WHERE ST_DWithin(
    ST_SetSRID(ST_MakePoint(pl.longitude, pl.latitude), 4326)::geography,
    v_point::geography,
    v_radius_m
  )
  ORDER BY distance_nm;
END;
$$ LANGUAGE plpgsql;

-- Decay co-occurrence scores (to be called daily)
CREATE OR REPLACE FUNCTION decay_cooccurrence_scores(
  p_decay_rate NUMERIC DEFAULT 0.05
)
RETURNS INTEGER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE aircraft_cooccurrences
  SET
    weighted_score = weighted_score * (1 - p_decay_rate),
    updated_at = NOW()
  WHERE weighted_score > 0.01; -- Don't update near-zero scores

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Clean up very old/low-score entries
  DELETE FROM aircraft_cooccurrences
  WHERE weighted_score < 0.01
    AND last_seen_together < NOW() - INTERVAL '90 days';

  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- UPDATE TIMESTAMP TRIGGERS
-- ================================================

CREATE OR REPLACE FUNCTION update_intelligence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER operator_groups_updated_at
  BEFORE UPDATE ON operator_groups
  FOR EACH ROW EXECUTE FUNCTION update_intelligence_timestamp();

CREATE TRIGGER aircraft_cooccurrences_updated_at
  BEFORE UPDATE ON aircraft_cooccurrences
  FOR EACH ROW EXECUTE FUNCTION update_intelligence_timestamp();

CREATE TRIGGER aircraft_relationships_updated_at
  BEFORE UPDATE ON aircraft_relationships
  FOR EACH ROW EXECUTE FUNCTION update_intelligence_timestamp();

CREATE TRIGGER activity_zones_updated_at
  BEFORE UPDATE ON activity_zones
  FOR EACH ROW EXECUTE FUNCTION update_intelligence_timestamp();

CREATE TRIGGER saved_searches_updated_at
  BEFORE UPDATE ON saved_searches
  FOR EACH ROW EXECUTE FUNCTION update_intelligence_timestamp();

CREATE TRIGGER dashboard_layouts_updated_at
  BEFORE UPDATE ON dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION update_intelligence_timestamp();

CREATE TRIGGER activity_metrics_updated_at
  BEFORE UPDATE ON activity_metrics
  FOR EACH ROW EXECUTE FUNCTION update_intelligence_timestamp();

-- ================================================
-- ROW LEVEL SECURITY
-- ================================================

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_filter_presets ENABLE ROW LEVEL SECURITY;

-- Users can only see their own saved searches (and shared ones)
CREATE POLICY saved_searches_user_policy ON saved_searches
  FOR ALL USING (
    user_id = auth.uid()
    OR is_shared = true
    OR auth.uid() = ANY(shared_with)
  );

-- Users can only manage their own dashboard layouts
CREATE POLICY dashboard_layouts_user_policy ON dashboard_layouts
  FOR ALL USING (user_id = auth.uid());

-- Quick filter presets: users see system presets and their own
CREATE POLICY quick_filter_presets_policy ON quick_filter_presets
  FOR ALL USING (user_id IS NULL OR user_id = auth.uid());

-- Service role bypass for all tables
CREATE POLICY proximity_warnings_service_policy ON proximity_warnings
  FOR ALL TO service_role USING (true);

CREATE POLICY trajectory_predictions_service_policy ON trajectory_predictions
  FOR ALL TO service_role USING (true);

CREATE POLICY formation_predictions_service_policy ON formation_predictions
  FOR ALL TO service_role USING (true);

CREATE POLICY operator_groups_service_policy ON operator_groups
  FOR ALL TO service_role USING (true);

CREATE POLICY aircraft_cooccurrences_service_policy ON aircraft_cooccurrences
  FOR ALL TO service_role USING (true);

CREATE POLICY aircraft_relationships_service_policy ON aircraft_relationships
  FOR ALL TO service_role USING (true);

CREATE POLICY network_analysis_service_policy ON network_analysis_results
  FOR ALL TO service_role USING (true);

CREATE POLICY infrastructure_service_policy ON infrastructure
  FOR ALL TO service_role USING (true);

CREATE POLICY airspace_service_policy ON airspace
  FOR ALL TO service_role USING (true);

CREATE POLICY activity_zones_service_policy ON activity_zones
  FOR ALL TO service_role USING (true);

CREATE POLICY position_context_service_policy ON position_context_cache
  FOR ALL TO service_role USING (true);

CREATE POLICY saved_searches_service_policy ON saved_searches
  FOR ALL TO service_role USING (true);

CREATE POLICY dashboard_layouts_service_policy ON dashboard_layouts
  FOR ALL TO service_role USING (true);

CREATE POLICY quick_filters_service_policy ON quick_filter_presets
  FOR ALL TO service_role USING (true);

CREATE POLICY activity_metrics_service_policy ON activity_metrics
  FOR ALL TO service_role USING (true);

CREATE POLICY prediction_validation_service_policy ON prediction_validation_stats
  FOR ALL TO service_role USING (true);

-- ================================================
-- DEFAULT DATA
-- ================================================

-- Insert default quick filter presets
INSERT INTO quick_filter_presets (user_id, name, category, filters, label, icon, color, position)
VALUES
  (NULL, 'Fighters', 'aircraft_type', '{"aircraft_types": ["F16", "F15", "F18", "F22", "F35"]}', 'Fighters', 'Crosshair', '#ef4444', 1),
  (NULL, 'Tankers', 'aircraft_type', '{"aircraft_types": ["KC135", "KC10", "KC46", "KC130"]}', 'Tankers', 'Fuel', '#f59e0b', 2),
  (NULL, 'ISR', 'aircraft_type', '{"aircraft_types": ["RC135", "EP3", "U2", "RQ4", "MQ9", "P8"]}', 'ISR', 'Eye', '#8b5cf6', 3),
  (NULL, 'Transport', 'aircraft_type', '{"aircraft_types": ["C17", "C5M", "C130", "C30J", "A400"]}', 'Transport', 'Truck', '#3b82f6', 4),
  (NULL, 'AWACS', 'aircraft_type', '{"aircraft_types": ["E3TF", "E3CF", "E767", "E7WW"]}', 'AWACS', 'Radio', '#10b981', 5),
  (NULL, 'Helicopters', 'aircraft_type', '{"aircraft_types": ["H60", "UH60", "AH64", "CH47", "V22"]}', 'Helicopters', 'Plane', '#06b6d4', 6),
  (NULL, 'High Threat', 'threat_level', '{"threat_levels": ["high", "critical"]}', 'High Threat', 'AlertTriangle', '#dc2626', 10),
  (NULL, 'In Formation', 'status', '{"in_formation": true}', 'In Formation', 'Users', '#7c3aed', 11),
  (NULL, 'Anomalous', 'status', '{"has_anomaly": true}', 'Anomalous', 'AlertCircle', '#ea580c', 12)
ON CONFLICT DO NOTHING;

-- ================================================
-- COMMENTS
-- ================================================

COMMENT ON TABLE trajectory_predictions IS 'Position forecasts at 5/15/30 minute horizons';
COMMENT ON TABLE proximity_warnings IS 'Conflict alerts between converging aircraft';
COMMENT ON TABLE formation_predictions IS 'Predicted formation compositions and join probabilities';
COMMENT ON TABLE prediction_validation_stats IS 'Accuracy metrics for prediction model improvement';

COMMENT ON TABLE operator_groups IS 'Normalized operator/unit groupings with callsign patterns';
COMMENT ON TABLE aircraft_cooccurrences IS 'Co-flight tracking matrix for relationship inference';
COMMENT ON TABLE aircraft_relationships IS 'Inferred and confirmed aircraft relationships';
COMMENT ON TABLE network_analysis_results IS 'Centrality and community detection results';

COMMENT ON TABLE infrastructure IS 'Military bases, airports, and strategic assets (PostGIS)';
COMMENT ON TABLE airspace IS 'Airspace polygons with classification and vertical limits';
COMMENT ON TABLE activity_zones IS 'Dynamic high-activity clusters detected from position data';
COMMENT ON TABLE position_context_cache IS 'Pre-computed context scores for grid cells';

COMMENT ON TABLE saved_searches IS 'User-saved filter combinations for quick access';
COMMENT ON TABLE dashboard_layouts IS 'Widget positions and configurations per user';
COMMENT ON TABLE quick_filter_presets IS 'System and user quick filter buttons';
COMMENT ON TABLE activity_metrics IS 'Daily aggregated metrics for trend analysis';

COMMENT ON FUNCTION calculate_position_context IS 'Calculate infrastructure, airspace, and activity scores for a position';
COMMENT ON FUNCTION get_aircraft_in_radius IS 'Get all aircraft within specified radius of a point';
COMMENT ON FUNCTION decay_cooccurrence_scores IS 'Apply daily decay to co-occurrence weighted scores';
