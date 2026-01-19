import { execute, queryOne, query } from '@/lib/db';
import type {
  AircraftCooccurrence,
  AircraftRelationship,
  RelationshipType,
  RelationshipSource,
  RelationshipEvidence,
  CooccurrenceUpdate,
} from '@/lib/types/network';
import type { FormationType } from '@/lib/types/ml';

// Configuration
const CONFIG = {
  // Scoring weights
  weights: {
    frequency: 0.4, // How often they fly together
    formation: 0.35, // How often in same formation
    recency: 0.25, // How recently they flew together
  },
  // Decay rate per day
  decayRate: 0.05,
  // Minimum score to maintain relationship
  minRelationshipScore: 0.1,
  // Minimum co-occurrences to infer relationship
  minCooccurrencesForRelationship: 3,
  // Proximity threshold (nm)
  proximityThreshold: 20,
  // Formation score bonus
  formationBonus: 2.0,
  // Relationship confidence thresholds
  confidenceThresholds: {
    high: 0.8,
    medium: 0.5,
    low: 0.2,
  },
};

export class NetworkIntelligence {
  /**
   * Update co-occurrence from a detected formation
   */
  async updateCooccurrenceFromFormation(
    formationType: FormationType,
    aircraftIds: string[],
    icaoHexes: string[]
  ): Promise<number> {
    if (aircraftIds.length < 2) return 0;

    let updated = 0;

    try {
      // Update all pairs in the formation
      for (let i = 0; i < aircraftIds.length; i++) {
        for (let j = i + 1; j < aircraftIds.length; j++) {
          const result = await this.updateCooccurrence({
            aircraft_id_1: aircraftIds[i],
            aircraft_id_2: aircraftIds[j],
            icao_hex_1: icaoHexes[i],
            icao_hex_2: icaoHexes[j],
            formation_type: formationType,
            is_formation: true,
            is_proximity: true,
          });

          if (result) updated++;
        }
      }

      return updated;
    } catch (error) {
      console.error('Error updating co-occurrence from formation:', error);
      return updated;
    }
  }

  /**
   * Update co-occurrence record for a pair of aircraft
   */
  async updateCooccurrence(update: CooccurrenceUpdate): Promise<boolean> {
    try {
      // Normalize order (smaller ID first)
      const [id1, id2] =
        update.aircraft_id_1 < update.aircraft_id_2
          ? [update.aircraft_id_1, update.aircraft_id_2]
          : [update.aircraft_id_2, update.aircraft_id_1];

      const [hex1, hex2] =
        update.aircraft_id_1 < update.aircraft_id_2
          ? [update.icao_hex_1, update.icao_hex_2]
          : [update.icao_hex_2, update.icao_hex_1];

      // Calculate score increment
      let scoreIncrement = 1.0;
      if (update.is_formation) {
        scoreIncrement *= CONFIG.formationBonus;
      }

      // Upsert co-occurrence record
      await execute(
        `INSERT INTO aircraft_cooccurrences (
           aircraft_id_1, aircraft_id_2, icao_hex_1, icao_hex_2,
           cooccurrence_count, formation_count, proximity_count,
           weighted_score, first_seen_together, last_seen_together,
           formation_types_seen
         )
         VALUES ($1, $2, $3, $4, 1, $5, $6, $7, NOW(), NOW(), $8)
         ON CONFLICT (aircraft_id_1, aircraft_id_2) DO UPDATE SET
           cooccurrence_count = aircraft_cooccurrences.cooccurrence_count + 1,
           formation_count = aircraft_cooccurrences.formation_count + $5,
           proximity_count = aircraft_cooccurrences.proximity_count + $6,
           weighted_score = aircraft_cooccurrences.weighted_score + $7,
           last_seen_together = NOW(),
           formation_types_seen = CASE
             WHEN $9 IS NOT NULL THEN
               jsonb_set(
                 COALESCE(aircraft_cooccurrences.formation_types_seen, '{}'),
                 ARRAY[$9],
                 (COALESCE((aircraft_cooccurrences.formation_types_seen->>$9)::int, 0) + 1)::text::jsonb
               )
             ELSE aircraft_cooccurrences.formation_types_seen
           END,
           updated_at = NOW()`,
        [
          id1,
          id2,
          hex1,
          hex2,
          update.is_formation ? 1 : 0,
          update.is_proximity ? 1 : 0,
          scoreIncrement,
          update.formation_type ? { [update.formation_type]: 1 } : {},
          update.formation_type || null,
        ]
      );

      return true;
    } catch (error) {
      console.error('Error updating co-occurrence:', error);
      return false;
    }
  }

  /**
   * Calculate relationship strength between two aircraft
   */
  calculateRelationshipStrength(cooccurrence: AircraftCooccurrence): number {
    // Frequency component
    const frequencyScore = Math.min(
      1,
      cooccurrence.cooccurrence_count / 20
    );

    // Formation component
    const formationScore = Math.min(
      1,
      cooccurrence.formation_count / 10
    );

    // Recency component (days since last seen together)
    const daysSinceLastSeen =
      (Date.now() - new Date(cooccurrence.last_seen_together).getTime()) /
      (1000 * 60 * 60 * 24);
    const recencyScore = Math.exp(-daysSinceLastSeen / 30); // Decay over 30 days

    // Combined score
    return (
      frequencyScore * CONFIG.weights.frequency +
      formationScore * CONFIG.weights.formation +
      recencyScore * CONFIG.weights.recency
    );
  }

