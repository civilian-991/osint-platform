import type { Position, Flight, Aircraft, FlightPattern } from '@/lib/types/aircraft';
import type { NewsEvent, NewsLocation } from '@/lib/types/news';
import type {
  Correlation,
  CorrelationType,
  CorrelationEvidence,
  CorrelationFactors,
  Alert,
  AlertType,
  AlertSeverity,
} from '@/lib/types/correlation';
import { calculateConfidence, getConfidenceLevel } from '@/lib/types/correlation';
import { distanceNm, bearing } from '@/lib/utils/geo';

// Configuration
const CONFIG = {
  // Temporal correlation window (minutes)
  temporalWindowMinutes: 120, // ±2 hours
  // Spatial correlation radius (nautical miles)
  spatialRadiusNm: 50,
  // Minimum confidence to create correlation
  minConfidence: 0.3,
  // Pattern detection thresholds
  orbitMinTurns: 2,
  orbitMaxHeadingVariance: 45,
  racetractMinLength: 20, // nm
  holdingMaxRadius: 10, // nm
};

export class CorrelationEngine {
  /**
   * Find correlations between news events and flight data
   */
  findCorrelations(
    newsEvents: NewsEvent[],
    flights: Flight[],
    positions: Position[]
  ): Omit<Correlation, 'id' | 'created_at' | 'updated_at'>[] {
    const correlations: Omit<Correlation, 'id' | 'created_at' | 'updated_at'>[] = [];

    for (const news of newsEvents) {
      // Find flights that could correlate with this news event
      const temporalMatches = this.findTemporalMatches(news, flights);
      const spatialMatches = this.findSpatialMatches(news, positions);

      // Combine and score matches
      for (const flight of temporalMatches) {
        const factors = this.calculateFactors(news, flight, positions);
        const confidence = calculateConfidence(factors);

        if (confidence >= CONFIG.minConfidence) {
          correlations.push({
            news_event_id: news.id,
            flight_id: flight.id,
            aircraft_id: flight.aircraft_id,
            correlation_type: this.determineType(factors),
            confidence_score: confidence,
            temporal_score: factors.temporalProximity,
            spatial_score: factors.spatialProximity,
            entity_score: 0, // Calculated separately
            pattern_score: factors.patternSignificance,
            corroboration_score: factors.corroboration,
            evidence: this.buildEvidence(news, flight, factors),
            status: 'pending',
            verified_by: null,
            verified_at: null,
            notes: null,
          });
        }
      }
    }

    return correlations;
  }

  /**
   * Find flights within temporal window of news event
   */
  private findTemporalMatches(news: NewsEvent, flights: Flight[]): Flight[] {
    const newsTime = new Date(news.published_at).getTime();
    const windowMs = CONFIG.temporalWindowMinutes * 60 * 1000;

    return flights.filter((flight) => {
      const flightStart = flight.departure_time
        ? new Date(flight.departure_time).getTime()
        : null;
      const flightEnd = flight.arrival_time
        ? new Date(flight.arrival_time).getTime()
        : null;

      // Check if flight overlaps with news time window
      if (flightStart && flightEnd) {
        return (
          (flightStart >= newsTime - windowMs && flightStart <= newsTime + windowMs) ||
          (flightEnd >= newsTime - windowMs && flightEnd <= newsTime + windowMs) ||
          (flightStart <= newsTime && flightEnd >= newsTime)
        );
      }

      // If only start time, check if within window
      if (flightStart) {
        return Math.abs(flightStart - newsTime) <= windowMs;
      }

      return false;
    });
  }

  /**
   * Find positions near news event locations
   */
  private findSpatialMatches(
    news: NewsEvent,
    positions: Position[]
  ): Position[] {
    const newsLocations = news.locations.filter(
      (loc): loc is NewsLocation & { latitude: number; longitude: number } =>
        loc.latitude !== undefined && loc.longitude !== undefined
    );

    if (newsLocations.length === 0) {
      return [];
    }

    return positions.filter((pos) => {
      return newsLocations.some((loc) => {
        const distance = distanceNm(
          pos.latitude,
          pos.longitude,
          loc.latitude,
          loc.longitude
        );
        return distance <= CONFIG.spatialRadiusNm;
      });
    });
  }

