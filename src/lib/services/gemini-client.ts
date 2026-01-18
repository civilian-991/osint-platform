import { createHash } from 'crypto';
import { execute, queryOne, query } from '@/lib/db';
import type {
  GeminiModel,
  GeminiGenerateRequest,
  GeminiGenerateResponse,
  GeminiEmbeddingRequest,
  GeminiEmbeddingResponse,
  GeminiCache,
} from '@/lib/types/ml';

// Configuration
const CONFIG = {
  apiKey: process.env.GEMINI_API_KEY || '',
  flashModel: process.env.GEMINI_FLASH_MODEL || 'gemini-2.0-flash-exp',
  proModel: process.env.GEMINI_PRO_MODEL || 'gemini-1.5-pro',
  embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
  requestsPerMinute: parseInt(process.env.GEMINI_REQUESTS_PER_MINUTE || '15', 10),
  cacheTTLHours: 24,
  maxRetries: 3,
  retryDelayMs: 1000,
};

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Token bucket for rate limiting
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  constructor(maxTokens: number, tokensPerMinute: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = tokensPerMinute / 60000; // Convert to per-ms
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens < 1) {
      // Wait until we have a token
      const waitTime = Math.ceil((1 - this.tokens) / this.refillRate);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.refill();
    }

    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

export class GeminiClient {
  private rateLimiter: TokenBucket;
  private enabled: boolean;

  constructor() {
    this.rateLimiter = new TokenBucket(
      CONFIG.requestsPerMinute,
      CONFIG.requestsPerMinute
    );
    this.enabled = process.env.ENABLE_ML_PROCESSING === 'true' && !!CONFIG.apiKey;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Generate content using Gemini
   */
  async generateContent(request: GeminiGenerateRequest): Promise<GeminiGenerateResponse> {
    if (!this.enabled) {
      throw new Error('Gemini client is not enabled. Check ENABLE_ML_PROCESSING and GEMINI_API_KEY.');
    }

    const model = request.model || 'flash';
    const modelId = model === 'pro' ? CONFIG.proModel : CONFIG.flashModel;

    // Check cache first
    const cacheKey = this.generateCacheKey('generate', modelId, request.prompt);
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return {
        text: cached.response.text as string,
        tokens_used: cached.tokens_used || 0,
        cached: true,
      };
    }

    // Rate limit
    await this.rateLimiter.acquire();

    // Make API request
    const response = await this.makeGenerateRequest(modelId, request);

    // Cache the response
    await this.saveToCache(cacheKey, modelId, request.prompt, response);

    return {
      ...response,
      cached: false,
    };
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbedding(request: GeminiEmbeddingRequest): Promise<GeminiEmbeddingResponse> {
    if (!this.enabled) {
      throw new Error('Gemini client is not enabled. Check ENABLE_ML_PROCESSING and GEMINI_API_KEY.');
    }

    const texts = Array.isArray(request.text) ? request.text : [request.text];
    const embeddings: number[][] = [];
    let totalTokens = 0;

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      // Rate limit
      await this.rateLimiter.acquire();

      const batchResponse = await this.makeEmbeddingRequest(batch);
      embeddings.push(...batchResponse.embeddings);
      totalTokens += batchResponse.tokens_used;
    }

    return {
      embeddings,
      tokens_used: totalTokens,
    };
  }

  /**
   * Batch generate content with parallel execution and rate limiting
   */
  async batchGenerate(
    requests: GeminiGenerateRequest[]
  ): Promise<GeminiGenerateResponse[]> {
    if (!this.enabled) {
      throw new Error('Gemini client is not enabled.');
    }

    const results: GeminiGenerateResponse[] = [];

    // Process sequentially to respect rate limits
    for (const request of requests) {
      try {
        const response = await this.generateContent(request);
        results.push(response);
      } catch (error) {
        console.error('Batch generate error:', error);
        results.push({
          text: '',
          tokens_used: 0,
          cached: false,
        });
      }
    }

    return results;
  }

