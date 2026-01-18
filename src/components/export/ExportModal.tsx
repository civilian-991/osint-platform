'use client';

import { useState } from 'react';
import { X, Download, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import type { ExportFormat } from '@/lib/services/export';
import { cn } from '@/lib/utils/cn';

interface ExportModalProps {
  type: 'correlations' | 'aircraft';
  onExport: (options: { format: ExportFormat; filters?: Record<string, string> }) => void;
  onClose: () => void;
  exporting?: boolean;
}

export default function ExportModal({
  type,
  onExport,
  onClose,
  exporting = false,
}: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExport({ format, filters });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            Export {type === 'correlations' ? 'Correlations' : 'Aircraft'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Format selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Format</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={cn(
                  'flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors',
                  format === 'csv'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <FileSpreadsheet className="h-5 w-5" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('json')}
                className={cn(
                  'flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors',
                  format === 'json'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <FileJson className="h-5 w-5" />
                <span>JSON</span>
              </button>
            </div>
          </div>

          {/* Filters based on type */}
          {type === 'correlations' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="flagged">Flagged</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Minimum Confidence
                </label>
                <select
                  value={filters.minConfidence || '0'}
                  onChange={(e) => setFilters({ ...filters, minConfidence: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="0">Any confidence</option>
                  <option value="0.5">50% or higher</option>
                  <option value="0.7">70% or higher</option>
                  <option value="0.9">90% or higher</option>
                </select>
              </div>
            </>
          )}

          {type === 'aircraft' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Aircraft Type</label>
                <select
                  value={filters.military || ''}
                  onChange={(e) => setFilters({ ...filters, military: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All aircraft</option>
                  <option value="true">Military only</option>
                  <option value="false">Civilian only</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.includePositions !== 'false'}
                    onChange={(e) => setFilters({
                      ...filters,
                      includePositions: e.target.checked ? 'true' : 'false'
                    })}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Include latest positions</span>
                </label>
              </div>
            </>
          )}

          {/* Limit */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Max Records
            </label>
            <select
              value={filters.limit || '1000'}
              onChange={(e) => setFilters({ ...filters, limit: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="100">100</option>
              <option value="500">500</option>
              <option value="1000">1,000</option>
              <option value="5000">5,000</option>
              <option value="10000">10,000</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              disabled={exporting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
