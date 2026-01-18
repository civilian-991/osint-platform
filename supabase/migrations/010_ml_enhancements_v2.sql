-- Migration: ML Pipeline Enhancements v2
-- Description: Add confidence calibration, adaptive thresholds, explainability, and prompt versioning

-- ================================================
-- Confidence Calibration
-- Track prediction outcomes for calibration
-- ================================================

CREATE TABLE IF NOT EXISTS ml_prediction_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Reference to the original prediction
  task_type VARCHAR(50) NOT NULL, -- 'anomaly_detection', 'intent_classification', 'threat_assessment'
  entity_type VARCHAR(50) NOT NULL, -- 'aircraft', 'news_event', etc.
  entity_id UUID NOT NULL,
  -- Prediction details
  predicted_class VARCHAR(100),
  predicted_score NUMERIC(5, 4), -- Raw model confidence (0-1)
  calibrated_score NUMERIC(5, 4), -- After calibration
  -- Outcome (ground truth from user feedback or automated verification)
  actual_outcome BOOLEAN, -- true = prediction was correct
  verification_method VARCHAR(50), -- 'user_feedback', 'subsequent_data', 'expert_review'
  verified_by UUID, -- user_id if user feedback
  -- Timestamps
  predicted_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prediction_outcomes_task ON ml_prediction_outcomes (task_type, predicted_at DESC);
CREATE INDEX idx_prediction_outcomes_score ON ml_prediction_outcomes (predicted_score);
CREATE INDEX idx_prediction_outcomes_verified ON ml_prediction_outcomes (verified_at) WHERE verified_at IS NOT NULL;

-- Calibration models (Platt scaling parameters)
CREATE TABLE IF NOT EXISTS confidence_calibration_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type VARCHAR(50) NOT NULL UNIQUE,
  -- Platt scaling parameters: P(y=1|s) = 1 / (1 + exp(A*s + B))
  platt_a NUMERIC(10, 6) DEFAULT -1.0, -- Scale parameter
  platt_b NUMERIC(10, 6) DEFAULT 0.0,  -- Offset parameter
  -- Histogram binning calibration (alternative)
  bin_boundaries NUMERIC[] DEFAULT ARRAY[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]::NUMERIC[],
  bin_calibrated_values NUMERIC[] DEFAULT ARRAY[0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95]::NUMERIC[],
  -- Model metadata
  sample_count INTEGER DEFAULT 0,
  last_calibration_at TIMESTAMPTZ,
  calibration_quality NUMERIC(5, 4), -- ECE (Expected Calibration Error)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Adaptive Thresholds
-- Bayesian threshold management per task type
-- ================================================

CREATE TABLE IF NOT EXISTS adaptive_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Threshold identification
  task_type VARCHAR(50) NOT NULL,
  threshold_name VARCHAR(100) NOT NULL, -- e.g., 'anomaly_detection_high', 'threat_critical'
  -- Bayesian parameters (Beta distribution: Beta(alpha, beta))
  prior_alpha NUMERIC(10, 4) DEFAULT 2.0,
  prior_beta NUMERIC(10, 4) DEFAULT 2.0,
  -- Current threshold value
  current_value NUMERIC(5, 4) NOT NULL,
  -- Bounds
  min_value NUMERIC(5, 4) DEFAULT 0.1,
  max_value NUMERIC(5, 4) DEFAULT 0.9,
  -- Performance tracking
  true_positives INTEGER DEFAULT 0,
  false_positives INTEGER DEFAULT 0,
  true_negatives INTEGER DEFAULT 0,
  false_negatives INTEGER DEFAULT 0,
  -- Metadata
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  last_adjusted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_type, threshold_name)
);

CREATE INDEX idx_adaptive_thresholds_task ON adaptive_thresholds (task_type);
CREATE INDEX idx_adaptive_thresholds_active ON adaptive_thresholds (is_active) WHERE is_active = true;

-- ================================================
-- Explainability
-- Track decision factors for ML predictions
-- ================================================

CREATE TABLE IF NOT EXISTS ml_decision_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Reference to prediction
  task_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  -- Decision details
  decision_type VARCHAR(50) NOT NULL, -- 'anomaly', 'intent', 'threat', 'formation'
  final_score NUMERIC(5, 4),
  final_classification VARCHAR(100),
  -- Factor breakdown
  factors JSONB NOT NULL, -- Array of {name, value, weight, contribution, description}
  -- Feature importance
  top_features JSONB, -- Array of {feature_name, importance, value}
  -- Counterfactual explanation (what would change the outcome)
  counterfactuals JSONB, -- Array of {feature_name, current_value, required_value}
  -- Human-readable explanation
  natural_language_explanation TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decision_explanations_entity ON ml_decision_explanations (entity_type, entity_id);
