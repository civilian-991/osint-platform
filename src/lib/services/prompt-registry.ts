/**
 * Prompt Registry Service
 * Manages prompt versions, A/B testing, and execution logging
 */

import { query, queryOne, execute } from '@/lib/db';

export interface PromptVersion {
  id: string;
  prompt_key: string;
  version: number;
  prompt_template: string;
  description: string | null;
  is_active: boolean;
  traffic_percentage: number;
  performance_score: number | null;
  total_executions: number;
  avg_latency_ms: number | null;
  success_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface PromptExecutionLog {
  id: string;
  prompt_version_id: string;
  task_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  success: boolean;
  error_message: string | null;
  quality_score: number | null;
  executed_at: string;
}

export interface PromptExecutionResult {
  versionId: string;
  version: number;
  promptKey: string;
  renderedPrompt: string;
}

/**
 * Get active prompt versions for a key
 */
export async function getActiveVersions(promptKey: string): Promise<PromptVersion[]> {
  return query<PromptVersion>(
    `SELECT * FROM prompt_versions
     WHERE prompt_key = $1 AND is_active = true
     ORDER BY version DESC`,
    [promptKey]
  );
}

/**
 * Get a specific prompt version
 */
export async function getPromptVersion(
  promptKey: string,
  version: number
): Promise<PromptVersion | null> {
  return queryOne<PromptVersion>(
    `SELECT * FROM prompt_versions
     WHERE prompt_key = $1 AND version = $2`,
    [promptKey, version]
  );
}

/**
 * Select a prompt version using weighted random selection (A/B testing)
 */
export async function selectPromptVersion(promptKey: string): Promise<PromptVersion | null> {
  const versions = await getActiveVersions(promptKey);

  if (versions.length === 0) {
    return null;
  }

  if (versions.length === 1) {
    return versions[0];
  }

  // Weighted random selection based on traffic_percentage
  const totalWeight = versions.reduce((sum, v) => sum + v.traffic_percentage, 0);
  let random = Math.random() * totalWeight;

  for (const version of versions) {
    random -= version.traffic_percentage;
    if (random <= 0) {
      return version;
    }
  }

  // Fallback to first version
  return versions[0];
}

/**
 * Render a prompt template with variables
 */
export function renderPrompt(
  template: string,
  variables: Record<string, unknown>
): string {
  let rendered = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    const stringValue = typeof value === 'object'
      ? JSON.stringify(value, null, 2)
      : String(value);
    rendered = rendered.split(placeholder).join(stringValue);
  }

  return rendered;
}

/**
 * Get a prompt for execution with A/B selection
 */
export async function getPrompt(
  promptKey: string,
  variables: Record<string, unknown> = {}
): Promise<PromptExecutionResult | null> {
  const version = await selectPromptVersion(promptKey);

  if (!version) {
    return null;
  }

  const renderedPrompt = renderPrompt(version.prompt_template, variables);

  return {
    versionId: version.id,
    version: version.version,
    promptKey: version.prompt_key,
    renderedPrompt,
  };
}

/**
 * Log a prompt execution
 */
export async function logExecution(
  versionId: string,
  data: {
    taskId?: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    success: boolean;
    errorMessage?: string;
    qualityScore?: number;
  }
): Promise<string> {
  const result = await queryOne<{ id: string }>(
    `INSERT INTO prompt_execution_logs (
      prompt_version_id, task_id, input_tokens, output_tokens,
      latency_ms, success, error_message, quality_score
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`,
    [
      versionId,
      data.taskId || null,
      data.inputTokens || null,
      data.outputTokens || null,
      data.latencyMs || null,
      data.success,
      data.errorMessage || null,
      data.qualityScore || null,
    ]
  );

  if (!result) {
    throw new Error('Failed to log prompt execution');
  }

  // Update version statistics
  await updateVersionStats(versionId);

  return result.id;
}

/**
 * Update version statistics from execution logs
 */
