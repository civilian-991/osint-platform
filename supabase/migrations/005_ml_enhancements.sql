-- ML/AI Enhancement Tables Migration
-- This migration adds pgvector, ML processing queue, behavioral profiles,
-- anomaly detection, intent classification, threat assessment, and smart alerting

-- ============================================
-- ENABLE PGVECTOR EXTENSION
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- EMBEDDINGS TABLE (pgvector storage for semantic search)
-- ============================================
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL, -- 'news_event', 'aircraft', 'correlation'
    entity_id UUID NOT NULL,
    embedding vector(768) NOT NULL,
    model VARCHAR(100) DEFAULT 'text-embedding-004',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_type, entity_id)
);

CREATE INDEX idx_embeddings_entity ON embeddings(entity_type, entity_id);
CREATE INDEX idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- ANOMALY DETECTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS anomaly_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aircraft_id UUID REFERENCES aircraft(id) ON DELETE CASCADE,
    flight_id UUID REFERENCES flights(id) ON DELETE SET NULL,
    anomaly_type VARCHAR(50) NOT NULL, -- 'speed', 'altitude', 'route', 'timing', 'formation', 'behavior'
    severity DOUBLE PRECISION NOT NULL CHECK (severity >= 0 AND severity <= 1),
    detected_value JSONB NOT NULL, -- The observed anomalous values
    expected_value JSONB, -- What was expected based on profile
    deviation_score DOUBLE PRECISION, -- How far from normal
    analysis TEXT, -- Gemini-generated analysis
    confidence DOUBLE PRECISION DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_anomaly_aircraft ON anomaly_detections(aircraft_id);
CREATE INDEX idx_anomaly_type ON anomaly_detections(anomaly_type);
CREATE INDEX idx_anomaly_severity ON anomaly_detections(severity DESC);
CREATE INDEX idx_anomaly_created ON anomaly_detections(created_at DESC);
CREATE INDEX idx_anomaly_unacknowledged ON anomaly_detections(is_acknowledged) WHERE is_acknowledged = FALSE;

-- ============================================
-- INTENT CLASSIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS intent_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aircraft_id UUID REFERENCES aircraft(id) ON DELETE CASCADE,
    flight_id UUID REFERENCES flights(id) ON DELETE SET NULL,
    intent VARCHAR(50) NOT NULL, -- 'training', 'patrol', 'refueling', 'surveillance', 'combat', 'transit', 'exercise'
    confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    evidence JSONB DEFAULT '[]', -- Array of evidence items
    reasoning TEXT, -- Gemini-generated reasoning
    alternative_intents JSONB DEFAULT '[]', -- Other possible intents with lower confidence
    model_version VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_intent_aircraft ON intent_classifications(aircraft_id);
CREATE INDEX idx_intent_flight ON intent_classifications(flight_id);
CREATE INDEX idx_intent_type ON intent_classifications(intent);
CREATE INDEX idx_intent_confidence ON intent_classifications(confidence DESC);
CREATE INDEX idx_intent_created ON intent_classifications(created_at DESC);

-- ============================================
-- THREAT ASSESSMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS threat_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL, -- 'aircraft', 'region', 'news_event', 'correlation'
    entity_id UUID NOT NULL,
    threat_score DOUBLE PRECISION NOT NULL CHECK (threat_score >= 0 AND threat_score <= 1),
    threat_level VARCHAR(20) NOT NULL, -- 'minimal', 'low', 'elevated', 'high', 'critical'

    -- Component scores with weights
    pattern_anomaly_score DOUBLE PRECISION DEFAULT 0,
    regional_tension_score DOUBLE PRECISION DEFAULT 0,
    news_correlation_score DOUBLE PRECISION DEFAULT 0,
    historical_context_score DOUBLE PRECISION DEFAULT 0,
    formation_activity_score DOUBLE PRECISION DEFAULT 0,

    factors JSONB DEFAULT '{}', -- Detailed breakdown of factors
    analysis TEXT, -- Gemini-generated threat analysis
    recommendations JSONB DEFAULT '[]', -- Suggested actions
    confidence DOUBLE PRECISION DEFAULT 0.5,
    valid_until TIMESTAMPTZ, -- When this assessment expires
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(entity_type, entity_id)
);

