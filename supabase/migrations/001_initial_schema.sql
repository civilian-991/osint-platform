-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- AIRCRAFT TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS aircraft (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    icao_hex VARCHAR(6) UNIQUE NOT NULL,
    registration VARCHAR(20),
    type_code VARCHAR(10),
    type_description VARCHAR(255),
    operator VARCHAR(255),
    country VARCHAR(100),
    is_military BOOLEAN DEFAULT FALSE,
    military_category VARCHAR(50),
    watchlist_category VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_aircraft_icao ON aircraft(icao_hex);
CREATE INDEX idx_aircraft_military ON aircraft(is_military) WHERE is_military = TRUE;
CREATE INDEX idx_aircraft_type ON aircraft(type_code);
CREATE INDEX idx_aircraft_country ON aircraft(country);

-- ============================================
-- POSITIONS TABLE (Time-series with partitioning)
-- ============================================
CREATE TABLE IF NOT EXISTS positions (
    id UUID DEFAULT gen_random_uuid(),
    aircraft_id UUID REFERENCES aircraft(id) ON DELETE CASCADE,
    icao_hex VARCHAR(6) NOT NULL,
    callsign VARCHAR(20),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    altitude INTEGER,
    ground_speed INTEGER,
    track SMALLINT,
    vertical_rate INTEGER,
    squawk VARCHAR(4),
    on_ground BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMPTZ NOT NULL,
    source VARCHAR(50) DEFAULT 'adsb.lol',
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create partitions for current and next month
CREATE TABLE positions_2026_01 PARTITION OF positions
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE positions_2026_02 PARTITION OF positions
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE positions_2026_03 PARTITION OF positions
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE INDEX idx_positions_aircraft ON positions(aircraft_id);
CREATE INDEX idx_positions_icao ON positions(icao_hex);
CREATE INDEX idx_positions_timestamp ON positions(timestamp DESC);
CREATE INDEX idx_positions_geom ON positions USING GIST(geom);

-- ============================================
-- POSITIONS LATEST (Real-time current positions)
-- ============================================
CREATE TABLE IF NOT EXISTS positions_latest (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aircraft_id UUID REFERENCES aircraft(id) ON DELETE CASCADE,
    icao_hex VARCHAR(6) UNIQUE NOT NULL,
    callsign VARCHAR(20),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    altitude INTEGER,
    ground_speed INTEGER,
    track SMALLINT,
    vertical_rate INTEGER,
    squawk VARCHAR(4),
    on_ground BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMPTZ NOT NULL,
    source VARCHAR(50) DEFAULT 'adsb.lol',
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED
);

CREATE INDEX idx_positions_latest_geom ON positions_latest USING GIST(geom);
CREATE INDEX idx_positions_latest_timestamp ON positions_latest(timestamp DESC);

-- ============================================
-- FLIGHTS TABLE (Aggregated flight records)
-- ============================================
CREATE TABLE IF NOT EXISTS flights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aircraft_id UUID REFERENCES aircraft(id) ON DELETE CASCADE,
    callsign VARCHAR(20),
    departure_time TIMESTAMPTZ,
    arrival_time TIMESTAMPTZ,
    departure_airport VARCHAR(10),
    arrival_airport VARCHAR(10),
    route_geom GEOMETRY(LineString, 4326),
    max_altitude INTEGER,
    flight_type VARCHAR(50),
    pattern_detected VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flights_aircraft ON flights(aircraft_id);
CREATE INDEX idx_flights_times ON flights(departure_time, arrival_time);
CREATE INDEX idx_flights_geom ON flights USING GIST(route_geom);

-- ============================================
-- NEWS EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS news_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(50) NOT NULL,
    source_id VARCHAR(255),
    title TEXT NOT NULL,
    content TEXT,
    url TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    language VARCHAR(10),
    countries TEXT[] DEFAULT '{}',
    locations JSONB DEFAULT '[]',
    entities JSONB DEFAULT '[]',
    categories TEXT[] DEFAULT '{}',
    sentiment_score DOUBLE PRECISION,
    credibility_score DOUBLE PRECISION DEFAULT 0.5,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source, source_id)
);

