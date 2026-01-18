-- Migration: Geofence Alerts
-- Description: Add custom polygon geofences with entry/exit/dwell detection

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- ================================================
-- Geofences Table
-- ================================================
CREATE TABLE IF NOT EXISTS geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  -- PostGIS geometry for polygon
  geom GEOMETRY(Polygon, 4326) NOT NULL,
  -- Alert configuration
  alert_on_entry BOOLEAN DEFAULT true,
  alert_on_exit BOOLEAN DEFAULT true,
  alert_on_dwell BOOLEAN DEFAULT true,
  dwell_threshold_seconds INTEGER DEFAULT 300, -- 5 minutes default
  -- Visual styling
  fill_color VARCHAR(7) DEFAULT '#3b82f6',
  fill_opacity NUMERIC(3,2) DEFAULT 0.2,
  stroke_color VARCHAR(7) DEFAULT '#3b82f6',
  stroke_width INTEGER DEFAULT 2,
  -- Filtering options
  military_only BOOLEAN DEFAULT true,
  aircraft_types TEXT[], -- Filter by aircraft type codes
  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for spatial queries
CREATE INDEX idx_geofences_geom ON geofences USING GIST (geom);
CREATE INDEX idx_geofences_user ON geofences (user_id);
CREATE INDEX idx_geofences_active ON geofences (is_active) WHERE is_active = true;

-- ================================================
-- Geofence Aircraft State Table
-- Track entry/exit/dwell states per aircraft per geofence
-- ================================================
CREATE TABLE IF NOT EXISTS geofence_aircraft_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geofence_id UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  icao_hex VARCHAR(6) NOT NULL,
  -- State tracking
  state VARCHAR(20) NOT NULL DEFAULT 'outside', -- 'outside', 'inside', 'dwelling'
  entered_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  dwell_start_at TIMESTAMPTZ,
  -- Position when entered
  entry_lat NUMERIC(10, 6),
  entry_lon NUMERIC(10, 6),
  entry_altitude INTEGER,
  -- Current/last known position inside
  last_lat NUMERIC(10, 6),
  last_lon NUMERIC(10, 6),
  last_altitude INTEGER,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Unique constraint per aircraft per geofence
  UNIQUE(geofence_id, icao_hex)
);

CREATE INDEX idx_geofence_state_geofence ON geofence_aircraft_state (geofence_id);
CREATE INDEX idx_geofence_state_icao ON geofence_aircraft_state (icao_hex);
CREATE INDEX idx_geofence_state_active ON geofence_aircraft_state (state) WHERE state != 'outside';

-- ================================================
-- Geofence Alerts Table
-- Alert history for geofence events
-- ================================================
CREATE TABLE IF NOT EXISTS geofence_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geofence_id UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  icao_hex VARCHAR(6) NOT NULL,
  -- Alert details
  alert_type VARCHAR(20) NOT NULL, -- 'entry', 'exit', 'dwell'
  severity VARCHAR(20) DEFAULT 'medium',
  -- Aircraft info at time of alert
  callsign VARCHAR(10),
  aircraft_type VARCHAR(10),
  registration VARCHAR(20),
  -- Position info
  lat NUMERIC(10, 6) NOT NULL,
  lon NUMERIC(10, 6) NOT NULL,
  altitude INTEGER,
  speed INTEGER,
  heading INTEGER,
  -- For dwell alerts: how long they've been inside
  dwell_seconds INTEGER,
  -- Status
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_geofence_alerts_geofence ON geofence_alerts (geofence_id);
CREATE INDEX idx_geofence_alerts_user ON geofence_alerts (user_id);
CREATE INDEX idx_geofence_alerts_created ON geofence_alerts (created_at DESC);
CREATE INDEX idx_geofence_alerts_unread ON geofence_alerts (user_id, is_read) WHERE is_read = false;

