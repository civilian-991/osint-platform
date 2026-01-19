import { execute, queryOne, query } from '@/lib/db';
import type {
  ActivityMetrics,
  TrendData,
  TrendDataPoint,
  TrendPeriod,
  MetricScope,
} from '@/lib/types/dashboard';

// Configuration
const CONFIG = {
  periodDays: {
    '24h': 1,
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '1y': 365,
  } as Record<TrendPeriod, number>,
};

export class MetricsService {
  /**
   * Collect and store daily metrics
   */
  async collectDailyMetrics(
    date: Date = new Date()
  ): Promise<ActivityMetrics | null> {
    try {
      const metricDate = date.toISOString().split('T')[0];

      // Aircraft metrics
      const aircraftMetrics = await queryOne<{
        total: string;
        unique: string;
        military: string;
        civilian: string;
      }>(
        `SELECT
           COUNT(*) as total,
           COUNT(DISTINCT pl.icao_hex) as unique,
           COUNT(DISTINCT CASE WHEN a.is_military THEN pl.icao_hex END) as military,
           COUNT(DISTINCT CASE WHEN NOT a.is_military THEN pl.icao_hex END) as civilian
         FROM positions p
         JOIN aircraft a ON a.id = p.aircraft_id
         JOIN positions_latest pl ON pl.aircraft_id = p.aircraft_id
         WHERE DATE(p.timestamp) = $1`,
        [metricDate]
      );

      // Flight metrics
      const flightMetrics = await queryOne<{
        total_flights: string;
        total_hours: string;
        avg_duration: string;
      }>(
        `SELECT
           COUNT(*) as total_flights,
           COALESCE(SUM(EXTRACT(EPOCH FROM (arrival_time - departure_time)) / 3600), 0) as total_hours,
           COALESCE(AVG(EXTRACT(EPOCH FROM (arrival_time - departure_time)) / 60), 0) as avg_duration
         FROM flights
         WHERE DATE(departure_time) = $1`,
        [metricDate]
      );

      // Activity metrics
      const activityMetrics = await queryOne<{
        formations: string;
        anomalies: string;
        alerts: string;
      }>(
        `SELECT
           (SELECT COUNT(*) FROM formation_detections WHERE DATE(first_detected_at) = $1) as formations,
           (SELECT COUNT(*) FROM anomaly_detections WHERE DATE(created_at) = $1) as anomalies,
           (SELECT COUNT(*) FROM alerts WHERE DATE(created_at) = $1) as alerts`,
        [metricDate]
      );

      // Threat metrics
      const threatMetrics = await queryOne<{
        high_threat: string;
        avg_threat: string;
        max_threat: string;
      }>(
        `SELECT
           COUNT(*) FILTER (WHERE threat_level IN ('high', 'critical')) as high_threat,
           AVG(threat_score) as avg_threat,
           MAX(threat_score) as max_threat
         FROM threat_assessments
         WHERE DATE(created_at) = $1`,
        [metricDate]
      );

      // Position metrics
      const positionMetrics = await queryOne<{
        total_positions: string;
        positions_per_aircraft: string;
      }>(
        `SELECT
           COUNT(*) as total_positions,
           COUNT(*)::float / NULLIF(COUNT(DISTINCT aircraft_id), 0) as positions_per_aircraft
         FROM positions
         WHERE DATE(timestamp) = $1`,
        [metricDate]
      );

      // Type breakdown
      const typeBreakdown = await query<{ type_code: string; count: string }>(
        `SELECT a.type_code, COUNT(DISTINCT pl.icao_hex) as count
         FROM positions_latest pl
         JOIN aircraft a ON a.id = pl.aircraft_id
         WHERE DATE(pl.timestamp) = $1 AND a.type_code IS NOT NULL
         GROUP BY a.type_code
         ORDER BY count DESC
         LIMIT 20`,
        [metricDate]
      );

      // Formation type breakdown
      const formationBreakdown = await query<{ formation_type: string; count: string }>(
        `SELECT formation_type, COUNT(*) as count
         FROM formation_detections
         WHERE DATE(first_detected_at) = $1
         GROUP BY formation_type`,
        [metricDate]
      );

      // Intent breakdown
      const intentBreakdown = await query<{ intent: string; count: string }>(
        `SELECT intent, COUNT(*) as count
         FROM intent_classifications
         WHERE DATE(created_at) = $1
         GROUP BY intent`,
        [metricDate]
      );

      // Build breakdown objects
      const aircraftTypeBreakdown: Record<string, number> = {};
      for (const row of typeBreakdown) {
        aircraftTypeBreakdown[row.type_code] = parseInt(row.count, 10);
      }

      const formationTypeBreakdown: Record<string, number> = {};
      for (const row of formationBreakdown) {
        formationTypeBreakdown[row.formation_type] = parseInt(row.count, 10);
      }

      const intentBreakdownObj: Record<string, number> = {};
      for (const row of intentBreakdown) {
        intentBreakdownObj[row.intent] = parseInt(row.count, 10);
      }

      // Upsert metrics
      const metrics = await queryOne<ActivityMetrics>(
        `INSERT INTO activity_metrics (
           metric_date, scope_type, scope_value,
           total_aircraft, unique_aircraft, military_aircraft, civilian_aircraft,
           total_flights, total_flight_hours, avg_flight_duration_minutes,
           formations_detected, anomalies_detected, alerts_generated,
           high_threat_events, avg_threat_score, max_threat_score,
           total_positions, positions_per_aircraft,
           aircraft_type_breakdown, formation_type_breakdown, intent_breakdown
         )
         VALUES (
           $1, 'global', NULL,
           $2, $3, $4, $5,
           $6, $7, $8,
           $9, $10, $11,
           $12, $13, $14,
           $15, $16,
           $17, $18, $19
         )
         ON CONFLICT (metric_date, scope_type, scope_value)
         DO UPDATE SET
           total_aircraft = EXCLUDED.total_aircraft,
           unique_aircraft = EXCLUDED.unique_aircraft,
           military_aircraft = EXCLUDED.military_aircraft,
           civilian_aircraft = EXCLUDED.civilian_aircraft,
           total_flights = EXCLUDED.total_flights,
           total_flight_hours = EXCLUDED.total_flight_hours,
           avg_flight_duration_minutes = EXCLUDED.avg_flight_duration_minutes,
           formations_detected = EXCLUDED.formations_detected,
           anomalies_detected = EXCLUDED.anomalies_detected,
           alerts_generated = EXCLUDED.alerts_generated,
           high_threat_events = EXCLUDED.high_threat_events,
           avg_threat_score = EXCLUDED.avg_threat_score,
           max_threat_score = EXCLUDED.max_threat_score,
           total_positions = EXCLUDED.total_positions,
           positions_per_aircraft = EXCLUDED.positions_per_aircraft,
           aircraft_type_breakdown = EXCLUDED.aircraft_type_breakdown,
           formation_type_breakdown = EXCLUDED.formation_type_breakdown,
           intent_breakdown = EXCLUDED.intent_breakdown,
           updated_at = NOW()
         RETURNING *`,
        [
          metricDate,
          parseInt(aircraftMetrics?.total || '0', 10),
          parseInt(aircraftMetrics?.unique || '0', 10),
          parseInt(aircraftMetrics?.military || '0', 10),
          parseInt(aircraftMetrics?.civilian || '0', 10),
          parseInt(flightMetrics?.total_flights || '0', 10),
          parseFloat(flightMetrics?.total_hours || '0'),
          parseInt(flightMetrics?.avg_duration || '0', 10) || null,
          parseInt(activityMetrics?.formations || '0', 10),
          parseInt(activityMetrics?.anomalies || '0', 10),
          parseInt(activityMetrics?.alerts || '0', 10),
          parseInt(threatMetrics?.high_threat || '0', 10),
          parseFloat(threatMetrics?.avg_threat || '0') || null,
          parseFloat(threatMetrics?.max_threat || '0') || null,
          parseInt(positionMetrics?.total_positions || '0', 10),
          parseFloat(positionMetrics?.positions_per_aircraft || '0') || null,
          JSON.stringify(aircraftTypeBreakdown),
          JSON.stringify(formationTypeBreakdown),
          JSON.stringify(intentBreakdownObj),
        ]
      );

      return metrics;
    } catch (error) {
      console.error('Error collecting daily metrics:', error);
      return null;
    }
  }

