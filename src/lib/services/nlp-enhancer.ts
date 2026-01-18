import { execute, queryOne, query } from '@/lib/db';
import { geminiClient, buildEntityExtractionPrompt } from './gemini-client';
import { embeddingService } from './embedding-service';
import type {
  EnhancedEntity,
  MilitaryEntityType,
  ExtractedEntity,
  EntityExtractionResult,
} from '@/lib/types/ml';

// Aircraft normalization mappings
const AIRCRAFT_NORMALIZATIONS: Record<string, string> = {
  'f-35': 'F-35A Lightning II',
  'f35': 'F-35A Lightning II',
  'f-35a': 'F-35A Lightning II',
  'f-35b': 'F-35B Lightning II',
  'f-35c': 'F-35C Lightning II',
  'f-15': 'F-15 Eagle',
  'f15': 'F-15 Eagle',
  'f-15e': 'F-15E Strike Eagle',
  'f-16': 'F-16 Fighting Falcon',
  'f16': 'F-16 Fighting Falcon',
  'f-18': 'F/A-18 Hornet',
  'f18': 'F/A-18 Hornet',
  'fa-18': 'F/A-18 Hornet',
  'f/a-18': 'F/A-18 Hornet',
  'f-22': 'F-22 Raptor',
  'f22': 'F-22 Raptor',
  'kc-135': 'KC-135 Stratotanker',
  'kc135': 'KC-135 Stratotanker',
  'kc-46': 'KC-46 Pegasus',
  'kc46': 'KC-46 Pegasus',
  'e-3': 'E-3 Sentry AWACS',
  'e3': 'E-3 Sentry AWACS',
  'awacs': 'E-3 Sentry AWACS',
  'e-2': 'E-2 Hawkeye',
  'e2': 'E-2 Hawkeye',
  'c-17': 'C-17 Globemaster III',
  'c17': 'C-17 Globemaster III',
  'c-130': 'C-130 Hercules',
  'c130': 'C-130 Hercules',
  'rc-135': 'RC-135 Rivet Joint',
  'rc135': 'RC-135 Rivet Joint',
  'p-8': 'P-8 Poseidon',
  'p8': 'P-8 Poseidon',
  'mq-9': 'MQ-9 Reaper',
  'mq9': 'MQ-9 Reaper',
  'rq-4': 'RQ-4 Global Hawk',
  'rq4': 'RQ-4 Global Hawk',
  'b-52': 'B-52 Stratofortress',
  'b52': 'B-52 Stratofortress',
  'b-1': 'B-1B Lancer',
  'b1': 'B-1B Lancer',
  'b-2': 'B-2 Spirit',
  'b2': 'B-2 Spirit',
  'su-35': 'Su-35 Flanker-E',
  'su35': 'Su-35 Flanker-E',
  'su-57': 'Su-57 Felon',
  'su57': 'Su-57 Felon',
  'mig-29': 'MiG-29 Fulcrum',
  'mig29': 'MiG-29 Fulcrum',
  'mig-31': 'MiG-31 Foxhound',
  'mig31': 'MiG-31 Foxhound',
  'tu-95': 'Tu-95 Bear',
  'tu95': 'Tu-95 Bear',
  'tu-160': 'Tu-160 Blackjack',
  'tu160': 'Tu-160 Blackjack',
  'a-10': 'A-10 Thunderbolt II',
  'a10': 'A-10 Thunderbolt II',
  'ah-64': 'AH-64 Apache',
  'ah64': 'AH-64 Apache',
  'uh-60': 'UH-60 Black Hawk',
  'uh60': 'UH-60 Black Hawk',
  'ch-47': 'CH-47 Chinook',
  'ch47': 'CH-47 Chinook',
  'v-22': 'V-22 Osprey',
  'v22': 'V-22 Osprey',
};

// Weapon system normalizations
const WEAPON_NORMALIZATIONS: Record<string, string> = {
  'aim-120': 'AIM-120 AMRAAM',
  'amraam': 'AIM-120 AMRAAM',
  'aim-9': 'AIM-9 Sidewinder',
  'sidewinder': 'AIM-9 Sidewinder',
  'jdam': 'JDAM (Joint Direct Attack Munition)',
  'tomahawk': 'BGM-109 Tomahawk',
  'hellfire': 'AGM-114 Hellfire',
  'patriot': 'MIM-104 Patriot',
  'iron dome': 'Iron Dome',
  's-400': 'S-400 Triumf',
  's400': 'S-400 Triumf',
  's-300': 'S-300',
  's300': 'S-300',
  'thaad': 'THAAD',
};

