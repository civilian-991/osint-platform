-- ============================================
-- TELEGRAM CHANNEL MONITORING
-- ============================================

-- Telegram channels to monitor
CREATE TABLE IF NOT EXISTS telegram_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_username VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    description TEXT,
    category VARCHAR(50) DEFAULT 'general', -- military, aviation, news, osint
    language VARCHAR(10) DEFAULT 'en',
    is_active BOOLEAN DEFAULT TRUE,
    last_fetched_at TIMESTAMPTZ,
    last_message_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Telegram messages/posts
CREATE TABLE IF NOT EXISTS telegram_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES telegram_channels(id) ON DELETE CASCADE,
    message_id BIGINT NOT NULL,
    content TEXT,
    media_type VARCHAR(50), -- text, photo, video, document
    media_url TEXT,
    views INTEGER,
    forwards INTEGER,
    reply_to_message_id BIGINT,
    posted_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    -- ML processing
    is_processed BOOLEAN DEFAULT FALSE,
    sentiment_score FLOAT,
    relevance_score FLOAT,
    extracted_entities JSONB DEFAULT '[]',
    UNIQUE(channel_id, message_id)
);

CREATE INDEX idx_telegram_messages_channel ON telegram_messages(channel_id);
CREATE INDEX idx_telegram_messages_posted ON telegram_messages(posted_at DESC);
CREATE INDEX idx_telegram_messages_unprocessed ON telegram_messages(is_processed) WHERE is_processed = FALSE;

-- RSS/Other feeds to monitor
CREATE TABLE IF NOT EXISTS intel_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_type VARCHAR(50) NOT NULL, -- rss, twitter, telegram, custom
    feed_url TEXT NOT NULL,
    display_name VARCHAR(255),
    category VARCHAR(50) DEFAULT 'general',
    is_active BOOLEAN DEFAULT TRUE,
    fetch_interval_minutes INTEGER DEFAULT 15,
    last_fetched_at TIMESTAMPTZ,
    last_item_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feed items (unified storage for all feed types)
CREATE TABLE IF NOT EXISTS intel_feed_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_id UUID REFERENCES intel_feeds(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    title TEXT,
    content TEXT,
    url TEXT,
    author TEXT,
    media_urls JSONB DEFAULT '[]',
    published_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    -- ML processing
    is_processed BOOLEAN DEFAULT FALSE,
    sentiment_score FLOAT,
    relevance_score FLOAT,
    threat_relevance FLOAT,
    extracted_entities JSONB DEFAULT '[]',
    UNIQUE(feed_id, external_id)
);

CREATE INDEX idx_intel_feed_items_feed ON intel_feed_items(feed_id);
CREATE INDEX idx_intel_feed_items_published ON intel_feed_items(published_at DESC);

-- Pre-populate with relevant Telegram channels
INSERT INTO telegram_channels (channel_username, display_name, category, language) VALUES
    -- Military/Aviation OSINT
    ('inikiforov', 'Military Aircraft Tracker', 'aviation', 'en'),
    ('aircraft_spots', 'Aircraft Spots', 'aviation', 'en'),
    ('MIL_Radar', 'Military Radar', 'aviation', 'en'),
    ('air_intel', 'Air Intelligence', 'aviation', 'en'),
    -- Middle East News
    ('MENewsEN', 'Middle East News', 'news', 'en'),
    ('iran_intel', 'Iran Intel', 'news', 'en'),
    ('IsraelRadar_News', 'Israel Radar', 'news', 'en'),
    ('CIG_telegram', 'Conflicts Intel Group', 'military', 'en'),
    ('inikiforov_en', 'Military Intel EN', 'military', 'en'),
    -- OSINT
    ('osikiforov', 'OSINT Updates', 'osint', 'en'),
    ('GeoConfirmed', 'GeoConfirmed', 'osint', 'en')
ON CONFLICT (channel_username) DO NOTHING;

-- Pre-populate with RSS feeds
INSERT INTO intel_feeds (feed_type, feed_url, display_name, category) VALUES
    ('rss', 'https://www.flightradar24.com/blog/feed/', 'Flightradar24 Blog', 'aviation'),
    ('rss', 'https://theaviationist.com/feed/', 'The Aviationist', 'aviation'),
    ('rss', 'https://www.airlive.net/feed/', 'Air Live', 'aviation'),
    ('rss', 'https://www.janes.com/feeds/news', 'Janes Defence', 'military'),
    ('rss', 'https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml', 'Defense News', 'military')
ON CONFLICT DO NOTHING;