  /**
   * Get trend data for specified metrics
   */
  async getTrendData(
    metrics: string[],
    period: TrendPeriod,
    scope: MetricScope = 'global',
    scopeValue?: string
  ): Promise<TrendData[]> {
    const trends: TrendData[] = [];
    const days = CONFIG.periodDays[period];

    try {
      for (const metric of metrics) {
        const data = await this.getMetricTrend(metric, days, scope, scopeValue);
        if (data) {
          trends.push(data);
        }
      }

      return trends;
    } catch (error) {
      console.error('Error getting trend data:', error);
      return [];
    }
  }

  /**
   * Get trend for a single metric
   */
  private async getMetricTrend(
    metric: string,
    days: number,
    scope: MetricScope,
    scopeValue?: string
  ): Promise<TrendData | null> {
    try {
      let scopeClause = `scope_type = '${scope}'`;
      if (scopeValue) {
        scopeClause += ` AND scope_value = '${scopeValue}'`;
      } else if (scope === 'global') {
        scopeClause += ' AND scope_value IS NULL';
      }

      // Get historical data points
      const results = await query<{ metric_date: string; value: number }>(
        `SELECT metric_date, ${metric} as value
         FROM activity_metrics
         WHERE ${scopeClause}
         AND metric_date >= CURRENT_DATE - INTERVAL '${days} days'
         ORDER BY metric_date ASC`
      );

      if (results.length === 0) {
        return null;
      }

      const dataPoints: TrendDataPoint[] = results.map((r) => ({
        timestamp: r.metric_date,
        value: r.value || 0,
      }));

      const values = dataPoints.map((d) => d.value);
      const currentValue = values[values.length - 1] || 0;
      const previousValue = values.length > 1 ? values[values.length - 2] : currentValue;

      const changePercent =
        previousValue !== 0
          ? ((currentValue - previousValue) / previousValue) * 100
          : 0;

      return {
        metric,
        period: this.getPeriodFromDays(days),
        data_points: dataPoints,
        current_value: currentValue,
        previous_value: previousValue,
        change_percent: Math.round(changePercent * 10) / 10,
        change_direction: this.getChangeDirection(changePercent),
        trend: this.analyzeTrend(values),
        min_value: Math.min(...values),
        max_value: Math.max(...values),
        avg_value: values.reduce((a, b) => a + b, 0) / values.length,
      };
    } catch (error) {
      console.error(`Error getting trend for ${metric}:`, error);
      return null;
    }
  }

