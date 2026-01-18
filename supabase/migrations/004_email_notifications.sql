-- ============================================
-- EMAIL NOTIFICATIONS MIGRATION
-- ============================================

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE,
    email_notifications BOOLEAN DEFAULT true,
    email_frequency VARCHAR(20) DEFAULT 'immediate' CHECK (email_frequency IN ('immediate', 'hourly', 'daily', 'weekly')),
    notification_types JSONB DEFAULT '["high_confidence_match", "watchlist_aircraft"]',
    min_confidence_threshold DECIMAL(3,2) DEFAULT 0.70 CHECK (min_confidence_threshold >= 0 AND min_confidence_threshold <= 1),
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_email ON user_preferences(email_notifications) WHERE email_notifications = true;

-- Email queue table
CREATE TABLE IF NOT EXISTS email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
    email_type VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    content JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_queue_status ON email_queue(status) WHERE status = 'pending';
CREATE INDEX idx_email_queue_user ON email_queue(user_id);
CREATE INDEX idx_email_queue_created ON email_queue(created_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Users can manage their own preferences
CREATE POLICY "Users can view own preferences" ON user_preferences
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON user_preferences
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON user_preferences
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Users can view their own email queue
CREATE POLICY "Users can view own emails" ON email_queue
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access user_preferences" ON user_preferences
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access email_queue" ON email_queue
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- UPDATE TRIGGER for preferences
-- ============================================

CREATE TRIGGER trigger_user_preferences_updated
BEFORE UPDATE ON user_preferences
FOR EACH ROW
EXECUTE FUNCTION update_watchlist_timestamp();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get user's email preferences
CREATE OR REPLACE FUNCTION get_user_email_preferences(p_user_id UUID)
RETURNS TABLE (
    email_notifications BOOLEAN,
    email_frequency VARCHAR(20),
    notification_types JSONB,
    min_confidence_threshold DECIMAL(3,2),
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(up.email_notifications, true),
        COALESCE(up.email_frequency, 'immediate'::VARCHAR(20)),
        COALESCE(up.notification_types, '["high_confidence_match", "watchlist_aircraft"]'::JSONB),
        COALESCE(up.min_confidence_threshold, 0.70::DECIMAL(3,2)),
        up.quiet_hours_start,
        up.quiet_hours_end,
        COALESCE(up.timezone, 'UTC'::VARCHAR(50))
    FROM user_preferences up
    WHERE up.user_id = p_user_id;

    -- Return defaults if no preferences exist
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            true::BOOLEAN,
            'immediate'::VARCHAR(20),
            '["high_confidence_match", "watchlist_aircraft"]'::JSONB,
            0.70::DECIMAL(3,2),
            NULL::TIME,
            NULL::TIME,
            'UTC'::VARCHAR(50);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check if notification should be sent
CREATE OR REPLACE FUNCTION should_send_notification(
    p_user_id UUID,
    p_alert_type VARCHAR(50),
    p_confidence DECIMAL(3,2) DEFAULT 0
) RETURNS BOOLEAN AS $$
DECLARE
    v_prefs RECORD;
    v_current_time TIME;
BEGIN
    SELECT * INTO v_prefs FROM get_user_email_preferences(p_user_id);

    -- Check if email notifications are enabled
    IF NOT v_prefs.email_notifications THEN
        RETURN false;
    END IF;

    -- Check if this notification type is enabled
    IF NOT (v_prefs.notification_types ? p_alert_type) THEN
        RETURN false;
    END IF;

    -- Check confidence threshold
    IF p_confidence > 0 AND p_confidence < v_prefs.min_confidence_threshold THEN
        RETURN false;
    END IF;

    -- Check quiet hours
    IF v_prefs.quiet_hours_start IS NOT NULL AND v_prefs.quiet_hours_end IS NOT NULL THEN
        v_current_time := (NOW() AT TIME ZONE v_prefs.timezone)::TIME;
        IF v_prefs.quiet_hours_start < v_prefs.quiet_hours_end THEN
            -- Normal range (e.g., 22:00 to 06:00)
            IF v_current_time >= v_prefs.quiet_hours_start OR v_current_time < v_prefs.quiet_hours_end THEN
                RETURN false;
            END IF;
        ELSE
            -- Wrapped range (e.g., 22:00 to 06:00 spanning midnight)
            IF v_current_time >= v_prefs.quiet_hours_start OR v_current_time < v_prefs.quiet_hours_end THEN
                RETURN false;
            END IF;
        END IF;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- NOTIFICATION TYPES REFERENCE
-- ============================================
-- high_confidence_match: Correlations with confidence > threshold
-- watchlist_aircraft: Aircraft matching watchlist items
-- new_correlation: Any new correlation
-- unusual_pattern: Unusual flight patterns detected
-- breaking_news: Breaking news events
-- region_activity: Activity in regions of interest
-- daily_digest: Daily summary email
-- weekly_digest: Weekly summary email