async function updateVersionStats(versionId: string): Promise<void> {
  await execute(
    `UPDATE prompt_versions
     SET total_executions = (
       SELECT COUNT(*) FROM prompt_execution_logs WHERE prompt_version_id = $1
     ),
     avg_latency_ms = (
       SELECT AVG(latency_ms) FROM prompt_execution_logs
       WHERE prompt_version_id = $1 AND latency_ms IS NOT NULL
     ),
     success_rate = (
       SELECT AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END)
       FROM prompt_execution_logs WHERE prompt_version_id = $1
     ),
     performance_score = (
       SELECT AVG(quality_score) FROM prompt_execution_logs
       WHERE prompt_version_id = $1 AND quality_score IS NOT NULL
     ),
     updated_at = NOW()
     WHERE id = $1`,
    [versionId]
  );
}

/**
 * Create a new prompt version
 */
export async function createPromptVersion(
  promptKey: string,
  promptTemplate: string,
  options: {
    description?: string;
    trafficPercentage?: number;
    isActive?: boolean;
  } = {}
): Promise<PromptVersion> {
  // Get next version number
  const maxVersion = await queryOne<{ max: number }>(
    `SELECT COALESCE(MAX(version), 0) as max FROM prompt_versions WHERE prompt_key = $1`,
    [promptKey]
  );

  const nextVersion = (maxVersion?.max || 0) + 1;

  const result = await queryOne<PromptVersion>(
    `INSERT INTO prompt_versions (
      prompt_key, version, prompt_template, description,
      is_active, traffic_percentage
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      promptKey,
      nextVersion,
      promptTemplate,
      options.description || null,
      options.isActive ?? true,
      options.trafficPercentage ?? 100,
    ]
  );

  if (!result) {
    throw new Error('Failed to create prompt version');
  }

  return result;
}

/**
 * Update traffic percentage for A/B testing
 */
export async function updateTrafficPercentage(
  versionId: string,
  trafficPercentage: number
): Promise<PromptVersion | null> {
  return queryOne<PromptVersion>(
    `UPDATE prompt_versions
     SET traffic_percentage = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [Math.max(0, Math.min(100, trafficPercentage)), versionId]
  );
}

/**
 * Deactivate a prompt version
 */
export async function deactivateVersion(versionId: string): Promise<void> {
  await execute(
    `UPDATE prompt_versions SET is_active = false, updated_at = NOW() WHERE id = $1`,
    [versionId]
  );
}

/**
 * Get version comparison for A/B test analysis
 */
export async function getVersionComparison(
  promptKey: string
): Promise<Array<{
  version: PromptVersion;
  stats: {
    totalExecutions: number;
    avgLatencyMs: number | null;
    successRate: number | null;
    avgQualityScore: number | null;
    p95LatencyMs: number | null;
  };
}>> {
  const versions = await query<PromptVersion>(
    `SELECT * FROM prompt_versions WHERE prompt_key = $1 ORDER BY version DESC`,
    [promptKey]
  );

  const results = [];

  for (const version of versions) {
    const stats = await queryOne<{
      total: number;
      avg_latency: number | null;
      success_rate: number | null;
      avg_quality: number | null;
      p95_latency: number | null;
    }>(
      `SELECT
        COUNT(*)::int as total,
        AVG(latency_ms) as avg_latency,
        AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) as success_rate,
        AVG(quality_score) as avg_quality,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency
       FROM prompt_execution_logs
       WHERE prompt_version_id = $1`,
      [version.id]
    );

    results.push({
      version,
      stats: {
        totalExecutions: stats?.total || 0,
        avgLatencyMs: stats?.avg_latency || null,
        successRate: stats?.success_rate || null,
        avgQualityScore: stats?.avg_quality || null,
        p95LatencyMs: stats?.p95_latency || null,
      },
    });
  }

  return results;
}

/**
 * Promote a version to 100% traffic (winner of A/B test)
 */
export async function promoteVersion(versionId: string): Promise<void> {
  const version = await queryOne<PromptVersion>(
    `SELECT * FROM prompt_versions WHERE id = $1`,
    [versionId]
  );

  if (!version) {
    throw new Error('Version not found');
  }

  // Set all other versions of this prompt to 0% traffic
  await execute(
    `UPDATE prompt_versions
     SET traffic_percentage = 0, updated_at = NOW()
     WHERE prompt_key = $1 AND id != $2`,
    [version.prompt_key, versionId]
  );

  // Set this version to 100%
  await execute(
    `UPDATE prompt_versions
     SET traffic_percentage = 100, is_active = true, updated_at = NOW()
     WHERE id = $1`,
    [versionId]
  );
}