  /**
   * Get period string from days
   */
  private getPeriodFromDays(days: number): TrendPeriod {
    if (days <= 1) return '24h';
    if (days <= 7) return '7d';
    if (days <= 30) return '30d';
    if (days <= 90) return '90d';
    return '1y';
  }

  /**
   * Get change direction
   */
  private getChangeDirection(
    changePercent: number
  ): 'up' | 'down' | 'flat' {
    if (changePercent > 1) return 'up';
    if (changePercent < -1) return 'down';
    return 'flat';
  }

  /**
   * Analyze trend pattern
   */
  private analyzeTrend(
    values: number[]
  ): 'increasing' | 'decreasing' | 'stable' | 'volatile' {
    if (values.length < 3) return 'stable';

    // Calculate trend using simple linear regression slope
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const mean = sumY / n;
    const normalizedSlope = slope / (mean || 1);

    // Calculate volatility (coefficient of variation)
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / (mean || 1);

    if (cv > 0.5) return 'volatile';
    if (normalizedSlope > 0.05) return 'increasing';
    if (normalizedSlope < -0.05) return 'decreasing';
    return 'stable';
  }

  /**
   * Get latest metrics
   */
  async getLatestMetrics(
    scope: MetricScope = 'global',
    scopeValue?: string
  ): Promise<ActivityMetrics | null> {
    try {
      let scopeClause = `scope_type = '${scope}'`;
      if (scopeValue) {
        scopeClause += ` AND scope_value = '${scopeValue}'`;
      } else if (scope === 'global') {
        scopeClause += ' AND scope_value IS NULL';
      }

      return await queryOne<ActivityMetrics>(
        `SELECT * FROM activity_metrics
         WHERE ${scopeClause}
         ORDER BY metric_date DESC
         LIMIT 1`
      );
    } catch (error) {
      console.error('Error getting latest metrics:', error);
      return null;
    }
  }

  /**
   * Get metrics for date range
   */
  async getMetricsRange(
    startDate: string,
    endDate: string,
    scope: MetricScope = 'global',
    scopeValue?: string
  ): Promise<ActivityMetrics[]> {
    try {
      let scopeClause = `scope_type = '${scope}'`;
      if (scopeValue) {
        scopeClause += ` AND scope_value = '${scopeValue}'`;
      } else if (scope === 'global') {
        scopeClause += ' AND scope_value IS NULL';
      }

      return await query<ActivityMetrics>(
        `SELECT * FROM activity_metrics
         WHERE ${scopeClause}
         AND metric_date >= $1 AND metric_date <= $2
         ORDER BY metric_date ASC`,
        [startDate, endDate]
      );
    } catch (error) {
      console.error('Error getting metrics range:', error);
      return [];
    }
  }