export class NLPEnhancer {
  /**
   * Extract entities from text using Gemini
   */
  async extractEntities(text: string): Promise<EntityExtractionResult> {
    if (!geminiClient.isEnabled()) {
      return { entities: [], raw_response: undefined };
    }

    try {
      const prompt = buildEntityExtractionPrompt(text);
      const response = await geminiClient.generateContent({
        prompt,
        model: 'flash',
        temperature: 0.2,
        jsonMode: true,
      });

      // Parse the JSON response
      let entities: ExtractedEntity[] = [];
      try {
        const parsed = JSON.parse(response.text);
        if (Array.isArray(parsed)) {
          entities = parsed.map((e) => this.normalizeEntity(e));
        }
      } catch (parseError) {
        console.error('Error parsing entity extraction response:', parseError);
        return { entities: [], raw_response: response.text };
      }

      return { entities, raw_response: response.text };
    } catch (error) {
      console.error('Error extracting entities:', error);
      return { entities: [] };
    }
  }

  /**
   * Normalize an extracted entity
   */
  private normalizeEntity(entity: Partial<ExtractedEntity>): ExtractedEntity {
    const name = entity.name || '';
    const type = entity.type || 'equipment';
    const nameLower = name.toLowerCase().trim();

    let normalizedName = entity.normalized_name;

    // Try to normalize based on type
    if (!normalizedName) {
      if (type === 'aircraft') {
        normalizedName = AIRCRAFT_NORMALIZATIONS[nameLower];
      } else if (type === 'weapon_system') {
        normalizedName = WEAPON_NORMALIZATIONS[nameLower];
      }
    }

    return {
      name,
      type: type as MilitaryEntityType,
      normalized_name: normalizedName,
      confidence: entity.confidence || 0.5,
      context: entity.context,
    };
  }