CREATE INDEX idx_threat_entity ON threat_assessments(entity_type, entity_id);
CREATE INDEX idx_threat_score ON threat_assessments(threat_score DESC);
CREATE INDEX idx_threat_level ON threat_assessments(threat_level);
CREATE INDEX idx_threat_valid ON threat_assessments(valid_until);

-- ============================================
-- ARTICLE CORROBORATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS article_corroborations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_a_id UUID REFERENCES news_events(id) ON DELETE CASCADE,
    article_b_id UUID REFERENCES news_events(id) ON DELETE CASCADE,
    similarity_score DOUBLE PRECISION NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
    topic_overlap JSONB DEFAULT '[]', -- Shared topics/entities
    source_diversity_bonus DOUBLE PRECISION DEFAULT 0, -- Bonus for different sources
    temporal_proximity_bonus DOUBLE PRECISION DEFAULT 0, -- Bonus for close timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT different_articles CHECK (article_a_id <> article_b_id),
    UNIQUE(article_a_id, article_b_id)
);

CREATE INDEX idx_corroboration_article_a ON article_corroborations(article_a_id);
CREATE INDEX idx_corroboration_article_b ON article_corroborations(article_b_id);
CREATE INDEX idx_corroboration_similarity ON article_corroborations(similarity_score DESC);

-- ============================================
-- ENHANCED ENTITIES TABLE (Gemini-extracted military entities)
-- ============================================
CREATE TABLE IF NOT EXISTS enhanced_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(50) NOT NULL, -- 'news_event', 'social_post'
    source_id UUID NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'weapon_system', 'military_unit', 'operation_name', 'equipment', 'personnel', 'aircraft'
    entity_name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255), -- Standardized form (e.g., "F-35" -> "F-35A Lightning II")
    confidence DOUBLE PRECISION DEFAULT 0.5,
    context TEXT, -- Surrounding context from source
    metadata JSONB DEFAULT '{}', -- Additional extraction metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enhanced_entities_source ON enhanced_entities(source_type, source_id);
CREATE INDEX idx_enhanced_entities_type ON enhanced_entities(entity_type);
CREATE INDEX idx_enhanced_entities_name ON enhanced_entities(entity_name);
CREATE INDEX idx_enhanced_entities_normalized ON enhanced_entities(normalized_name);

-- ============================================
-- FORMATION DETECTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS formation_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    formation_type VARCHAR(50) NOT NULL, -- 'tanker_receiver', 'escort', 'strike_package', 'cap'
    confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

    -- Aircraft involved
    lead_aircraft_id UUID REFERENCES aircraft(id) ON DELETE SET NULL,
    aircraft_ids UUID[] NOT NULL, -- All aircraft in formation

    -- Formation geometry
    center_lat DOUBLE PRECISION NOT NULL,
    center_lon DOUBLE PRECISION NOT NULL,
    spread_nm DOUBLE PRECISION, -- Formation spread in nautical miles
    heading DOUBLE PRECISION, -- Average heading of formation
    altitude_band_low INTEGER,
    altitude_band_high INTEGER,

    -- Detection metadata
    detection_method VARCHAR(50), -- 'spatial_clustering', 'temporal_correlation', 'gemini_analysis'
    analysis TEXT, -- Gemini analysis if used
    metadata JSONB DEFAULT '{}',

    -- Temporal
    first_detected_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    duration_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (last_seen_at - first_detected_at)) / 60
    ) STORED,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_formation_type ON formation_detections(formation_type);
