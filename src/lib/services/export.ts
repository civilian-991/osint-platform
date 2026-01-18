/**
 * Export Service
 * Generates CSV, JSON exports for correlations and aircraft data
 */

import type { CorrelationWithRelations } from '@/lib/types/correlation';
import type { Aircraft, PositionLatest } from '@/lib/types/aircraft';

export type ExportFormat = 'csv' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  dateRange?: { start: Date; end: Date };
  includeMetadata?: boolean;
}

export class ExportService {
  /**
   * Generate CSV from array of objects
   */
  generateCSV<T extends Record<string, unknown>>(
    data: T[],
    columns?: { key: keyof T; header: string }[]
  ): string {
    if (data.length === 0) return '';

    // Determine columns
    const cols = columns || Object.keys(data[0]).map(key => ({
      key: key as keyof T,
      header: this.formatHeader(key),
    }));

    // Generate header row
    const header = cols.map(c => this.escapeCSV(c.header)).join(',');

    // Generate data rows
    const rows = data.map(row =>
      cols.map(col => {
        const value = row[col.key];
        return this.escapeCSV(this.formatValue(value));
      }).join(',')
    );

    return [header, ...rows].join('\n');
  }

  /**
   * Generate JSON string
   */
  generateJSON<T>(data: T[], pretty: boolean = true): string {
    return JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        count: data.length,
        data,
      },
      null,
      pretty ? 2 : 0
    );
  }

  /**
   * Export correlations data
   */
  exportCorrelations(
    correlations: CorrelationWithRelations[],
    options: ExportOptions
  ): string {
    const columns: { key: keyof CorrelationWithRelations | string; header: string }[] = [
      { key: 'id', header: 'ID' },
      { key: 'correlation_type', header: 'Type' },
      { key: 'confidence_score', header: 'Confidence' },
      { key: 'temporal_score', header: 'Temporal Score' },
      { key: 'spatial_score', header: 'Spatial Score' },
      { key: 'entity_score', header: 'Entity Score' },
      { key: 'pattern_score', header: 'Pattern Score' },
      { key: 'status', header: 'Status' },
      { key: 'created_at', header: 'Created At' },
      { key: 'news_title', header: 'News Title' },
      { key: 'aircraft_icao', header: 'Aircraft ICAO' },
      { key: 'aircraft_type', header: 'Aircraft Type' },
    ];

    // Flatten correlations for export
    const flatData = correlations.map(c => ({
      id: c.id,
      correlation_type: c.correlation_type,
      confidence_score: Math.round(c.confidence_score * 100) / 100,
      temporal_score: Math.round(c.temporal_score * 100) / 100,
      spatial_score: Math.round(c.spatial_score * 100) / 100,
      entity_score: Math.round(c.entity_score * 100) / 100,
      pattern_score: Math.round(c.pattern_score * 100) / 100,
      status: c.status,
      created_at: c.created_at,
      news_title: c.news_event?.title || '',
      aircraft_icao: c.aircraft?.icao_hex || '',
      aircraft_type: c.aircraft?.type_code || '',
      notes: c.notes || '',
    }));

    if (options.format === 'json') {
      return this.generateJSON(flatData);
    }

    return this.generateCSV(flatData, columns as Array<{ key: keyof typeof flatData[0]; header: string }>);
  }

  /**
   * Export aircraft data
   */
  exportAircraft(
    aircraft: (Aircraft | PositionLatest)[],
    options: ExportOptions
  ): string {
    const columns = [
      { key: 'icao_hex', header: 'ICAO Hex' },
      { key: 'registration', header: 'Registration' },
      { key: 'callsign', header: 'Callsign' },
      { key: 'type_code', header: 'Type Code' },
      { key: 'type_description', header: 'Type Description' },
      { key: 'operator', header: 'Operator' },
      { key: 'is_military', header: 'Military' },
      { key: 'military_category', header: 'Category' },
      { key: 'latitude', header: 'Latitude' },
      { key: 'longitude', header: 'Longitude' },
      { key: 'altitude', header: 'Altitude (ft)' },
      { key: 'ground_speed', header: 'Speed (kts)' },
      { key: 'track', header: 'Track' },
      { key: 'timestamp', header: 'Last Seen' },
    ];

    // Normalize data (handle both Aircraft and PositionLatest)
    const flatData = aircraft.map(a => {
      const isPosition = 'latitude' in a;
      const ac = isPosition ? (a as PositionLatest).aircraft : null;

      return {
        icao_hex: a.icao_hex,
        registration: isPosition ? ac?.registration : (a as Aircraft).registration,
        callsign: isPosition ? (a as PositionLatest).callsign : null,
        type_code: isPosition ? ac?.type_code : (a as Aircraft).type_code,
        type_description: isPosition ? ac?.type_description : (a as Aircraft).type_description,
        operator: isPosition ? ac?.operator : (a as Aircraft).operator,
        is_military: isPosition ? ac?.is_military : (a as Aircraft).is_military,
        military_category: isPosition ? ac?.military_category : (a as Aircraft).military_category,
        latitude: isPosition ? (a as PositionLatest).latitude : null,
        longitude: isPosition ? (a as PositionLatest).longitude : null,
        altitude: isPosition ? (a as PositionLatest).altitude : null,
        ground_speed: isPosition ? (a as PositionLatest).ground_speed : null,
        track: isPosition ? (a as PositionLatest).track : null,
        timestamp: isPosition ? (a as PositionLatest).timestamp : (a as Aircraft).updated_at,
      };
    });

    if (options.format === 'json') {
      return this.generateJSON(flatData);
    }

    return this.generateCSV(flatData, columns as Array<{ key: keyof typeof flatData[0]; header: string }>);
  }

  /**
   * Escape CSV value
   */
  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Format header from key
   */
  private formatHeader(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Format value for CSV
   */
  private formatValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  /**
   * Trigger file download in browser
   */
  downloadFile(content: string, filename: string, format: ExportFormat): void {
    const mimeTypes: Record<ExportFormat, string> = {
      csv: 'text/csv;charset=utf-8;',
      json: 'application/json;charset=utf-8;',
    };

    const blob = new Blob([content], { type: mimeTypes[format] });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Export singleton instance
export const exportService = new ExportService();
