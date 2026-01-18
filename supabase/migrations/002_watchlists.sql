-- ============================================
-- WATCHLISTS MIGRATION
-- ============================================

-- Watchlists table
CREATE TABLE IF NOT EXISTS watchlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_watchlists_user ON watchlists(user_id);
CREATE INDEX idx_watchlists_active ON watchlists(is_active) WHERE is_active = TRUE;

-- Watchlist items table
CREATE TABLE IF NOT EXISTS watchlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    watchlist_id UUID REFERENCES watchlists(id) ON DELETE CASCADE,
    match_type VARCHAR(20) NOT NULL CHECK (match_type IN ('icao_hex', 'registration', 'callsign_pattern', 'type_code')),
    match_value VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    notes TEXT,
    alert_on_detection BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_watchlist_items_watchlist ON watchlist_items(watchlist_id);
CREATE INDEX idx_watchlist_items_match ON watchlist_items(match_type, match_value);
CREATE INDEX idx_watchlist_items_priority ON watchlist_items(priority);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;

-- Users can manage their own watchlists
CREATE POLICY "Users can view own watchlists" ON watchlists
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchlists" ON watchlists
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watchlists" ON watchlists
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchlists" ON watchlists
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Watchlist items inherit access from parent watchlist
CREATE POLICY "Users can view own watchlist items" ON watchlist_items
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM watchlists w
        WHERE w.id = watchlist_items.watchlist_id
        AND w.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert own watchlist items" ON watchlist_items
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM watchlists w
        WHERE w.id = watchlist_items.watchlist_id
        AND w.user_id = auth.uid()
    ));

CREATE POLICY "Users can update own watchlist items" ON watchlist_items
    FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM watchlists w
        WHERE w.id = watchlist_items.watchlist_id
        AND w.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete own watchlist items" ON watchlist_items
    FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM watchlists w
        WHERE w.id = watchlist_items.watchlist_id
        AND w.user_id = auth.uid()
    ));

-- Service role full access
CREATE POLICY "Service role full access watchlists" ON watchlists
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access watchlist_items" ON watchlist_items
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- HELPER FUNCTION: Check aircraft against watchlists
-- ============================================

CREATE OR REPLACE FUNCTION check_aircraft_watchlist(
    p_icao_hex VARCHAR(6),
    p_registration VARCHAR(20),
    p_callsign VARCHAR(20),
    p_type_code VARCHAR(10)
) RETURNS TABLE (
    watchlist_id UUID,
    watchlist_name VARCHAR(100),
    item_id UUID,
    match_type VARCHAR(20),
    match_value VARCHAR(50),
    priority VARCHAR(20),
    notes TEXT,
    user_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        w.id as watchlist_id,
        w.name as watchlist_name,
        wi.id as item_id,
        wi.match_type,
        wi.match_value,
        wi.priority,
        wi.notes,
        w.user_id
    FROM watchlists w
    JOIN watchlist_items wi ON wi.watchlist_id = w.id
    WHERE w.is_active = true
    AND wi.alert_on_detection = true
    AND (
        (wi.match_type = 'icao_hex' AND UPPER(p_icao_hex) = UPPER(wi.match_value))
        OR (wi.match_type = 'registration' AND UPPER(p_registration) = UPPER(wi.match_value))
        OR (wi.match_type = 'callsign_pattern' AND UPPER(p_callsign) LIKE UPPER(wi.match_value))
        OR (wi.match_type = 'type_code' AND UPPER(p_type_code) = UPPER(wi.match_value))
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UPDATE TRIGGER for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_watchlist_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_watchlists_updated
BEFORE UPDATE ON watchlists
FOR EACH ROW
EXECUTE FUNCTION update_watchlist_timestamp();