CREATE INDEX idx_news_published ON news_events(published_at DESC);
CREATE INDEX idx_news_source ON news_events(source);
CREATE INDEX idx_news_countries ON news_events USING GIN(countries);
CREATE INDEX idx_news_title_trgm ON news_events USING GIN(title gin_trgm_ops);

-- ============================================
-- CORRELATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS correlations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    news_event_id UUID REFERENCES news_events(id) ON DELETE CASCADE,
    flight_id UUID REFERENCES flights(id) ON DELETE SET NULL,
    aircraft_id UUID REFERENCES aircraft(id) ON DELETE SET NULL,
    correlation_type VARCHAR(50) NOT NULL,
    confidence_score DOUBLE PRECISION NOT NULL,
    temporal_score DOUBLE PRECISION DEFAULT 0,
    spatial_score DOUBLE PRECISION DEFAULT 0,
    entity_score DOUBLE PRECISION DEFAULT 0,
    pattern_score DOUBLE PRECISION DEFAULT 0,
    corroboration_score DOUBLE PRECISION DEFAULT 0,
    evidence JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    verified_by UUID,
    verified_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_correlations_news ON correlations(news_event_id);
CREATE INDEX idx_correlations_flight ON correlations(flight_id);
CREATE INDEX idx_correlations_confidence ON correlations(confidence_score DESC);
CREATE INDEX idx_correlations_status ON correlations(status);

