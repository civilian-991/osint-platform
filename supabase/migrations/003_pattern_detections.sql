-- ============================================
-- PATTERN DETECTIONS MIGRATION
-- ============================================

-- Pattern detections table
CREATE TABLE IF NOT EXISTS pattern_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flight_id UUID REFERENCES flights(id) ON DELETE CASCADE,
    aircraft_id UUID REFERENCES aircraft(id) ON DELETE CASCADE,
    pattern_type VARCHAR(20) NOT NULL CHECK (pattern_type IN ('orbit', 'racetrack', 'holding', 'tanker_track', 'spiral', 'search')),
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    center_lat DECIMAL(10,6),
    center_lon DECIMAL(10,6),
    radius_nm DECIMAL(8,2),
    duration_minutes INTEGER,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pattern_detections_flight ON pattern_detections(flight_id);
CREATE INDEX idx_pattern_detections_aircraft ON pattern_detections(aircraft_id);
CREATE INDEX idx_pattern_detections_type ON pattern_detections(pattern_type);
CREATE INDEX idx_pattern_detections_confidence ON pattern_detections(confidence DESC);
CREATE INDEX idx_pattern_detections_time ON pattern_detections(start_time, end_time);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE pattern_detections ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read pattern detections
CREATE POLICY "Allow authenticated read for pattern_detections" ON pattern_detections
    FOR SELECT TO authenticated USING (true);

-- Service role full access
CREATE POLICY "Service role full access pattern_detections" ON pattern_detections
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- PATTERN METADATA JSONB STRUCTURE
-- ============================================
-- The metadata field stores additional pattern-specific data:
--
-- For 'orbit':
-- {
--   "fitted_radius_nm": 12.5,
--   "angular_velocity_deg_per_min": 3.2,
--   "direction": "clockwise" | "counterclockwise",
--   "num_revolutions": 2.5,
--   "center_precision": 0.85
-- }
--
-- For 'racetrack':
-- {
--   "leg_length_nm": 25.0,
--   "leg_width_nm": 5.0,
--   "heading_leg1": 90,
--   "heading_leg2": 270,
--   "num_legs": 6,
--   "average_turn_radius_nm": 3.5
-- }
--
-- For 'holding':
-- {
--   "hold_point": {"lat": 33.5, "lon": 35.2},
--   "inbound_heading": 180,
--   "turn_direction": "right",
--   "leg_time_seconds": 60,
--   "altitude_variation_ft": 200
-- }
--
-- For 'tanker_track':
-- {
--   "track_heading": 90,
--   "track_length_nm": 80,
--   "altitude_fl": 250,
--   "refueling_altitude_band": [240, 260],
--   "estimated_receivers": 2
-- }
--
-- For 'spiral':
-- {
--   "direction": "ascending" | "descending",
--   "start_altitude": 35000,
--   "end_altitude": 15000,
--   "turns": 5,
--   "descent_rate_fpm": 2000
-- }
--
-- For 'search':
-- {
--   "search_pattern_type": "expanding_square" | "sector" | "creeping_line",
--   "coverage_area_nm2": 500,
--   "track_spacing_nm": 2,
--   "search_altitude": 5000
-- }

-- ============================================
-- HELPER FUNCTION: Get recent patterns for aircraft
-- ============================================

CREATE OR REPLACE FUNCTION get_aircraft_patterns(
    p_aircraft_id UUID,
    p_hours INTEGER DEFAULT 24
) RETURNS TABLE (
    id UUID,
    pattern_type VARCHAR(20),
    confidence DECIMAL(3,2),
    center_lat DECIMAL(10,6),
    center_lon DECIMAL(10,6),
    radius_nm DECIMAL(8,2),
    duration_minutes INTEGER,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pd.id,
        pd.pattern_type,
        pd.confidence,
        pd.center_lat,
        pd.center_lon,
        pd.radius_nm,
        pd.duration_minutes,
        pd.start_time,
        pd.end_time,
        pd.metadata
    FROM pattern_detections pd
    WHERE pd.aircraft_id = p_aircraft_id
    AND pd.created_at > NOW() - (p_hours || ' hours')::INTERVAL
    ORDER BY pd.confidence DESC, pd.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER FUNCTION: Get patterns in region
-- ============================================

CREATE OR REPLACE FUNCTION get_patterns_in_region(
    p_lat DOUBLE PRECISION,
    p_lon DOUBLE PRECISION,
    p_radius_nm DOUBLE PRECISION,
    p_hours INTEGER DEFAULT 24
) RETURNS TABLE (
    id UUID,
    aircraft_id UUID,
    pattern_type VARCHAR(20),
    confidence DECIMAL(3,2),
    center_lat DECIMAL(10,6),
    center_lon DECIMAL(10,6),
    radius_nm DECIMAL(8,2),
    duration_minutes INTEGER,
    distance_nm DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pd.id,
        pd.aircraft_id,
        pd.pattern_type,
        pd.confidence,
        pd.center_lat,
        pd.center_lon,
        pd.radius_nm,
        pd.duration_minutes,
        distance_nm(p_lat, p_lon, pd.center_lat::DOUBLE PRECISION, pd.center_lon::DOUBLE PRECISION) as distance
    FROM pattern_detections pd
    WHERE pd.center_lat IS NOT NULL
    AND pd.center_lon IS NOT NULL
    AND pd.created_at > NOW() - (p_hours || ' hours')::INTERVAL
    AND distance_nm(p_lat, p_lon, pd.center_lat::DOUBLE PRECISION, pd.center_lon::DOUBLE PRECISION) <= p_radius_nm
    ORDER BY pd.confidence DESC;
END;
$$ LANGUAGE plpgsql;