  /**
   * Generate a cache key from the request
   */
  private generateCacheKey(type: string, model: string, prompt: string): string {
    const hash = createHash('sha256');
    hash.update(`${type}:${model}:${prompt}`);
    return hash.digest('hex');
  }

  /**
   * Get response from cache
   */
  private async getFromCache(cacheKey: string): Promise<GeminiCache | null> {
    try {
      const cached = await queryOne<GeminiCache>(
        `UPDATE gemini_cache
         SET hits = hits + 1
         WHERE cache_key = $1 AND expires_at > NOW()
         RETURNING *`,
        [cacheKey]
      );
      return cached || null;
    } catch {
      return null;
    }
  }

  /**
   * Save response to cache
   */
  private async saveToCache(
    cacheKey: string,
    model: string,
    prompt: string,
    response: { text: string; tokens_used: number }
  ): Promise<void> {
    try {
      const requestHash = createHash('sha256').update(prompt).digest('hex');
      const expiresAt = new Date(Date.now() + CONFIG.cacheTTLHours * 60 * 60 * 1000);

      await execute(
        `INSERT INTO gemini_cache (cache_key, model, request_hash, response, tokens_used, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (cache_key) DO UPDATE SET
           response = EXCLUDED.response,
           tokens_used = EXCLUDED.tokens_used,
           expires_at = EXCLUDED.expires_at,
           hits = 0`,
        [cacheKey, model, requestHash, JSON.stringify({ text: response.text }), response.tokens_used, expiresAt]
      );
    } catch (error) {
      console.error('Cache save error:', error);
    }
  }

