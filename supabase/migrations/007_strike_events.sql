-- ============================================
-- STRIKE/EVENT TRACKING
-- ============================================

-- Real-time strike and security events
CREATE TABLE IF NOT EXISTS strike_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL, -- airstrike, rocket, drone, explosion, gunfire
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    location_name VARCHAR(255),
    region VARCHAR(100),
    description TEXT,
    source_type VARCHAR(50), -- telegram, news, manual
    source_id UUID, -- Reference to telegram_messages or news_events
    source_channel VARCHAR(100),
    confidence FLOAT DEFAULT 0.5, -- 0-1 confidence in location accuracy
    reported_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ, -- When to stop showing on map
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Simple lat/lon indexes for spatial queries
CREATE INDEX idx_strike_events_lat ON strike_events(latitude);
CREATE INDEX idx_strike_events_lon ON strike_events(longitude);
CREATE INDEX idx_strike_events_active ON strike_events(is_active, reported_at DESC);
CREATE INDEX idx_strike_events_region ON strike_events(region);
CREATE INDEX idx_strike_events_type ON strike_events(event_type);

-- Known locations for geocoding strike reports
CREATE TABLE IF NOT EXISTS known_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255), -- Arabic name
    name_he VARCHAR(255), -- Hebrew name
    aliases TEXT[], -- Alternative names
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    region VARCHAR(100),
    country VARCHAR(100),
    location_type VARCHAR(50), -- city, town, village, area, military_base
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_known_locations_name ON known_locations(LOWER(name));
CREATE INDEX idx_known_locations_region ON known_locations(region);

-- Pre-populate with common locations in Lebanon, Israel, Syria, Iran
INSERT INTO known_locations (name, name_ar, latitude, longitude, region, country, location_type) VALUES
    -- Lebanon
    ('Beirut', 'بيروت', 33.8938, 35.5018, 'Lebanon', 'Lebanon', 'city'),
    ('Dahieh', 'الضاحية', 33.8547, 35.5097, 'Lebanon', 'Lebanon', 'area'),
    ('Baalbek', 'بعلبك', 34.0047, 36.2110, 'Bekaa', 'Lebanon', 'city'),
    ('Tyre', 'صور', 33.2705, 35.2038, 'South Lebanon', 'Lebanon', 'city'),
    ('Sidon', 'صيدا', 33.5572, 35.3729, 'South Lebanon', 'Lebanon', 'city'),
    ('Nabatieh', 'النبطية', 33.3772, 35.4836, 'South Lebanon', 'Lebanon', 'city'),
    ('Bint Jbeil', 'بنت جبيل', 33.1167, 35.4333, 'South Lebanon', 'Lebanon', 'town'),
    ('Khiam', 'الخيام', 33.2833, 35.5500, 'South Lebanon', 'Lebanon', 'town'),
    ('Marjayoun', 'مرجعيون', 33.3667, 35.5833, 'South Lebanon', 'Lebanon', 'town'),
    ('Hermel', 'الهرمل', 34.3950, 36.3864, 'Bekaa', 'Lebanon', 'town'),
    ('Tripoli', 'طرابلس', 34.4333, 35.8333, 'North Lebanon', 'Lebanon', 'city'),

    -- Israel
    ('Tel Aviv', 'تل أبيب', 32.0853, 34.7818, 'Israel', 'Israel', 'city'),
    ('Haifa', 'حيفا', 32.7940, 34.9896, 'Israel', 'Israel', 'city'),
    ('Jerusalem', 'القدس', 31.7683, 35.2137, 'Israel', 'Israel', 'city'),
    ('Safed', 'صفد', 32.9646, 35.4960, 'Israel', 'Israel', 'city'),
    ('Kiryat Shmona', 'كريات شمونة', 33.2075, 35.5697, 'Israel', 'Israel', 'city'),
    ('Metula', 'المطلة', 33.2778, 35.5778, 'Israel', 'Israel', 'town'),

    -- Syria
    ('Damascus', 'دمشق', 33.5138, 36.2765, 'Syria', 'Syria', 'city'),
    ('Aleppo', 'حلب', 36.2021, 37.1343, 'Syria', 'Syria', 'city'),
    ('Homs', 'حمص', 34.7324, 36.7137, 'Syria', 'Syria', 'city'),
    ('Latakia', 'اللاذقية', 35.5317, 35.7919, 'Syria', 'Syria', 'city'),
    ('Deir ez-Zor', 'دير الزور', 35.3359, 40.1408, 'Syria', 'Syria', 'city'),
    ('Palmyra', 'تدمر', 34.5600, 38.2800, 'Syria', 'Syria', 'city'),
    ('Qusayr', 'القصير', 34.5083, 36.5783, 'Syria', 'Syria', 'town'),

    -- Iran
    ('Tehran', 'طهران', 35.6892, 51.3890, 'Iran', 'Iran', 'city'),
    ('Isfahan', 'اصفهان', 32.6546, 51.6680, 'Iran', 'Iran', 'city'),
    ('Tabriz', 'تبریز', 38.0800, 46.2919, 'Iran', 'Iran', 'city'),
    ('Shiraz', 'شیراز', 29.5918, 52.5837, 'Iran', 'Iran', 'city'),
    ('Natanz', 'نطنز', 33.5125, 51.9164, 'Iran', 'Iran', 'town'),
    ('Fordow', 'فردو', 34.8833, 51.5833, 'Iran', 'Iran', 'area'),
    ('Parchin', 'پارچین', 35.5167, 51.7667, 'Iran', 'Iran', 'military_base'),
    ('Bandar Abbas', 'بندر عباس', 27.1865, 56.2808, 'Iran', 'Iran', 'city'),

    -- Gaza
    ('Gaza City', 'غزة', 31.5017, 34.4668, 'Gaza', 'Palestine', 'city'),
    ('Khan Yunis', 'خان يونس', 31.3462, 34.3032, 'Gaza', 'Palestine', 'city'),
    ('Rafah', 'رفح', 31.2969, 34.2455, 'Gaza', 'Palestine', 'city'),

    -- Yemen
    ('Sanaa', 'صنعاء', 15.3694, 44.1910, 'Yemen', 'Yemen', 'city'),
    ('Hodeidah', 'الحديدة', 14.7979, 42.9540, 'Yemen', 'Yemen', 'city'),

    -- Iraq
    ('Baghdad', 'بغداد', 33.3152, 44.3661, 'Iraq', 'Iraq', 'city'),
    ('Erbil', 'أربيل', 36.1901, 44.0091, 'Iraq', 'Iraq', 'city'),
    ('Basra', 'البصرة', 30.5085, 47.7804, 'Iraq', 'Iraq', 'city')
ON CONFLICT DO NOTHING;

-- Function to find nearest known location
CREATE OR REPLACE FUNCTION find_nearest_location(search_text TEXT)
RETURNS TABLE(
    location_name VARCHAR(255),
    latitude FLOAT,
    longitude FLOAT,
    region VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        kl.name,
        kl.latitude,
        kl.longitude,
        kl.region
    FROM known_locations kl
    WHERE
        LOWER(kl.name) LIKE '%' || LOWER(search_text) || '%'
        OR LOWER(kl.name_ar) LIKE '%' || LOWER(search_text) || '%'
        OR search_text = ANY(kl.aliases)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Auto-expire old strike events
CREATE OR REPLACE FUNCTION expire_old_strikes()
RETURNS void AS $$
BEGIN
    UPDATE strike_events
    SET is_active = FALSE
    WHERE expires_at < NOW() AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;