CREATE INDEX idx_decision_explanations_task ON ml_decision_explanations (task_id);
CREATE INDEX idx_decision_explanations_type ON ml_decision_explanations (decision_type);

-- ================================================
-- Prompt Versioning & A/B Testing
-- Track prompt versions and execution metrics
-- ================================================

CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Prompt identification
  prompt_name VARCHAR(100) NOT NULL, -- e.g., 'entity_extraction', 'intent_classification'
  version INTEGER NOT NULL,
  -- Content
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  -- Configuration
  model_id VARCHAR(100) NOT NULL, -- e.g., 'gemini-2.0-flash', 'gemini-1.5-pro'
  temperature NUMERIC(3, 2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1024,
  -- A/B testing
  is_active BOOLEAN DEFAULT true,
  traffic_percentage INTEGER DEFAULT 100, -- 0-100, for A/B testing
  -- Metadata
  description TEXT,
  change_notes TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(prompt_name, version)
);

CREATE INDEX idx_prompt_versions_name ON prompt_versions (prompt_name, is_active);
CREATE INDEX idx_prompt_versions_active ON prompt_versions (is_active) WHERE is_active = true;

-- Prompt execution logs for performance tracking
CREATE TABLE IF NOT EXISTS prompt_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_version_id UUID NOT NULL REFERENCES prompt_versions(id),
  -- Execution details
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  -- Result quality
  success BOOLEAN NOT NULL,
  error_message TEXT,
  -- Output validation
  output_valid BOOLEAN, -- Passed schema validation
  quality_score NUMERIC(5, 4), -- 0-1 based on automated quality checks
  -- User feedback (if available)
  user_rating INTEGER, -- 1-5
  -- Timestamps
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prompt_logs_version ON prompt_execution_logs (prompt_version_id, executed_at DESC);
CREATE INDEX idx_prompt_logs_success ON prompt_execution_logs (success);

-- ================================================
-- Functions
-- ================================================