  /**
   * Infer relationships from co-occurrence data
   */
  async inferRelationships(): Promise<{
    created: number;
    updated: number;
  }> {
    const stats = { created: 0, updated: 0 };

    try {
      // Get co-occurrences that meet threshold
      const cooccurrences = await query<AircraftCooccurrence>(
        `SELECT * FROM aircraft_cooccurrences
         WHERE cooccurrence_count >= $1
         AND last_seen_together >= NOW() - INTERVAL '90 days'
         ORDER BY weighted_score DESC
         LIMIT 1000`,
        [CONFIG.minCooccurrencesForRelationship]
      );

      for (const coo of cooccurrences) {
        const strength = this.calculateRelationshipStrength(coo);

        if (strength < CONFIG.minRelationshipScore) {
          continue;
        }

        // Determine relationship type
        const relationshipType = this.inferRelationshipType(coo);

        // Build evidence
        const evidence: RelationshipEvidence[] = [
          {
            type: 'cooccurrence',
            description: `Seen together ${coo.cooccurrence_count} times`,
            weight: 0.4,
          },
        ];

        if (coo.formation_count > 0) {
          evidence.push({
            type: 'formation',
            description: `In formation together ${coo.formation_count} times`,
            weight: 0.4,
          });
        }

        // Calculate confidence
        const confidence = Math.min(0.95, strength * 1.2);

        // Upsert relationship
        const result = await this.upsertRelationship({
          aircraft_id_1: coo.aircraft_id_1,
          aircraft_id_2: coo.aircraft_id_2,
          icao_hex_1: coo.icao_hex_1,
          icao_hex_2: coo.icao_hex_2,
          relationship_type: relationshipType,
          relationship_strength: strength,
          source: 'inferred',
          inference_method: 'cooccurrence_analysis',
          evidence,
          confidence,
        });

        if (result.created) {
          stats.created++;
        } else if (result.updated) {
          stats.updated++;
        }
      }

      return stats;
    } catch (error) {
      console.error('Error inferring relationships:', error);
      return stats;
    }
  }

  /**
   * Infer relationship type from co-occurrence data
   */
  private inferRelationshipType(coo: AircraftCooccurrence): RelationshipType {
    // Check formation types seen
    const formationTypes = coo.formation_types_seen || {};

    // Tanker pair if seen in tanker_receiver formation
    if ((formationTypes.tanker_receiver || 0) > 0) {
      return 'tanker_pair';
    }

    // Escort pair if seen in escort formation
    if ((formationTypes.escort || 0) > 0) {
      return 'escort_pair';
    }

    // Training pair if high co-occurrence but varied formations
    if (
      coo.cooccurrence_count >= 10 &&
      Object.keys(formationTypes).length >= 2
    ) {
      return 'training_pair';
    }

    // Default to same operator (most common)
    return 'same_operator';
  }