  /**
   * Get comparison metrics (current vs previous period)
   */
  async getComparisonMetrics(
    period: TrendPeriod
  ): Promise<{
    current: ActivityMetrics | null;
    previous: ActivityMetrics | null;
    changes: Record<string, number>;
  }> {
    const days = CONFIG.periodDays[period];

    try {
      // Get sum/avg for current period
      const current = await queryOne<ActivityMetrics>(
        `SELECT
           NULL as id,
           NULL as metric_date,
           'global' as scope_type,
           NULL as scope_value,
           SUM(total_aircraft) as total_aircraft,
           SUM(unique_aircraft) as unique_aircraft,
           SUM(military_aircraft) as military_aircraft,
           SUM(civilian_aircraft) as civilian_aircraft,
           SUM(total_flights) as total_flights,
           SUM(total_flight_hours) as total_flight_hours,
           AVG(avg_flight_duration_minutes) as avg_flight_duration_minutes,
           SUM(formations_detected) as formations_detected,
           SUM(anomalies_detected) as anomalies_detected,
           SUM(alerts_generated) as alerts_generated,
           SUM(high_threat_events) as high_threat_events,
           AVG(avg_threat_score) as avg_threat_score,
           MAX(max_threat_score) as max_threat_score,
           SUM(total_positions) as total_positions,
           AVG(positions_per_aircraft) as positions_per_aircraft,
           '{}'::jsonb as aircraft_type_breakdown,
           '{}'::jsonb as formation_type_breakdown,
           '{}'::jsonb as intent_breakdown,
           NOW() as created_at,
           NOW() as updated_at
         FROM activity_metrics
         WHERE scope_type = 'global'
         AND metric_date >= CURRENT_DATE - INTERVAL '${days} days'`
      );

      // Get sum/avg for previous period
      const previous = await queryOne<ActivityMetrics>(
        `SELECT
           NULL as id,
           NULL as metric_date,
           'global' as scope_type,
           NULL as scope_value,
           SUM(total_aircraft) as total_aircraft,
           SUM(unique_aircraft) as unique_aircraft,
           SUM(military_aircraft) as military_aircraft,
           SUM(civilian_aircraft) as civilian_aircraft,
           SUM(total_flights) as total_flights,
           SUM(total_flight_hours) as total_flight_hours,
           AVG(avg_flight_duration_minutes) as avg_flight_duration_minutes,
           SUM(formations_detected) as formations_detected,
           SUM(anomalies_detected) as anomalies_detected,
           SUM(alerts_generated) as alerts_generated,
           SUM(high_threat_events) as high_threat_events,
           AVG(avg_threat_score) as avg_threat_score,
           MAX(max_threat_score) as max_threat_score,
           SUM(total_positions) as total_positions,
           AVG(positions_per_aircraft) as positions_per_aircraft,
           '{}'::jsonb as aircraft_type_breakdown,
           '{}'::jsonb as formation_type_breakdown,
           '{}'::jsonb as intent_breakdown,
           NOW() as created_at,
           NOW() as updated_at
         FROM activity_metrics
         WHERE scope_type = 'global'
         AND metric_date >= CURRENT_DATE - INTERVAL '${days * 2} days'
         AND metric_date < CURRENT_DATE - INTERVAL '${days} days'`
      );

      // Calculate changes
      const changes: Record<string, number> = {};
      const metricsToCompare = [
        'total_aircraft',
        'unique_aircraft',
        'formations_detected',
        'anomalies_detected',
        'alerts_generated',
      ];

      for (const metric of metricsToCompare) {
        const curr = (current as unknown as Record<string, number>)?.[metric] || 0;
        const prev = (previous as unknown as Record<string, number>)?.[metric] || 0;
        changes[metric] = prev !== 0 ? ((curr - prev) / prev) * 100 : 0;
      }

      return { current, previous, changes };
    } catch (error) {
      console.error('Error getting comparison metrics:', error);
      return { current: null, previous: null, changes: {} };
    }
  }

  /**
   * Backfill metrics for missing dates
   */
  async backfillMetrics(startDate: Date, endDate: Date): Promise<number> {
    let filled = 0;

    try {
      const current = new Date(startDate);

      while (current <= endDate) {
        const result = await this.collectDailyMetrics(current);
        if (result) filled++;

        current.setDate(current.getDate() + 1);
      }

      return filled;
    } catch (error) {
      console.error('Error backfilling metrics:', error);
      return filled;
    }
  }
}

// Export singleton instance
export const metricsService = new MetricsService();