/**
 * Get all registered prompt keys
 */
export async function getAllPromptKeys(): Promise<string[]> {
  const results = await query<{ prompt_key: string }>(
    `SELECT DISTINCT prompt_key FROM prompt_versions ORDER BY prompt_key`
  );

  return results.map((r) => r.prompt_key);
}

/**
 * Initialize default prompts if they don't exist
 */
export async function initializeDefaultPrompts(): Promise<void> {
  const defaults: Array<{
    key: string;
    template: string;
    description: string;
  }> = [
    {
      key: 'anomaly_analysis',
      template: `Analyze the following aircraft behavior for anomalies:

Aircraft: {{aircraft_type}} ({{icao_hex}})
Current Position: {{latitude}}, {{longitude}} at {{altitude}}ft
Speed: {{speed}} knots, Heading: {{heading}}°
Recent Track: {{track_summary}}

Historical Baseline:
- Typical altitude range: {{baseline_altitude_range}}
- Typical speed range: {{baseline_speed_range}}
- Common patterns: {{baseline_patterns}}

Identify any anomalous behaviors and explain why they are unusual.
Rate the anomaly severity from 0.0 to 1.0.

Respond in JSON format:
{
  "anomaly_score": <number>,
  "anomalies": [{"type": "<string>", "description": "<string>", "severity": <number>}],
  "explanation": "<string>"
}`,
      description: 'Analyzes aircraft behavior for anomalies against historical baseline',
    },
    {
      key: 'intent_classification',
      template: `Classify the likely intent of this aircraft based on its behavior:

Aircraft Type: {{aircraft_type}}
Flight Pattern: {{pattern_description}}
Duration: {{duration_minutes}} minutes
Operating Region: {{region_description}}
Accompanying Aircraft: {{accompanying_aircraft}}

Possible intents: reconnaissance, transport, training, combat patrol, refueling, surveillance, cargo

Provide your classification with confidence scores.

Respond in JSON format:
{
  "primary_intent": "<string>",
  "confidence": <number>,
  "secondary_intents": [{"intent": "<string>", "confidence": <number>}],
  "reasoning": "<string>"
}`,
      description: 'Classifies aircraft mission intent from behavior patterns',
    },
    {
      key: 'formation_analysis',
      template: `Analyze this group of aircraft for formation patterns:

Aircraft in group:
{{aircraft_list}}

Spatial relationships:
- Average spacing: {{avg_spacing_nm}} nm
- Max altitude difference: {{max_alt_diff}} ft
- Max speed difference: {{max_speed_diff}} knots
- Heading variance: {{heading_variance}}°

Identify the formation type and tactical significance.

Respond in JSON format:
{
  "formation_type": "<string>",
  "confidence": <number>,
  "tactical_significance": "<string>",
  "threat_level": "low" | "medium" | "high" | "critical",
  "analysis": "<string>"
}`,
      description: 'Identifies military formation patterns and tactical significance',
    },
    {
      key: 'threat_assessment',
      template: `Assess the threat level of this aircraft/formation:

Subject: {{subject_description}}
Location: {{location_description}}
Behavior: {{behavior_summary}}
Context: {{context}}

Recent alerts in area: {{recent_alerts}}
Known military activity: {{military_activity}}

Provide a threat assessment.

Respond in JSON format:
{
  "threat_level": "low" | "medium" | "high" | "critical",
  "threat_score": <number 0-1>,
  "threat_factors": [{"factor": "<string>", "weight": <number>}],
  "recommended_actions": ["<string>"],
  "assessment": "<string>"
}`,
      description: 'Assesses threat level based on aircraft behavior and context',
    },
  ];

  for (const prompt of defaults) {
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM prompt_versions WHERE prompt_key = $1 LIMIT 1`,
      [prompt.key]
    );

    if (!existing) {
      await createPromptVersion(prompt.key, prompt.template, {
        description: prompt.description,
        trafficPercentage: 100,
        isActive: true,
      });
    }
  }
}