-- ================================================
-- PostGIS Function: Check Aircraft in Geofences
-- Efficient spatial query for batch checking
-- ================================================
CREATE OR REPLACE FUNCTION check_aircraft_in_geofences(
  p_positions JSONB -- Array of {icao_hex, lat, lon, altitude, callsign, aircraft_type, registration, speed, heading}
)
RETURNS TABLE (
  geofence_id UUID,
  geofence_name VARCHAR(255),
  user_id UUID,
  icao_hex VARCHAR(6),
  lat NUMERIC,
  lon NUMERIC,
  altitude INTEGER,
  callsign VARCHAR(10),
  aircraft_type VARCHAR(10),
  registration VARCHAR(20),
  speed INTEGER,
  heading INTEGER,
  alert_on_entry BOOLEAN,
  alert_on_exit BOOLEAN,
  alert_on_dwell BOOLEAN,
  dwell_threshold_seconds INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH positions AS (
    SELECT
      (p->>'icao_hex')::VARCHAR(6) AS icao_hex,
      (p->>'lat')::NUMERIC AS lat,
      (p->>'lon')::NUMERIC AS lon,
      (p->>'altitude')::INTEGER AS altitude,
      (p->>'callsign')::VARCHAR(10) AS callsign,
      (p->>'aircraft_type')::VARCHAR(10) AS aircraft_type,
      (p->>'registration')::VARCHAR(20) AS registration,
      (p->>'speed')::INTEGER AS speed,
      (p->>'heading')::INTEGER AS heading,
      ST_SetSRID(ST_MakePoint((p->>'lon')::NUMERIC, (p->>'lat')::NUMERIC), 4326) AS point
    FROM jsonb_array_elements(p_positions) AS p
  )
  SELECT
    g.id AS geofence_id,
    g.name AS geofence_name,
    g.user_id,
    pos.icao_hex,
    pos.lat,
    pos.lon,
    pos.altitude,
    pos.callsign,
    pos.aircraft_type,
    pos.registration,
    pos.speed,
    pos.heading,
    g.alert_on_entry,
    g.alert_on_exit,
    g.alert_on_dwell,
    g.dwell_threshold_seconds
  FROM geofences g
  CROSS JOIN positions pos
  WHERE g.is_active = true
    AND ST_Contains(g.geom, pos.point)
    -- Apply military_only filter (if aircraft_type looks military or if we don't have type info)
    AND (
      NOT g.military_only
      OR pos.aircraft_type IS NULL  -- Include unknown types when military_only
      OR pos.aircraft_type = ANY(ARRAY['C17', 'C5M', 'C130', 'C30J', 'A400', 'KC135', 'KC10', 'KC46',
        'E3TF', 'E3CF', 'E767', 'E7WW', 'RC135', 'EP3', 'P8', 'P8A', 'RQ4', 'MQ9', 'U2',
        'F16', 'F15', 'F18', 'F22', 'F35', 'H60', 'UH60', 'AH64', 'CH47', 'V22'])
    )
    -- Apply aircraft_types filter if specified
    AND (
      g.aircraft_types IS NULL
      OR array_length(g.aircraft_types, 1) IS NULL
      OR pos.aircraft_type = ANY(g.aircraft_types)
    );
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- Function: Update Geofence Timestamps
-- ================================================
CREATE OR REPLACE FUNCTION update_geofence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geofences_updated_at
  BEFORE UPDATE ON geofences
  FOR EACH ROW EXECUTE FUNCTION update_geofence_timestamp();

CREATE TRIGGER geofence_state_updated_at
  BEFORE UPDATE ON geofence_aircraft_state
  FOR EACH ROW EXECUTE FUNCTION update_geofence_timestamp();

-- ================================================
-- Row Level Security (RLS)
-- ================================================
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_alerts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own geofences
CREATE POLICY geofences_user_policy ON geofences
  FOR ALL USING (user_id = auth.uid());

-- Users can only see their own alerts
CREATE POLICY geofence_alerts_user_policy ON geofence_alerts
  FOR ALL USING (user_id = auth.uid());

-- Service role bypass for cron jobs
CREATE POLICY geofences_service_policy ON geofences
  FOR ALL TO service_role USING (true);

CREATE POLICY geofence_alerts_service_policy ON geofence_alerts
  FOR ALL TO service_role USING (true);

CREATE POLICY geofence_state_service_policy ON geofence_aircraft_state
  FOR ALL TO service_role USING (true);

-- ================================================
-- Helper View: Active Geofences with Stats
-- ================================================
CREATE OR REPLACE VIEW geofences_with_stats AS
SELECT
  g.*,
  ST_AsGeoJSON(g.geom)::jsonb AS geom_geojson,
  ST_Area(g.geom::geography) / 1000000 AS area_km2, -- Area in square kilometers
  (SELECT COUNT(*) FROM geofence_aircraft_state gas
   WHERE gas.geofence_id = g.id AND gas.state != 'outside') AS aircraft_inside,
  (SELECT COUNT(*) FROM geofence_alerts ga
   WHERE ga.geofence_id = g.id AND ga.created_at > NOW() - INTERVAL '24 hours') AS alerts_24h
FROM geofences g;

COMMENT ON TABLE geofences IS 'User-defined polygon geofences for aircraft monitoring';
COMMENT ON TABLE geofence_aircraft_state IS 'Tracks aircraft entry/exit/dwell state per geofence';
COMMENT ON TABLE geofence_alerts IS 'History of geofence alert events';
COMMENT ON FUNCTION check_aircraft_in_geofences IS 'Efficiently checks which aircraft are inside which geofences';
