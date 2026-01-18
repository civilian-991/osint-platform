import { execute, queryOne, query } from '@/lib/db';
import { geminiClient } from './gemini-client';
import type {
  Embedding,
  EmbeddingEntityType,
  ArticleCorroboration,
} from '@/lib/types/ml';

// Configuration
const CONFIG = {
  embeddingDimension: 768,
  batchSize: 100,
  minSimilarityThreshold: 0.7,
  defaultLimit: 10,
};

export class EmbeddingService {
  /**
   * Generate and store embedding for an entity
   */
  async generateAndStoreEmbedding(
    entityType: EmbeddingEntityType,
    entityId: string,
    text: string,
    metadata?: Record<string, unknown>
  ): Promise<Embedding | null> {
    if (!geminiClient.isEnabled()) {
      console.warn('Gemini client not enabled, skipping embedding generation');
      return null;
    }

    try {
      // Generate embedding
      const response = await geminiClient.generateEmbedding({ text });

      if (response.embeddings.length === 0) {
        console.error('No embedding returned from Gemini');
        return null;
      }

      const embedding = response.embeddings[0];

      // Store in database
      const result = await queryOne<Embedding>(
        `INSERT INTO embeddings (entity_type, entity_id, embedding, metadata)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (entity_type, entity_id) DO UPDATE SET
           embedding = EXCLUDED.embedding,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()
         RETURNING *`,
        [entityType, entityId, `[${embedding.join(',')}]`, JSON.stringify(metadata || {})]
      );

      return result;
    } catch (error) {
      console.error('Error generating embedding:', error);
      return null;
    }
  }

  /**
   * Batch generate and store embeddings
   */
  async batchGenerateEmbeddings(
    items: Array<{
      entityType: EmbeddingEntityType;
      entityId: string;
      text: string;
      metadata?: Record<string, unknown>;
    }>
  ): Promise<number> {
    if (!geminiClient.isEnabled() || items.length === 0) {
      return 0;
    }

    let successCount = 0;

    // Process in batches
    for (let i = 0; i < items.length; i += CONFIG.batchSize) {
      const batch = items.slice(i, i + CONFIG.batchSize);
      const texts = batch.map((item) => item.text);

      try {
        const response = await geminiClient.generateEmbedding({ text: texts });

        // Store each embedding
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          const embedding = response.embeddings[j];

          if (embedding) {
            try {
              await execute(
                `INSERT INTO embeddings (entity_type, entity_id, embedding, metadata)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (entity_type, entity_id) DO UPDATE SET
                   embedding = EXCLUDED.embedding,
                   metadata = EXCLUDED.metadata,
                   updated_at = NOW()`,
                [
                  item.entityType,
                  item.entityId,
                  `[${embedding.join(',')}]`,
                  JSON.stringify(item.metadata || {}),
                ]
              );
              successCount++;
            } catch (dbError) {
              console.error('Error storing embedding:', dbError);
            }
          }
        }
      } catch (error) {
        console.error('Error in batch embedding generation:', error);
      }
    }