  /**
   * Calculate correlation factors
   */
  private calculateFactors(
    news: NewsEvent,
    flight: Flight,
    positions: Position[]
  ): CorrelationFactors {
    return {
      temporalProximity: this.calculateTemporalScore(news, flight),
      spatialProximity: this.calculateSpatialScore(news, flight, positions),
      sourceCredibility: news.credibility_score,
      patternSignificance: this.calculatePatternScore(flight),
      corroboration: 0.5, // Would need multiple sources to calculate
    };
  }

  /**
   * Calculate temporal proximity score (0-1)
   */
  private calculateTemporalScore(news: NewsEvent, flight: Flight): number {
    const newsTime = new Date(news.published_at).getTime();
    const flightTime = flight.departure_time
      ? new Date(flight.departure_time).getTime()
      : Date.now();

    const diffMinutes = Math.abs(newsTime - flightTime) / (1000 * 60);
    const maxWindow = CONFIG.temporalWindowMinutes;

    // Linear decay from 1 to 0 over the window
    return Math.max(0, 1 - diffMinutes / maxWindow);
  }

  /**
   * Calculate spatial proximity score (0-1)
   */
  private calculateSpatialScore(
    news: NewsEvent,
    flight: Flight,
    positions: Position[]
  ): number {
    const newsLocations = news.locations.filter(
      (loc): loc is NewsLocation & { latitude: number; longitude: number } =>
        loc.latitude !== undefined && loc.longitude !== undefined
    );

    if (newsLocations.length === 0) {
      return 0;
    }

    // Find closest position to any news location
    let minDistance = Infinity;

    const flightPositions = positions.filter(
      (p) => p.aircraft_id === flight.aircraft_id
    );

    for (const pos of flightPositions) {
      for (const loc of newsLocations) {
        const distance = distanceNm(
          pos.latitude,
          pos.longitude,
          loc.latitude,
          loc.longitude
        );
        minDistance = Math.min(minDistance, distance);
      }
    }

    if (minDistance === Infinity) {
      return 0;
    }

    // Score decays with distance
    return Math.max(0, 1 - minDistance / CONFIG.spatialRadiusNm);
  }

  /**
   * Calculate pattern significance score (0-1)
   */
  private calculatePatternScore(flight: Flight): number {
    if (!flight.pattern_detected) {
      return 0.2; // Straight flight has some significance
    }

    const patternScores: Record<NonNullable<FlightPattern>, number> = {
      orbit: 0.9,
      racetrack: 0.85,
      holding: 0.7,
      tanker_track: 0.8,
      straight: 0.2,
    };

    return patternScores[flight.pattern_detected] || 0.2;
  }

  /**
   * Determine correlation type based on factors
   */
  private determineType(factors: CorrelationFactors): CorrelationType {
    const scores = [
      { type: 'temporal' as const, score: factors.temporalProximity },
      { type: 'spatial' as const, score: factors.spatialProximity },
      { type: 'pattern' as const, score: factors.patternSignificance },
    ];

    // If multiple factors are strong, it's combined
    const strongFactors = scores.filter((s) => s.score >= 0.6);
    if (strongFactors.length >= 2) {
      return 'combined';
    }

    // Otherwise, use the strongest factor
    scores.sort((a, b) => b.score - a.score);
    return scores[0].type;
  }

  /**
   * Build evidence object for correlation
   */
  private buildEvidence(
    news: NewsEvent,
    flight: Flight,
    factors: CorrelationFactors
  ): CorrelationEvidence {
    const evidence: CorrelationEvidence = {};

    // Temporal evidence
    if (factors.temporalProximity > 0.3) {
      evidence.temporal = {
        newsTime: news.published_at,
        flightTime: flight.departure_time || new Date().toISOString(),
        differenceMinutes: Math.round(
          Math.abs(
            new Date(news.published_at).getTime() -
              new Date(flight.departure_time || Date.now()).getTime()
          ) / 60000
        ),
      };
    }

    // Spatial evidence
    const newsLocation = news.locations.find(
      (loc) => loc.latitude !== undefined && loc.longitude !== undefined
    );
    if (newsLocation && newsLocation.latitude && newsLocation.longitude) {
      evidence.spatial = {
        newsLocation: {
          name: newsLocation.name,
          lat: newsLocation.latitude,
          lon: newsLocation.longitude,
        },
        flightPosition: {
          lat: 0, // Would need actual flight position
          lon: 0,
        },
        distanceNm: 0,
      };
    }

    // Pattern evidence
    if (flight.pattern_detected) {
      evidence.pattern = {
        detectedPattern: flight.pattern_detected,
        duration: 0,
        area: '',
      };
    }

    return evidence;
  }