-- Apply Platt scaling calibration
CREATE OR REPLACE FUNCTION calibrate_confidence(
  p_task_type VARCHAR(50),
  p_raw_score NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  v_model confidence_calibration_models;
  v_calibrated NUMERIC;
BEGIN
  SELECT * INTO v_model FROM confidence_calibration_models WHERE task_type = p_task_type;

  IF NOT FOUND THEN
    -- No calibration model, return raw score
    RETURN p_raw_score;
  END IF;

  -- Apply Platt scaling: P(y=1|s) = 1 / (1 + exp(A*s + B))
  v_calibrated := 1.0 / (1.0 + EXP(v_model.platt_a * p_raw_score + v_model.platt_b));

  -- Clamp to [0, 1]
  RETURN GREATEST(0.0, LEAST(1.0, v_calibrated));
END;
$$ LANGUAGE plpgsql;

-- Get current threshold value
CREATE OR REPLACE FUNCTION get_adaptive_threshold(
  p_task_type VARCHAR(50),
  p_threshold_name VARCHAR(100)
)
RETURNS NUMERIC AS $$
DECLARE
  v_threshold NUMERIC;
BEGIN
  SELECT current_value INTO v_threshold
  FROM adaptive_thresholds
  WHERE task_type = p_task_type
    AND threshold_name = p_threshold_name
    AND is_active = true;

  RETURN COALESCE(v_threshold, 0.5); -- Default to 0.5 if not found
END;
$$ LANGUAGE plpgsql;

-- Update threshold based on outcome (Bayesian update)
CREATE OR REPLACE FUNCTION update_adaptive_threshold(
  p_task_type VARCHAR(50),
  p_threshold_name VARCHAR(100),
  p_predicted_positive BOOLEAN,
  p_actual_positive BOOLEAN
)
RETURNS VOID AS $$
DECLARE
  v_threshold adaptive_thresholds;
  v_new_alpha NUMERIC;
  v_new_beta NUMERIC;
  v_new_value NUMERIC;
BEGIN
  SELECT * INTO v_threshold
  FROM adaptive_thresholds
  WHERE task_type = p_task_type AND threshold_name = p_threshold_name;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Update confusion matrix
  IF p_predicted_positive AND p_actual_positive THEN
    UPDATE adaptive_thresholds SET true_positives = true_positives + 1
    WHERE id = v_threshold.id;
    v_new_alpha := v_threshold.prior_alpha + 1;
    v_new_beta := v_threshold.prior_beta;
  ELSIF p_predicted_positive AND NOT p_actual_positive THEN
    UPDATE adaptive_thresholds SET false_positives = false_positives + 1
    WHERE id = v_threshold.id;
    v_new_alpha := v_threshold.prior_alpha;
    v_new_beta := v_threshold.prior_beta + 1;
  ELSIF NOT p_predicted_positive AND p_actual_positive THEN
    UPDATE adaptive_thresholds SET false_negatives = false_negatives + 1
    WHERE id = v_threshold.id;
    v_new_alpha := v_threshold.prior_alpha;
    v_new_beta := v_threshold.prior_beta + 0.5; -- Less penalty for false negatives
  ELSE
    UPDATE adaptive_thresholds SET true_negatives = true_negatives + 1
    WHERE id = v_threshold.id;
    v_new_alpha := v_threshold.prior_alpha;
    v_new_beta := v_threshold.prior_beta;
  END IF;

  -- Calculate new threshold using Beta distribution mean
  v_new_value := v_new_alpha / (v_new_alpha + v_new_beta);

  -- Clamp to bounds
  v_new_value := GREATEST(v_threshold.min_value, LEAST(v_threshold.max_value, v_new_value));

  -- Update threshold
  UPDATE adaptive_thresholds
  SET prior_alpha = v_new_alpha,
      prior_beta = v_new_beta,
      current_value = v_new_value,
      last_adjusted_at = NOW()
  WHERE id = v_threshold.id;
END;
$$ LANGUAGE plpgsql;

-- Select prompt version for A/B testing
CREATE OR REPLACE FUNCTION select_prompt_version(
  p_prompt_name VARCHAR(100)
)
RETURNS prompt_versions AS $$
DECLARE
  v_rand INTEGER;
  v_cumulative INTEGER := 0;
  v_version prompt_versions;
BEGIN
  -- Generate random number 1-100
  v_rand := FLOOR(RANDOM() * 100) + 1;

  -- Select based on traffic percentage
  FOR v_version IN
    SELECT * FROM prompt_versions
    WHERE prompt_name = p_prompt_name
      AND is_active = true
    ORDER BY version DESC
  LOOP
    v_cumulative := v_cumulative + v_version.traffic_percentage;
    IF v_rand <= v_cumulative THEN
      RETURN v_version;
    END IF;
  END LOOP;

  -- Fallback to latest active version
  SELECT * INTO v_version FROM prompt_versions
  WHERE prompt_name = p_prompt_name AND is_active = true
  ORDER BY version DESC
  LIMIT 1;

  RETURN v_version;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- Default Data
-- ================================================

-- Insert default adaptive thresholds
INSERT INTO adaptive_thresholds (task_type, threshold_name, current_value, description)
VALUES
  ('anomaly_detection', 'high', 0.8, 'High anomaly threshold'),
  ('anomaly_detection', 'medium', 0.5, 'Medium anomaly threshold'),
  ('anomaly_detection', 'low', 0.3, 'Low anomaly threshold'),
  ('intent_classification', 'reconnaissance', 0.6, 'Reconnaissance intent threshold'),
  ('intent_classification', 'transport', 0.7, 'Transport intent threshold'),
  ('intent_classification', 'training', 0.6, 'Training intent threshold'),
  ('threat_assessment', 'critical', 0.85, 'Critical threat threshold'),
  ('threat_assessment', 'high', 0.7, 'High threat threshold'),
  ('threat_assessment', 'medium', 0.5, 'Medium threat threshold')
ON CONFLICT (task_type, threshold_name) DO NOTHING;

-- Insert default calibration models (identity mapping initially)
INSERT INTO confidence_calibration_models (task_type, platt_a, platt_b)
VALUES
  ('anomaly_detection', -1.0, 0.0),
  ('intent_classification', -1.0, 0.0),
  ('threat_assessment', -1.0, 0.0)
ON CONFLICT (task_type) DO NOTHING;

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_ml_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calibration_models_updated_at
  BEFORE UPDATE ON confidence_calibration_models
  FOR EACH ROW EXECUTE FUNCTION update_ml_timestamp();

CREATE TRIGGER adaptive_thresholds_updated_at
  BEFORE UPDATE ON adaptive_thresholds
  FOR EACH ROW EXECUTE FUNCTION update_ml_timestamp();

COMMENT ON TABLE ml_prediction_outcomes IS 'Track ML prediction outcomes for calibration training';
COMMENT ON TABLE confidence_calibration_models IS 'Platt scaling parameters for confidence calibration';
COMMENT ON TABLE adaptive_thresholds IS 'Bayesian adaptive thresholds for ML decisions';
COMMENT ON TABLE ml_decision_explanations IS 'Explainability data for ML predictions';
COMMENT ON TABLE prompt_versions IS 'Version-controlled prompts for LLM calls';
COMMENT ON TABLE prompt_execution_logs IS 'Execution metrics for prompt performance tracking';