CREATE INDEX idx_formation_active ON formation_detections(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_formation_aircraft ON formation_detections USING GIN(aircraft_ids);
CREATE INDEX idx_formation_lead ON formation_detections(lead_aircraft_id);
CREATE INDEX idx_formation_created ON formation_detections(created_at DESC);

-- ============================================
-- AIRCRAFT BEHAVIORAL PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS aircraft_behavioral_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aircraft_id UUID REFERENCES aircraft(id) ON DELETE CASCADE UNIQUE,

    -- Pattern distributions (percentages summing to 1)
    typical_patterns JSONB DEFAULT '{"orbit": 0, "racetrack": 0, "holding": 0, "tanker_track": 0, "straight": 0}',

    -- Typical regions (array of {center_lat, center_lon, radius_nm, frequency})
    typical_regions JSONB DEFAULT '[]',

    -- Altitude statistics
    altitude_min INTEGER,
    altitude_max INTEGER,
    altitude_avg DOUBLE PRECISION,
    altitude_stddev DOUBLE PRECISION,

    -- Speed statistics
    speed_min INTEGER,
    speed_max INTEGER,
    speed_avg DOUBLE PRECISION,
    speed_stddev DOUBLE PRECISION,

    -- Activity schedule (24-hour distribution and day-of-week distribution)
    hourly_activity JSONB DEFAULT '{}', -- {0: 0.02, 1: 0.01, ...}
    daily_activity JSONB DEFAULT '{}', -- {monday: 0.15, tuesday: 0.14, ...}

    -- Training metadata
    sample_count INTEGER DEFAULT 0,
    is_trained BOOLEAN DEFAULT FALSE, -- True when sample_count >= 10
    decay_factor DOUBLE PRECISION DEFAULT 0.95,
    last_flight_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profile_aircraft ON aircraft_behavioral_profiles(aircraft_id);
CREATE INDEX idx_profile_trained ON aircraft_behavioral_profiles(is_trained) WHERE is_trained = TRUE;

-- ============================================
-- ALERT INTERACTIONS TABLE (User engagement tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS alert_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    interaction_type VARCHAR(50) NOT NULL, -- 'viewed', 'read', 'dismissed', 'clicked', 'expanded', 'ignored'
    time_to_action_ms INTEGER, -- Time from alert creation to interaction
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interaction_alert ON alert_interactions(alert_id);
CREATE INDEX idx_interaction_user ON alert_interactions(user_id);
CREATE INDEX idx_interaction_type ON alert_interactions(interaction_type);
CREATE INDEX idx_interaction_created ON alert_interactions(created_at DESC);

-- ============================================
-- USER ALERT MODELS TABLE (Learned user preferences)
-- ============================================
CREATE TABLE IF NOT EXISTS user_alert_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,

    -- Preferred alert types (weights)
    type_preferences JSONB DEFAULT '{"new_correlation": 1, "high_confidence_match": 1, "unusual_pattern": 1, "watchlist_aircraft": 1, "breaking_news": 1, "region_activity": 1}',

    -- Preferred regions (weights by region name)
    region_preferences JSONB DEFAULT '{}',

    -- Preferred aircraft types (weights by military_category)
    aircraft_type_preferences JSONB DEFAULT '{}',

    -- Activity patterns (when user is most active)
    active_hours JSONB DEFAULT '{}', -- {0: 0.02, 1: 0.01, ...}
    active_days JSONB DEFAULT '{}', -- {monday: 0.15, ...}

    -- Engagement metrics
    click_through_rate DOUBLE PRECISION DEFAULT 0.5,
    dismiss_rate DOUBLE PRECISION DEFAULT 0.2,
    avg_time_to_action_ms INTEGER DEFAULT 60000,

    -- Learning parameters
    learning_rate DOUBLE PRECISION DEFAULT 0.1,
    decay_rate DOUBLE PRECISION DEFAULT 0.95,
    total_interactions INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_model_user ON user_alert_models(user_id);

-- ============================================
-- GEMINI CACHE TABLE (API response caching)
-- ============================================
CREATE TABLE IF NOT EXISTS gemini_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(64) NOT NULL UNIQUE, -- SHA256 hash of request
    model VARCHAR(100) NOT NULL,
    request_hash VARCHAR(64) NOT NULL, -- Hash of the full request for validation
    response JSONB NOT NULL,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    hits INTEGER DEFAULT 0
);

CREATE INDEX idx_gemini_cache_key ON gemini_cache(cache_key);
CREATE INDEX idx_gemini_cache_expires ON gemini_cache(expires_at);

-- ============================================
-- ML PROCESSING QUEUE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ml_processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type VARCHAR(50) NOT NULL, -- 'anomaly_detection', 'formation_detection', 'entity_extraction', 'embedding_generation', 'intent_classification', 'threat_assessment'
    entity_type VARCHAR(50) NOT NULL, -- 'aircraft', 'news_event', 'positions', 'correlation'
    entity_id UUID NOT NULL,
    payload JSONB DEFAULT '{}', -- Task-specific data
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10), -- 1 = highest
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ml_queue_status ON ml_processing_queue(status);
CREATE INDEX idx_ml_queue_scheduled ON ml_processing_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_ml_queue_priority ON ml_processing_queue(priority ASC, scheduled_for ASC) WHERE status = 'pending';
CREATE INDEX idx_ml_queue_entity ON ml_processing_queue(entity_type, entity_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to find similar articles using pgvector
CREATE OR REPLACE FUNCTION find_similar_articles(
    p_article_id UUID,
    p_limit INTEGER DEFAULT 5,
    p_min_similarity DOUBLE PRECISION DEFAULT 0.7
)
RETURNS TABLE (
    article_id UUID,
    title TEXT,
    similarity DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ne.id AS article_id,
        ne.title,
        1 - (e2.embedding <=> e1.embedding) AS similarity
    FROM embeddings e1
    JOIN embeddings e2 ON e2.entity_type = 'news_event' AND e2.entity_id <> e1.entity_id
    JOIN news_events ne ON ne.id = e2.entity_id
    WHERE e1.entity_type = 'news_event'
    AND e1.entity_id = p_article_id
    AND 1 - (e2.embedding <=> e1.embedding) >= p_min_similarity
    ORDER BY e2.embedding <=> e1.embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate corroboration score for a news event
CREATE OR REPLACE FUNCTION calculate_corroboration_score(p_news_event_id UUID)
RETURNS DOUBLE PRECISION AS $$
DECLARE
    base_score DOUBLE PRECISION := 0.3;
    count_bonus DOUBLE PRECISION := 0;
    diversity_bonus DOUBLE PRECISION := 0;
    similarity_bonus DOUBLE PRECISION := 0;
    similar_count INTEGER;
    unique_sources INTEGER;
    avg_similarity DOUBLE PRECISION;
    final_score DOUBLE PRECISION;
BEGIN
    -- Count similar articles
    SELECT
        COUNT(*),
        AVG(ac.similarity_score),
        COUNT(DISTINCT SPLIT_PART(ne.url, '/', 3))
    INTO similar_count, avg_similarity, unique_sources
    FROM article_corroborations ac
    JOIN news_events ne ON (ne.id = ac.article_b_id OR ne.id = ac.article_a_id)
    WHERE (ac.article_a_id = p_news_event_id OR ac.article_b_id = p_news_event_id)
    AND ac.similarity_score >= 0.7;

    -- Calculate bonuses
    IF similar_count > 0 THEN
        -- Count bonus (max 0.2 for 5+ articles)
        count_bonus := LEAST(similar_count * 0.04, 0.2);

        -- Diversity bonus (max 0.2 for 4+ unique sources)
        diversity_bonus := LEAST(unique_sources * 0.05, 0.2);

        -- Similarity bonus (max 0.3 for very high similarity)
        similarity_bonus := COALESCE(avg_similarity, 0) * 0.3;
    END IF;

    final_score := base_score + count_bonus + diversity_bonus + similarity_bonus;
    RETURN LEAST(final_score, 1.0);
END;
$$ LANGUAGE plpgsql;

-- Function to get threat level from score
CREATE OR REPLACE FUNCTION get_threat_level(score DOUBLE PRECISION)
RETURNS VARCHAR(20) AS $$
BEGIN
    IF score < 0.2 THEN RETURN 'minimal';
    ELSIF score < 0.4 THEN RETURN 'low';
    ELSIF score < 0.6 THEN RETURN 'elevated';
    ELSIF score < 0.8 THEN RETURN 'high';
    ELSE RETURN 'critical';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to queue ML task
CREATE OR REPLACE FUNCTION queue_ml_task(
    p_task_type VARCHAR(50),
    p_entity_type VARCHAR(50),
    p_entity_id UUID,
    p_payload JSONB DEFAULT '{}',
    p_priority INTEGER DEFAULT 5
)
RETURNS UUID AS $$
DECLARE
    task_id UUID;
BEGIN
    INSERT INTO ml_processing_queue (task_type, entity_type, entity_id, payload, priority)
    VALUES (p_task_type, p_entity_type, p_entity_id, p_payload, p_priority)
    ON CONFLICT DO NOTHING
    RETURNING id INTO task_id;

    RETURN task_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get next ML task to process
CREATE OR REPLACE FUNCTION get_next_ml_task()
RETURNS TABLE (
    id UUID,
    task_type VARCHAR(50),
    entity_type VARCHAR(50),
    entity_id UUID,
    payload JSONB,
    priority INTEGER,
    attempts INTEGER
) AS $$
DECLARE
    task_record RECORD;
BEGIN
    -- Get and lock the next available task
    SELECT * INTO task_record
    FROM ml_processing_queue q
    WHERE q.status = 'pending'
    AND q.scheduled_for <= NOW()
    AND q.attempts < q.max_attempts
    ORDER BY q.priority ASC, q.scheduled_for ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF task_record IS NOT NULL THEN
        -- Mark as processing
        UPDATE ml_processing_queue
        SET status = 'processing', started_at = NOW(), attempts = attempts + 1
        WHERE ml_processing_queue.id = task_record.id;

        RETURN QUERY SELECT
            task_record.id,
            task_record.task_type,
            task_record.entity_type,
            task_record.entity_id,
            task_record.payload,
            task_record.priority,
            task_record.attempts + 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to complete ML task
CREATE OR REPLACE FUNCTION complete_ml_task(
    p_task_id UUID,
    p_success BOOLEAN,
    p_error TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    IF p_success THEN
        UPDATE ml_processing_queue
        SET status = 'completed', completed_at = NOW()
        WHERE id = p_task_id;
    ELSE
        UPDATE ml_processing_queue
        SET status = CASE
            WHEN attempts >= max_attempts THEN 'failed'
            ELSE 'pending'
        END,
        last_error = p_error,
        scheduled_for = NOW() + INTERVAL '1 minute' * POWER(2, attempts) -- Exponential backoff
        WHERE id = p_task_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired cache
CREATE OR REPLACE FUNCTION clean_expired_gemini_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM gemini_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_corroborations ENABLE ROW LEVEL SECURITY;
ALTER TABLE enhanced_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE formation_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE aircraft_behavioral_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alert_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE gemini_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_processing_queue ENABLE ROW LEVEL SECURITY;

-- Public read access for ML results (authenticated users)
CREATE POLICY "Allow authenticated read for embeddings" ON embeddings
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read for anomaly_detections" ON anomaly_detections
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read for intent_classifications" ON intent_classifications
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read for threat_assessments" ON threat_assessments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read for article_corroborations" ON article_corroborations
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read for enhanced_entities" ON enhanced_entities
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read for formation_detections" ON formation_detections
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read for aircraft_behavioral_profiles" ON aircraft_behavioral_profiles
    FOR SELECT TO authenticated USING (true);

-- User-specific alert models
CREATE POLICY "Users can view own alert_models" ON user_alert_models
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own alert_models" ON user_alert_models
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- User-specific alert interactions
CREATE POLICY "Users can view own interactions" ON alert_interactions
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interactions" ON alert_interactions
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access embeddings" ON embeddings
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access anomaly_detections" ON anomaly_detections
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access intent_classifications" ON intent_classifications
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access threat_assessments" ON threat_assessments
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access article_corroborations" ON article_corroborations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access enhanced_entities" ON enhanced_entities
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access formation_detections" ON formation_detections
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access aircraft_behavioral_profiles" ON aircraft_behavioral_profiles
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access alert_interactions" ON alert_interactions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access user_alert_models" ON user_alert_models
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access gemini_cache" ON gemini_cache
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access ml_processing_queue" ON ml_processing_queue
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE anomaly_detections;
ALTER PUBLICATION supabase_realtime ADD TABLE formation_detections;
ALTER PUBLICATION supabase_realtime ADD TABLE threat_assessments;