  /**
   * Detect flight patterns from position history
   */
  detectPattern(positions: Position[]): FlightPattern {
    if (positions.length < 10) {
      return 'straight';
    }

    // Sort by timestamp
    const sorted = [...positions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate heading changes
    const headingChanges: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      const hdg = bearing(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
      if (i > 1) {
        const prevHdg = headingChanges[headingChanges.length - 1] || 0;
        let change = hdg - prevHdg;
        if (change > 180) change -= 360;
        if (change < -180) change += 360;
        headingChanges.push(Math.abs(change));
      }
    }

    // Calculate bounding box
    const lats = sorted.map((p) => p.latitude);
    const lons = sorted.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const latRange = maxLat - minLat;
    const lonRange = maxLon - minLon;
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;

    // Calculate max distance from center
    let maxDistFromCenter = 0;
    for (const pos of sorted) {
      const dist = distanceNm(pos.latitude, pos.longitude, centerLat, centerLon);
      maxDistFromCenter = Math.max(maxDistFromCenter, dist);
    }

    // Detect orbit (circular pattern)
    const avgHeadingChange =
      headingChanges.reduce((a, b) => a + b, 0) / headingChanges.length;
    const consistentTurning =
      headingChanges.filter((h) => h > 5 && h < 60).length >
      headingChanges.length * 0.7;

    if (consistentTurning && maxDistFromCenter < CONFIG.holdingMaxRadius) {
      return 'orbit';
    }

    // Detect racetrack (elongated oval)
    if (latRange > lonRange * 2 || lonRange > latRange * 2) {
      const longAxis = Math.max(latRange, lonRange) * 60; // Convert to nm (rough)
      if (longAxis > CONFIG.racetractMinLength) {
        return 'racetrack';
      }
    }

    // Detect holding (tight area, some turns)
    if (maxDistFromCenter < CONFIG.holdingMaxRadius && avgHeadingChange > 10) {
      return 'holding';
    }

    return 'straight';
  }

  /**
   * Generate alerts from correlations
   */
  generateAlerts(
    correlations: Array<Omit<Correlation, 'id' | 'created_at' | 'updated_at'>>
  ): Omit<Alert, 'id' | 'created_at'>[] {
    const alerts: Omit<Alert, 'id' | 'created_at'>[] = [];

    for (const correlation of correlations) {
      const confidenceLevel = getConfidenceLevel(correlation.confidence_score);

      // Only alert on medium/high confidence
      if (confidenceLevel === 'low') {
        continue;
      }

      const severity: AlertSeverity =
        confidenceLevel === 'high' ? 'high' : 'medium';
      const alertType: AlertType =
        confidenceLevel === 'high' ? 'high_confidence_match' : 'new_correlation';

      alerts.push({
        correlation_id: null, // Will be set after correlation is saved
        alert_type: alertType,
        severity,
        title: this.generateAlertTitle(correlation),
        description: this.generateAlertDescription(correlation),
        data: {
          confidence: correlation.confidence_score,
          type: correlation.correlation_type,
        },
        is_read: false,
        is_dismissed: false,
      });
    }

    return alerts;
  }

  private generateAlertTitle(
    correlation: Omit<Correlation, 'id' | 'created_at' | 'updated_at'>
  ): string {
    const confidencePercent = Math.round(correlation.confidence_score * 100);
    return `${correlation.correlation_type.charAt(0).toUpperCase() + correlation.correlation_type.slice(1)} Correlation (${confidencePercent}% confidence)`;
  }

  private generateAlertDescription(
    correlation: Omit<Correlation, 'id' | 'created_at' | 'updated_at'>
  ): string {
    const parts: string[] = [];

    if (correlation.evidence.temporal) {
      parts.push(
        `Time difference: ${correlation.evidence.temporal.differenceMinutes} minutes`
      );
    }

    if (correlation.evidence.spatial) {
      parts.push(
        `Location: ${correlation.evidence.spatial.newsLocation.name}`
      );
    }

    if (correlation.evidence.pattern) {
      parts.push(
        `Flight pattern: ${correlation.evidence.pattern.detectedPattern}`
      );
    }

    return parts.join(' | ') || 'Potential correlation detected';
  }
}

// Export singleton instance
export const correlationEngine = new CorrelationEngine();