  /**
   * Make the actual generate API request with retries
   */
  private async makeGenerateRequest(
    modelId: string,
    request: GeminiGenerateRequest
  ): Promise<{ text: string; tokens_used: number }> {
    const url = `${GEMINI_API_BASE}/models/${modelId}:generateContent?key=${CONFIG.apiKey}`;

    const body = {
      contents: [
        {
          parts: [{ text: request.prompt }],
        },
      ],
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 2048,
        ...(request.jsonMode && { responseMimeType: 'application/json' }),
      },
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < CONFIG.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const tokensUsed =
          (data.usageMetadata?.promptTokenCount || 0) +
          (data.usageMetadata?.candidatesTokenCount || 0);

        return { text, tokens_used: tokensUsed };
      } catch (error) {
        lastError = error as Error;
        console.error(`Gemini request attempt ${attempt + 1} failed:`, error);

        if (attempt < CONFIG.maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, CONFIG.retryDelayMs * Math.pow(2, attempt))
          );
        }
      }
    }

    throw lastError || new Error('Gemini request failed after retries');
  }

  /**
   * Make the actual embedding API request
   */
  private async makeEmbeddingRequest(
    texts: string[]
  ): Promise<{ embeddings: number[][]; tokens_used: number }> {
    const url = `${GEMINI_API_BASE}/models/${CONFIG.embeddingModel}:batchEmbedContents?key=${CONFIG.apiKey}`;

    const body = {
      requests: texts.map((text) => ({
        model: `models/${CONFIG.embeddingModel}`,
        content: { parts: [{ text }] },
      })),
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < CONFIG.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini Embedding API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        const embeddings = data.embeddings?.map(
          (e: { values: number[] }) => e.values
        ) || [];

        // Estimate tokens (rough approximation)
        const tokensUsed = texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0);

        return { embeddings, tokens_used: tokensUsed };
      } catch (error) {
        lastError = error as Error;
        console.error(`Embedding request attempt ${attempt + 1} failed:`, error);

        if (attempt < CONFIG.maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, CONFIG.retryDelayMs * Math.pow(2, attempt))
          );
        }
      }
    }

    throw lastError || new Error('Embedding request failed after retries');
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpiredCache(): Promise<number> {
    try {
      const result = await queryOne<{ clean_expired_gemini_cache: number }>(
        'SELECT clean_expired_gemini_cache()'
      );
      return result?.clean_expired_gemini_cache || 0;
    } catch (error) {
      console.error('Cache cleanup error:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    total_entries: number;
    total_hits: number;
    avg_hits: number;
  }> {
    try {
      const stats = await queryOne<{
        total_entries: string;
        total_hits: string;
        avg_hits: string;
      }>(
        `SELECT
           COUNT(*) as total_entries,
           SUM(hits) as total_hits,
           AVG(hits) as avg_hits
         FROM gemini_cache
         WHERE expires_at > NOW()`
      );

      return {
        total_entries: parseInt(stats?.total_entries || '0', 10),
        total_hits: parseInt(stats?.total_hits || '0', 10),
        avg_hits: parseFloat(stats?.avg_hits || '0'),
      };
    } catch {
      return { total_entries: 0, total_hits: 0, avg_hits: 0 };
    }
  }
}

// Export singleton instance
export const geminiClient = new GeminiClient();

// Export utility functions for common prompts
export function buildEntityExtractionPrompt(text: string): string {
  return `Extract military and aviation entities from the following text. Return a JSON array of entities with this structure:
[
  {
    "name": "entity name as mentioned",
    "type": "weapon_system|military_unit|operation_name|equipment|personnel|aircraft",
    "normalized_name": "standardized form if known (e.g., F-35 -> F-35A Lightning II)",
    "confidence": 0.0-1.0
  }
]

Focus on:
- Aircraft types (F-35, KC-135, E-3, etc.)
- Weapon systems (missiles, bombs, radar systems)
- Military units (squadrons, divisions, commands)
- Operation names
- Military equipment
- Key personnel mentioned

Text:
${text}

Return only valid JSON array, no explanation.`;
}

export function buildIntentClassificationPrompt(
  aircraftType: string,
  pattern: string,
  nearbyAircraft: string[],
  region: string
): string {
  return `Analyze the flight intent for a military aircraft based on the following information:

Aircraft Type: ${aircraftType}
Detected Pattern: ${pattern}
Nearby Aircraft: ${nearbyAircraft.length > 0 ? nearbyAircraft.join(', ') : 'None detected'}
Region: ${region}

Classify the most likely intent from these categories:
- training: Practice flights, exercises
- patrol: Border patrol, routine surveillance
- refueling: Air-to-air refueling operations
- surveillance: ISR missions, reconnaissance
- combat: Active combat operations
- transit: Point-to-point transport
- exercise: Multi-national or large-scale exercises

Return JSON:
{
  "intent": "primary_intent",
  "confidence": 0.0-1.0,
  "evidence": ["reason1", "reason2"],
  "reasoning": "detailed explanation",
  "alternative_intents": [{"intent": "other", "confidence": 0.0-1.0}]
}`;
}

export function buildThreatAnalysisPrompt(
  entityType: string,
  entityData: Record<string, unknown>,
  contextData: Record<string, unknown>
): string {
  return `Analyze the threat level for the following entity:

Entity Type: ${entityType}
Entity Data: ${JSON.stringify(entityData, null, 2)}
Context: ${JSON.stringify(contextData, null, 2)}

Consider:
1. Historical patterns and deviations
2. Regional tensions
3. News correlations
4. Formation activity
5. Time of day and day of week patterns

Return JSON:
{
  "threat_score": 0.0-1.0,
  "threat_level": "minimal|low|elevated|high|critical",
  "analysis": "detailed analysis",
  "factors": {
    "anomalies": ["list of anomalies"],
    "tensions": ["regional tensions"],
    "correlations": ["news correlations"],
    "historical": ["historical context"],
    "formations": ["formation activity"]
  },
  "recommendations": [
    {"action": "recommended action", "priority": "low|medium|high", "rationale": "why"}
  ]
}`;
}

export function buildAnomalyAnalysisPrompt(
  aircraftType: string,
  detected: Record<string, unknown>,
  expected: Record<string, unknown>
): string {
  return `Analyze the following flight anomaly:

Aircraft Type: ${aircraftType}
Detected Values: ${JSON.stringify(detected, null, 2)}
Expected Values (from behavioral profile): ${JSON.stringify(expected, null, 2)}

Explain:
1. What is anomalous about this behavior
2. Possible explanations (benign vs concerning)
3. Recommended actions

Keep response concise (2-3 sentences per point).`;
}