  /**
   * Upsert a relationship record
   */
  private async upsertRelationship(params: {
    aircraft_id_1: string;
    aircraft_id_2: string;
    icao_hex_1: string;
    icao_hex_2: string;
    relationship_type: RelationshipType;
    relationship_strength: number;
    source: RelationshipSource;
    inference_method?: string;
    evidence: RelationshipEvidence[];
    confidence: number;
  }): Promise<{ created: boolean; updated: boolean }> {
    try {
      // Normalize order
      const [id1, id2] =
        params.aircraft_id_1 < params.aircraft_id_2
          ? [params.aircraft_id_1, params.aircraft_id_2]
          : [params.aircraft_id_2, params.aircraft_id_1];

      const existing = await queryOne<AircraftRelationship>(
        `SELECT * FROM aircraft_relationships
         WHERE aircraft_id_1 = $1 AND aircraft_id_2 = $2
         AND relationship_type = $3`,
        [id1, id2, params.relationship_type]
      );

      if (existing) {
        // Don't override confirmed relationships
        if (existing.is_confirmed) {
          return { created: false, updated: false };
        }

        await execute(
          `UPDATE aircraft_relationships SET
             relationship_strength = $1,
             evidence = $2,
             confidence = $3,
             updated_at = NOW()
           WHERE id = $4`,
          [
            params.relationship_strength,
            JSON.stringify(params.evidence),
            params.confidence,
            existing.id,
          ]
        );
        return { created: false, updated: true };
      } else {
        await execute(
          `INSERT INTO aircraft_relationships (
             aircraft_id_1, aircraft_id_2, icao_hex_1, icao_hex_2,
             relationship_type, relationship_strength,
             source, inference_method, evidence, confidence
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            id1,
            id2,
            params.icao_hex_1,
            params.icao_hex_2,
            params.relationship_type,
            params.relationship_strength,
            params.source,
            params.inference_method || null,
            JSON.stringify(params.evidence),
            params.confidence,
          ]
        );
        return { created: true, updated: false };
      }
    } catch (error) {
      console.error('Error upserting relationship:', error);
      return { created: false, updated: false };
    }
  }

  /**
   * Get relationships for an aircraft
   */
  async getRelationshipsForAircraft(
    aircraftId: string
  ): Promise<AircraftRelationship[]> {
    try {
      return await query<AircraftRelationship>(
        `SELECT * FROM aircraft_relationships
         WHERE (aircraft_id_1 = $1 OR aircraft_id_2 = $1)
         AND is_active = true
         ORDER BY relationship_strength DESC`,
        [aircraftId]
      );
    } catch (error) {
      console.error('Error getting relationships:', error);
      return [];
    }
  }

  /**
   * Get co-occurrences for an aircraft
   */
  async getCooccurrencesForAircraft(
    aircraftId: string,
    limit: number = 20
  ): Promise<AircraftCooccurrence[]> {
    try {
      return await query<AircraftCooccurrence>(
        `SELECT * FROM aircraft_cooccurrences
         WHERE aircraft_id_1 = $1 OR aircraft_id_2 = $1
         ORDER BY weighted_score DESC
         LIMIT $2`,
        [aircraftId, limit]
      );
    } catch (error) {
      console.error('Error getting co-occurrences:', error);
      return [];
    }
  }

  /**
   * Apply daily decay to co-occurrence scores
   */
  async applyScoreDecay(): Promise<number> {
    try {
      const result = await queryOne<{ count: string }>(
        `SELECT decay_cooccurrence_scores($1) as count`,
        [CONFIG.decayRate]
      );
      return parseInt(result?.count || '0', 10);
    } catch (error) {
      console.error('Error applying score decay:', error);
      return 0;
    }
  }

  /**
   * Manually create a relationship
   */
  async createManualRelationship(
    params: {
      aircraft_id_1: string;
      aircraft_id_2: string;
      icao_hex_1: string;
      icao_hex_2: string;
      relationship_type: RelationshipType;
      confirmed_by: string;
    }
  ): Promise<AircraftRelationship | null> {
    try {
      // Normalize order
      const [id1, id2] =
        params.aircraft_id_1 < params.aircraft_id_2
          ? [params.aircraft_id_1, params.aircraft_id_2]
          : [params.aircraft_id_2, params.aircraft_id_1];

      const [hex1, hex2] =
        params.aircraft_id_1 < params.aircraft_id_2
          ? [params.icao_hex_1, params.icao_hex_2]
          : [params.icao_hex_2, params.icao_hex_1];

      return await queryOne<AircraftRelationship>(
        `INSERT INTO aircraft_relationships (
           aircraft_id_1, aircraft_id_2, icao_hex_1, icao_hex_2,
           relationship_type, relationship_strength,
           source, evidence, confidence,
           is_confirmed, confirmed_by, confirmed_at
         )
         VALUES ($1, $2, $3, $4, $5, 1.0, 'manual', '[]', 1.0, true, $6, NOW())
         ON CONFLICT (aircraft_id_1, aircraft_id_2, relationship_type)
         DO UPDATE SET
           is_confirmed = true,
           confirmed_by = $6,
           confirmed_at = NOW(),
           updated_at = NOW()
         RETURNING *`,
        [id1, id2, hex1, hex2, params.relationship_type, params.confirmed_by]
      );
    } catch (error) {
      console.error('Error creating manual relationship:', error);
      return null;
    }
  }

  /**
   * Delete a relationship
   */
  async deleteRelationship(relationshipId: string): Promise<boolean> {
    try {
      const result = await execute(
        `UPDATE aircraft_relationships
         SET is_active = false, updated_at = NOW()
         WHERE id = $1`,
        [relationshipId]
      );
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting relationship:', error);
      return false;
    }
  }

  /**
   * Get network statistics
   */
  async getStats(): Promise<{
    total_cooccurrences: number;
    total_relationships: number;
    confirmed_relationships: number;
    avg_strength: number;
  }> {
    try {
      const cooCount = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM aircraft_cooccurrences`
      );

      const relCount = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM aircraft_relationships WHERE is_active = true`
      );

      const confirmedCount = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM aircraft_relationships
         WHERE is_active = true AND is_confirmed = true`
      );

      const avgStrength = await queryOne<{ avg: string }>(
        `SELECT AVG(relationship_strength) as avg FROM aircraft_relationships
         WHERE is_active = true`
      );

      return {
        total_cooccurrences: parseInt(cooCount?.count || '0', 10),
        total_relationships: parseInt(relCount?.count || '0', 10),
        confirmed_relationships: parseInt(confirmedCount?.count || '0', 10),
        avg_strength: parseFloat(avgStrength?.avg || '0'),
      };
    } catch {
      return {
        total_cooccurrences: 0,
        total_relationships: 0,
        confirmed_relationships: 0,
        avg_strength: 0,
      };
    }
  }
}

// Export singleton instance
export const networkIntelligence = new NetworkIntelligence();