-- ============================================
-- REGIONS OF INTEREST TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS regions_of_interest (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    geom GEOMETRY(Polygon, 4326) NOT NULL,
    center_lat DOUBLE PRECISION NOT NULL,
    center_lon DOUBLE PRECISION NOT NULL,
    radius_nm DOUBLE PRECISION,
    is_active BOOLEAN DEFAULT TRUE,
    alert_on_entry BOOLEAN DEFAULT TRUE,
    alert_on_pattern BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_regions_geom ON regions_of_interest USING GIST(geom);
CREATE INDEX idx_regions_active ON regions_of_interest(is_active) WHERE is_active = TRUE;

-- ============================================
-- ALERTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    correlation_id UUID REFERENCES correlations(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX idx_alerts_unread ON alerts(user_id, is_read) WHERE is_read = FALSE;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update positions_latest on new position insert
CREATE OR REPLACE FUNCTION update_positions_latest()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO positions_latest (
        aircraft_id, icao_hex, callsign, latitude, longitude,
        altitude, ground_speed, track, vertical_rate, squawk,
        on_ground, timestamp, source
    ) VALUES (
        NEW.aircraft_id, NEW.icao_hex, NEW.callsign, NEW.latitude, NEW.longitude,
        NEW.altitude, NEW.ground_speed, NEW.track, NEW.vertical_rate, NEW.squawk,
        NEW.on_ground, NEW.timestamp, NEW.source
    )
    ON CONFLICT (icao_hex) DO UPDATE SET
        aircraft_id = EXCLUDED.aircraft_id,
        callsign = EXCLUDED.callsign,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        altitude = EXCLUDED.altitude,
        ground_speed = EXCLUDED.ground_speed,
        track = EXCLUDED.track,
        vertical_rate = EXCLUDED.vertical_rate,
        squawk = EXCLUDED.squawk,
        on_ground = EXCLUDED.on_ground,
        timestamp = EXCLUDED.timestamp,
        source = EXCLUDED.source
    WHERE positions_latest.timestamp < EXCLUDED.timestamp;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for positions_latest updates
CREATE TRIGGER trigger_update_positions_latest
AFTER INSERT ON positions
FOR EACH ROW
EXECUTE FUNCTION update_positions_latest();

-- Function to calculate distance in nautical miles
CREATE OR REPLACE FUNCTION distance_nm(
    lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
BEGIN
    RETURN ST_DistanceSphere(
        ST_MakePoint(lon1, lat1),
        ST_MakePoint(lon2, lat2)
    ) / 1852.0;  -- meters to nautical miles
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get aircraft within radius
CREATE OR REPLACE FUNCTION get_aircraft_in_radius(
    center_lat DOUBLE PRECISION,
    center_lon DOUBLE PRECISION,
    radius_nm DOUBLE PRECISION
) RETURNS TABLE (
    icao_hex VARCHAR,
    callsign VARCHAR,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    altitude INTEGER,
    ground_speed INTEGER,
    track SMALLINT,
    distance_nm DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pl.icao_hex,
        pl.callsign,
        pl.latitude,
        pl.longitude,
        pl.altitude,
        pl.ground_speed,
        pl.track,
        distance_nm(center_lat, center_lon, pl.latitude, pl.longitude) as distance
    FROM positions_latest pl
    WHERE ST_DWithin(
        pl.geom::geography,
        ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326)::geography,
        radius_nm * 1852  -- nm to meters
    )
    ORDER BY distance;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE aircraft ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions_latest ENABLE ROW LEVEL SECURITY;
ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions_of_interest ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Public read access for aircraft and positions (authenticated users)
CREATE POLICY "Allow authenticated read for aircraft" ON aircraft
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read for positions" ON positions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read for positions_latest" ON positions_latest
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read for flights" ON flights
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read for news_events" ON news_events
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read for correlations" ON correlations
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read for regions" ON regions_of_interest
    FOR SELECT TO authenticated USING (true);

-- Alerts are user-specific
CREATE POLICY "Users can view own alerts" ON alerts
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts" ON alerts
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role full access aircraft" ON aircraft
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access positions" ON positions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access positions_latest" ON positions_latest
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access flights" ON flights
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access news_events" ON news_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access correlations" ON correlations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access regions" ON regions_of_interest
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access alerts" ON alerts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

-- Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE positions_latest;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE correlations;

-- ============================================
-- SEED DATA: Regions of Interest
-- ============================================

INSERT INTO regions_of_interest (name, description, center_lat, center_lon, radius_nm, geom) VALUES
('Lebanon', 'Lebanese airspace', 33.85, 35.86, 100,
 ST_Buffer(ST_SetSRID(ST_MakePoint(35.86, 33.85), 4326)::geography, 185200)::geometry),
('Israel', 'Israeli airspace', 31.77, 35.23, 100,
 ST_Buffer(ST_SetSRID(ST_MakePoint(35.23, 31.77), 4326)::geography, 185200)::geometry),
('Cyprus', 'Cyprus airspace', 35.13, 33.43, 80,
 ST_Buffer(ST_SetSRID(ST_MakePoint(33.43, 35.13), 4326)::geography, 148160)::geometry),
('Syria', 'Syrian airspace', 34.80, 38.99, 150,
 ST_Buffer(ST_SetSRID(ST_MakePoint(38.99, 34.80), 4326)::geography, 277800)::geometry),
('Iran', 'Iranian airspace', 32.43, 53.69, 400,
 ST_Buffer(ST_SetSRID(ST_MakePoint(53.69, 32.43), 4326)::geography, 740800)::geometry),
('Iraq', 'Iraqi airspace', 33.31, 44.37, 200,
 ST_Buffer(ST_SetSRID(ST_MakePoint(44.37, 33.31), 4326)::geography, 370400)::geometry),
('Turkey', 'Turkish airspace', 39.93, 32.86, 300,
 ST_Buffer(ST_SetSRID(ST_MakePoint(32.86, 39.93), 4326)::geography, 555600)::geometry),
('Egypt', 'Egyptian airspace', 26.82, 30.80, 250,
 ST_Buffer(ST_SetSRID(ST_MakePoint(30.80, 26.82), 4326)::geography, 463000)::geometry),
('GCC', 'Gulf Cooperation Council region', 24.47, 54.37, 400,
 ST_Buffer(ST_SetSRID(ST_MakePoint(54.37, 24.47), 4326)::geography, 740800)::geometry);