  /**
   * Extract and store entities for a news event
   */
  async processNewsEvent(newsEventId: string): Promise<number> {
    try {
      // Get the news event
      const newsEvent = await queryOne<{ title: string; content: string | null }>(
        `SELECT title, content FROM news_events WHERE id = $1`,
        [newsEventId]
      );

      if (!newsEvent) {
        console.error('News event not found:', newsEventId);
        return 0;
      }

      // Combine title and content for extraction
      const text = `${newsEvent.title}\n\n${newsEvent.content || ''}`;

      // Extract entities
      const result = await this.extractEntities(text);

      if (result.entities.length === 0) {
        return 0;
      }

      // Store entities
      let insertCount = 0;
      for (const entity of result.entities) {
        try {
          await execute(
            `INSERT INTO enhanced_entities
             (source_type, source_id, entity_type, entity_name, normalized_name, confidence, context, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              'news_event',
              newsEventId,
              entity.type,
              entity.name,
              entity.normalized_name || null,
              entity.confidence,
              entity.context || null,
              JSON.stringify({}),
            ]
          );
          insertCount++;
        } catch (dbError) {
          // Likely duplicate, skip
          console.debug('Entity insert skipped:', dbError);
        }
      }

      return insertCount;
    } catch (error) {
      console.error('Error processing news event entities:', error);
      return 0;
    }
  }

  /**
   * Get enhanced entities for a source
   */
  async getEntitiesForSource(
    sourceType: 'news_event' | 'social_post',
    sourceId: string
  ): Promise<EnhancedEntity[]> {
    try {
      const entities = await query<EnhancedEntity>(
        `SELECT * FROM enhanced_entities
         WHERE source_type = $1 AND source_id = $2
         ORDER BY confidence DESC`,
        [sourceType, sourceId]
      );

      return entities;
    } catch (error) {
      console.error('Error fetching entities:', error);
      return [];
    }
  }

  /**
   * Calculate entity-based correlation score
   */
  async calculateEntityScore(
    newsEventId: string,
    aircraftType: string | null,
    aircraftOperator: string | null
  ): Promise<number> {
    try {
      // Get entities for the news event
      const entities = await this.getEntitiesForSource('news_event', newsEventId);

      if (entities.length === 0) {
        return 0;
      }

      let score = 0;
      let matchCount = 0;

      for (const entity of entities) {
        // Check for aircraft type matches
        if (
          entity.entity_type === 'aircraft' &&
          aircraftType &&
          (entity.entity_name.toLowerCase().includes(aircraftType.toLowerCase()) ||
            entity.normalized_name?.toLowerCase().includes(aircraftType.toLowerCase()))
        ) {
          score += entity.confidence * 0.5;
          matchCount++;
        }

        // Check for operator/unit matches
        if (
          entity.entity_type === 'military_unit' &&
          aircraftOperator &&
          entity.entity_name.toLowerCase().includes(aircraftOperator.toLowerCase())
        ) {
          score += entity.confidence * 0.3;
          matchCount++;
        }
      }

      // Normalize score
      if (matchCount > 0) {
        score = Math.min(score / matchCount, 1.0);
      }

      return score;
    } catch (error) {
      console.error('Error calculating entity score:', error);
      return 0;
    }
  }

  /**
   * Analyze sentiment and map to threat implication
   */
  async analyzeSentimentThreat(
    text: string,
    sentimentScore: number | null // GDELT tone: -100 to +100
  ): Promise<{ threatImplication: number; analysis: string }> {
    if (!geminiClient.isEnabled()) {
      // Fallback: simple mapping from GDELT tone
      const normalizedSentiment = sentimentScore !== null ? (sentimentScore + 100) / 200 : 0.5;
      return {
        threatImplication: 1 - normalizedSentiment, // Negative sentiment = higher threat
        analysis: 'Automated sentiment-based assessment (ML disabled)',
      };
    }

    try {
      const prompt = `Analyze the following news text and its sentiment score to assess threat implications.

Text: ${text.substring(0, 500)}...
GDELT Sentiment Score: ${sentimentScore ?? 'unknown'} (scale: -100 very negative to +100 very positive)

Return JSON:
{
  "threat_implication": 0.0-1.0 (how much this suggests elevated threat),
  "analysis": "brief explanation"
}

Consider:
- Negative sentiment about military activity often indicates conflict
- Positive sentiment might indicate exercises or cooperation
- Neutral may indicate routine operations`;

      const response = await geminiClient.generateContent({
        prompt,
        model: 'flash',
        temperature: 0.3,
        jsonMode: true,
      });

      const parsed = JSON.parse(response.text);
      return {
        threatImplication: parsed.threat_implication || 0.5,
        analysis: parsed.analysis || 'Analysis unavailable',
      };
    } catch (error) {
      console.error('Error analyzing sentiment threat:', error);
      return {
        threatImplication: 0.5,
        analysis: 'Error in sentiment analysis',
      };
    }
  }

  /**
   * Generate embedding for a news event and update corroborations
   */
  async processNewsEventEmbedding(newsEventId: string): Promise<boolean> {
    try {
      // Get the news event
      const newsEvent = await queryOne<{ title: string; content: string | null }>(
        `SELECT title, content FROM news_events WHERE id = $1`,
        [newsEventId]
      );

      if (!newsEvent) {
        return false;
      }

      // Generate embedding from title (and partial content if available)
      const textForEmbedding = newsEvent.content
        ? `${newsEvent.title}. ${newsEvent.content.substring(0, 500)}`
        : newsEvent.title;

      const embedding = await embeddingService.generateAndStoreEmbedding(
        'news_event',
        newsEventId,
        textForEmbedding,
        { title: newsEvent.title }
      );

      if (!embedding) {
        return false;
      }

      // Update corroborations
      await embeddingService.updateArticleCorroborations(newsEventId);

      return true;
    } catch (error) {
      console.error('Error processing news event embedding:', error);
      return false;
    }
  }

  /**
   * Find related news events by entity matches
   */
  async findRelatedByEntities(
    newsEventId: string,
    limit: number = 5
  ): Promise<Array<{ news_event_id: string; shared_entities: string[]; score: number }>> {
    try {
      // Get entities for this news event
      const sourceEntities = await this.getEntitiesForSource('news_event', newsEventId);

      if (sourceEntities.length === 0) {
        return [];
      }

      const entityNames = sourceEntities.map((e) => e.normalized_name || e.entity_name);

      // Find other news events with matching entities
      const results = await query<{
        source_id: string;
        entity_name: string;
        normalized_name: string | null;
      }>(
        `SELECT DISTINCT source_id, entity_name, normalized_name
         FROM enhanced_entities
         WHERE source_type = 'news_event'
         AND source_id <> $1
         AND (entity_name = ANY($2) OR normalized_name = ANY($2))`,
        [newsEventId, entityNames]
      );

      // Group by news event
      const eventMatches = new Map<string, string[]>();
      for (const row of results) {
        const matches = eventMatches.get(row.source_id) || [];
        matches.push(row.normalized_name || row.entity_name);
        eventMatches.set(row.source_id, matches);
      }

      // Calculate scores and sort
      const scored = Array.from(eventMatches.entries())
        .map(([newsEventId, sharedEntities]) => ({
          news_event_id: newsEventId,
          shared_entities: [...new Set(sharedEntities)],
          score: sharedEntities.length / Math.max(entityNames.length, 1),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return scored;
    } catch (error) {
      console.error('Error finding related news by entities:', error);
      return [];
    }
  }

  /**
   * Get entity statistics
   */
  async getStats(): Promise<{
    total: number;
    by_type: Record<string, number>;
    top_entities: Array<{ name: string; count: number }>;
  }> {
    try {
      const totalResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM enhanced_entities`
      );

      const byTypeResults = await query<{ entity_type: string; count: string }>(
        `SELECT entity_type, COUNT(*) as count FROM enhanced_entities GROUP BY entity_type`
      );

      const topEntities = await query<{ name: string; count: string }>(
        `SELECT COALESCE(normalized_name, entity_name) as name, COUNT(*) as count
         FROM enhanced_entities
         GROUP BY name
         ORDER BY count DESC
         LIMIT 20`
      );

      const byType: Record<string, number> = {};
      for (const row of byTypeResults) {
        byType[row.entity_type] = parseInt(row.count, 10);
      }

      return {
        total: parseInt(totalResult?.count || '0', 10),
        by_type: byType,
        top_entities: topEntities.map((e) => ({
          name: e.name,
          count: parseInt(e.count, 10),
        })),
      };
    } catch {
      return { total: 0, by_type: {}, top_entities: [] };
    }
  }
}

// Export singleton instance
export const nlpEnhancer = new NLPEnhancer();
