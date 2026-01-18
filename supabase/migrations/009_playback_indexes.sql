-- Migration: Historical Playback Indexes
-- Description: Add indexes for efficient time-range queries for playback feature

-- Index for time-range queries on positions table
-- Optimizes queries like: SELECT * FROM positions WHERE timestamp BETWEEN x AND y AND icao_hex = z
CREATE INDEX IF NOT EXISTS idx_positions_time_icao
ON positions (timestamp, icao_hex);

-- Partial index for recent positions (last 24 hours) - most common query pattern
-- This significantly speeds up recent position lookups
CREATE INDEX IF NOT EXISTS idx_positions_recent
ON positions (timestamp DESC, icao_hex)
WHERE timestamp > NOW() - INTERVAL '24 hours';

-- Index for positions_latest to speed up playback initialization
CREATE INDEX IF NOT EXISTS idx_positions_latest_timestamp
ON positions_latest (timestamp DESC);

-- Index for fetching aircraft tracks efficiently
CREATE INDEX IF NOT EXISTS idx_positions_icao_time
ON positions (icao_hex, timestamp DESC);

-- Function to get sampled positions for playback
-- Returns positions at a specified sampling interval to reduce data volume
CREATE OR REPLACE FUNCTION get_sampled_positions(
  p_icao_hex VARCHAR(6),
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_sample_interval_seconds INTEGER DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  icao_hex VARCHAR(6),
  callsign VARCHAR(10),
  latitude NUMERIC,
  longitude NUMERIC,
  altitude INTEGER,
  ground_speed INTEGER,
  track INTEGER,
  vertical_rate INTEGER,
  timestamp TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH numbered_positions AS (
    SELECT
      p.*,
      ROW_NUMBER() OVER (
        PARTITION BY
          p.icao_hex,
          FLOOR(EXTRACT(EPOCH FROM p.timestamp) / p_sample_interval_seconds)
        ORDER BY p.timestamp
      ) AS rn
    FROM positions p
    WHERE p.icao_hex = p_icao_hex
      AND p.timestamp BETWEEN p_start_time AND p_end_time
  )
  SELECT
    np.id,
    np.icao_hex,
    np.callsign,
    np.latitude,
    np.longitude,
    np.altitude,
    np.ground_speed,
    np.track,
    np.vertical_rate,
    np.timestamp
  FROM numbered_positions np
  WHERE np.rn = 1
  ORDER BY np.timestamp;
END;
$$ LANGUAGE plpgsql;

-- Function to get all aircraft positions in a time range (for multi-aircraft playback)
CREATE OR REPLACE FUNCTION get_playback_positions(
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_sample_interval_seconds INTEGER DEFAULT 30,
  p_military_only BOOLEAN DEFAULT true
)
RETURNS TABLE (
  icao_hex VARCHAR(6),
  callsign VARCHAR(10),
  latitude NUMERIC,
  longitude NUMERIC,
  altitude INTEGER,
  ground_speed INTEGER,
  track INTEGER,
  timestamp TIMESTAMPTZ,
  aircraft_type VARCHAR(10),
  military_category VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  WITH sampled AS (
    SELECT
      p.icao_hex,
      p.callsign,
      p.latitude,
      p.longitude,
      p.altitude,
      p.ground_speed,
      p.track,
      p.timestamp,
      a.type_code AS aircraft_type,
      a.military_category,
      ROW_NUMBER() OVER (
        PARTITION BY
          p.icao_hex,
          FLOOR(EXTRACT(EPOCH FROM p.timestamp) / p_sample_interval_seconds)
        ORDER BY p.timestamp
      ) AS rn
    FROM positions p
    JOIN aircraft a ON p.icao_hex = a.icao_hex
    WHERE p.timestamp BETWEEN p_start_time AND p_end_time
      AND p.latitude IS NOT NULL
      AND p.longitude IS NOT NULL
      AND (NOT p_military_only OR a.is_military = true)
  )
  SELECT
    s.icao_hex,
    s.callsign,
    s.latitude,
    s.longitude,
    s.altitude,
    s.ground_speed,
    s.track,
    s.timestamp,
    s.aircraft_type,
    s.military_category
  FROM sampled s
  WHERE s.rn = 1
  ORDER BY s.timestamp;
END;
$$ LANGUAGE plpgsql;

-- Function to get timeline events (news, correlations) for a time range
CREATE OR REPLACE FUNCTION get_timeline_events(
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  event_id UUID,
  event_type VARCHAR(50),
  event_time TIMESTAMPTZ,
  title TEXT,
  description TEXT,
  severity VARCHAR(20),
  latitude NUMERIC,
  longitude NUMERIC,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  -- News events
  SELECT
    ne.id AS event_id,
    'news'::VARCHAR(50) AS event_type,
    ne.published_at AS event_time,
    ne.title,
    LEFT(ne.summary, 200) AS description,
    CASE
      WHEN ne.sentiment < -0.5 THEN 'high'
      WHEN ne.sentiment < 0 THEN 'medium'
      ELSE 'low'
    END::VARCHAR(20) AS severity,
    ne.location_lat AS latitude,
    ne.location_lon AS longitude,
    jsonb_build_object(
      'source', ne.source,
      'credibility', ne.credibility_score,
      'sentiment', ne.sentiment
    ) AS metadata
  FROM news_events ne
  WHERE ne.published_at BETWEEN p_start_time AND p_end_time
    AND ne.location_lat IS NOT NULL

  UNION ALL

  -- Correlation events
  SELECT
    c.id AS event_id,
    'correlation'::VARCHAR(50) AS event_type,
    c.created_at AS event_time,
    COALESCE(ne.title, 'Correlation Event') AS title,
    'Flight-news correlation detected' AS description,
    CASE
      WHEN c.confidence_score > 0.8 THEN 'high'
      WHEN c.confidence_score > 0.5 THEN 'medium'
      ELSE 'low'
    END::VARCHAR(20) AS severity,
    ne.location_lat AS latitude,
    ne.location_lon AS longitude,
    jsonb_build_object(
      'confidence', c.confidence_score,
      'correlation_type', c.correlation_type,
      'flight_id', c.flight_id
    ) AS metadata
  FROM correlations c
  LEFT JOIN news_events ne ON c.news_event_id = ne.id
  WHERE c.created_at BETWEEN p_start_time AND p_end_time

  UNION ALL

  -- Strike events
  SELECT
    se.id AS event_id,
    'strike'::VARCHAR(50) AS event_type,
    se.event_time AS event_time,
    se.headline AS title,
    se.summary AS description,
    se.severity::VARCHAR(20) AS severity,
    se.latitude,
    se.longitude,
    jsonb_build_object(
      'location_name', se.location_name,
      'source', se.source,
      'is_confirmed', se.is_confirmed
    ) AS metadata
  FROM strike_events se
  WHERE se.event_time BETWEEN p_start_time AND p_end_time

  ORDER BY event_time
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_sampled_positions IS 'Get positions for a single aircraft with time-based sampling';
COMMENT ON FUNCTION get_playback_positions IS 'Get positions for all aircraft with time-based sampling for playback';
COMMENT ON FUNCTION get_timeline_events IS 'Get news, correlations, and strikes for timeline display';