    return successCount;
  }

  /**
   * Find similar entities using vector similarity search
   */
  async findSimilar(
    entityType: EmbeddingEntityType,
    entityId: string,
    limit: number = CONFIG.defaultLimit,
    minSimilarity: number = CONFIG.minSimilarityThreshold
  ): Promise<Array<{ entity_id: string; similarity: number; metadata: Record<string, unknown> }>> {
    try {
      const results = await query<{
        entity_id: string;
        similarity: number;
        metadata: Record<string, unknown>;
      }>(
        `SELECT
           e2.entity_id,
           1 - (e2.embedding <=> e1.embedding) as similarity,
           e2.metadata
         FROM embeddings e1
         JOIN embeddings e2 ON e2.entity_type = e1.entity_type AND e2.entity_id <> e1.entity_id
         WHERE e1.entity_type = $1
         AND e1.entity_id = $2
         AND 1 - (e2.embedding <=> e1.embedding) >= $3
         ORDER BY e2.embedding <=> e1.embedding
         LIMIT $4`,
        [entityType, entityId, minSimilarity, limit]
      );

      return results;
    } catch (error) {
      console.error('Error finding similar entities:', error);
      return [];
    }
  }

  /**
   * Find similar articles using the database function
   */
  async findSimilarArticles(
    articleId: string,
    limit: number = 5,
    minSimilarity: number = CONFIG.minSimilarityThreshold
  ): Promise<Array<{ article_id: string; title: string; similarity: number }>> {
    try {
      const results = await query<{
        article_id: string;
        title: string;
        similarity: number;
      }>(
        `SELECT * FROM find_similar_articles($1, $2, $3)`,
        [articleId, limit, minSimilarity]
      );

      return results;
    } catch (error) {
      console.error('Error finding similar articles:', error);
      return [];
    }
  }

  /**
   * Create or update article corroboration records
   */
  async updateArticleCorroborations(articleId: string): Promise<number> {
    try {
      // Find similar articles
      const similarArticles = await this.findSimilarArticles(articleId, 10, 0.6);

      if (similarArticles.length === 0) {
        return 0;
      }

      // Get source info for diversity calculation
      const articleInfo = await queryOne<{ url: string; published_at: string }>(
        `SELECT url, published_at FROM news_events WHERE id = $1`,
        [articleId]
      );

      if (!articleInfo) {
        return 0;
      }

      const sourceA = new URL(articleInfo.url).hostname;
      const publishedA = new Date(articleInfo.published_at);

      let insertCount = 0;

      for (const similar of similarArticles) {
        // Get similar article info
        const similarInfo = await queryOne<{ url: string; published_at: string }>(
          `SELECT url, published_at FROM news_events WHERE id = $1`,
          [similar.article_id]
        );

        if (!similarInfo) continue;

        const sourceB = new URL(similarInfo.url).hostname;
        const publishedB = new Date(similarInfo.published_at);

        // Calculate bonuses
        const diversityBonus = sourceA !== sourceB ? 0.1 : 0;
        const timeDiffHours = Math.abs(publishedA.getTime() - publishedB.getTime()) / (1000 * 60 * 60);
        const temporalBonus = timeDiffHours < 24 ? 0.05 : timeDiffHours < 48 ? 0.02 : 0;

        // Ensure consistent ordering (smaller ID first)
        const [idA, idB] = [articleId, similar.article_id].sort();

        try {
          await execute(
            `INSERT INTO article_corroborations
             (article_a_id, article_b_id, similarity_score, source_diversity_bonus, temporal_proximity_bonus)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (article_a_id, article_b_id) DO UPDATE SET
               similarity_score = EXCLUDED.similarity_score,
               source_diversity_bonus = EXCLUDED.source_diversity_bonus,
               temporal_proximity_bonus = EXCLUDED.temporal_proximity_bonus`,
            [idA, idB, similar.similarity, diversityBonus, temporalBonus]
          );
          insertCount++;
        } catch (dbError) {
          console.error('Error inserting corroboration:', dbError);
        }
      }

      return insertCount;
    } catch (error) {
      console.error('Error updating article corroborations:', error);
      return 0;
    }
  }

  /**
   * Get corroboration score for a news event
   */
  async getCorroborationScore(newsEventId: string): Promise<number> {
    try {
      const result = await queryOne<{ calculate_corroboration_score: number }>(
        `SELECT calculate_corroboration_score($1)`,
        [newsEventId]
      );

      return result?.calculate_corroboration_score || 0.3;
    } catch (error) {
      console.error('Error calculating corroboration score:', error);
      return 0.3; // Default base score
    }
  }

  /**
   * Search for similar content by text query
   */
  async semanticSearch(
    queryText: string,
    entityType: EmbeddingEntityType,
    limit: number = CONFIG.defaultLimit,
    minSimilarity: number = CONFIG.minSimilarityThreshold
  ): Promise<Array<{ entity_id: string; similarity: number }>> {
    if (!geminiClient.isEnabled()) {
      return [];
    }

    try {
      // Generate embedding for query
      const response = await geminiClient.generateEmbedding({ text: queryText });

      if (response.embeddings.length === 0) {
        return [];
      }

      const queryEmbedding = response.embeddings[0];

      // Search for similar embeddings
      const results = await query<{ entity_id: string; similarity: number }>(
        `SELECT
           entity_id,
           1 - (embedding <=> $1::vector) as similarity
         FROM embeddings
         WHERE entity_type = $2
         AND 1 - (embedding <=> $1::vector) >= $3
         ORDER BY embedding <=> $1::vector
         LIMIT $4`,
        [`[${queryEmbedding.join(',')}]`, entityType, minSimilarity, limit]
      );

      return results;
    } catch (error) {
      console.error('Error in semantic search:', error);
      return [];
    }
  }

  /**
   * Check if an entity has an embedding
   */
  async hasEmbedding(entityType: EmbeddingEntityType, entityId: string): Promise<boolean> {
    try {
      const result = await queryOne<{ exists: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM embeddings WHERE entity_type = $1 AND entity_id = $2) as exists`,
        [entityType, entityId]
      );

      return result?.exists || false;
    } catch {
      return false;
    }
  }

  /**
   * Delete embedding for an entity
   */
  async deleteEmbedding(entityType: EmbeddingEntityType, entityId: string): Promise<boolean> {
    try {
      await execute(
        `DELETE FROM embeddings WHERE entity_type = $1 AND entity_id = $2`,
        [entityType, entityId]
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get embedding statistics
   */
  async getStats(): Promise<{
    total: number;
    by_type: Record<string, number>;
  }> {
    try {
      const totalResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM embeddings`
      );

      const byTypeResults = await query<{ entity_type: string; count: string }>(
        `SELECT entity_type, COUNT(*) as count FROM embeddings GROUP BY entity_type`
      );

      const byType: Record<string, number> = {};
      for (const row of byTypeResults) {
        byType[row.entity_type] = parseInt(row.count, 10);
      }

      return {
        total: parseInt(totalResult?.count || '0', 10),
        by_type: byType,
      };
    } catch {
      return { total: 0, by_type: {} };
    }
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
