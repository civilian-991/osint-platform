'use client';

import { useState } from 'react';
import type {
  CreateWatchlistItemInput,
  WatchlistMatchType,
  WatchlistPriority,
} from '@/lib/types/watchlist';
import { MATCH_TYPE_LABELS, PRIORITY_LABELS } from '@/lib/types/watchlist';

interface WatchlistItemFormProps {
  watchlistId: string;
  onSubmit: (input: CreateWatchlistItemInput) => Promise<void>;
  onCancel: () => void;
  initialValues?: Partial<CreateWatchlistItemInput>;
}

export default function WatchlistItemForm({
  watchlistId,
  onSubmit,
  onCancel,
  initialValues,
}: WatchlistItemFormProps) {
  const [matchType, setMatchType] = useState<WatchlistMatchType>(
    initialValues?.match_type || 'icao_hex'
  );
  const [matchValue, setMatchValue] = useState(initialValues?.match_value || '');
  const [priority, setPriority] = useState<WatchlistPriority>(
    initialValues?.priority || 'medium'
  );
  const [notes, setNotes] = useState(initialValues?.notes || '');
  const [alertOnDetection, setAlertOnDetection] = useState(
    initialValues?.alert_on_detection !== false
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!matchValue.trim()) {
      setError('Value is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await onSubmit({
        match_type: matchType,
        match_value: matchValue.trim(),
        priority,
        notes: notes.trim() || undefined,
        alert_on_detection: alertOnDetection,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
      setSubmitting(false);
    }
  };

  const getPlaceholder = (): string => {
    switch (matchType) {
      case 'icao_hex':
        return 'e.g., AE1234';
      case 'registration':
        return 'e.g., N12345';
      case 'callsign_pattern':
        return 'e.g., RCH% (use % as wildcard)';
      case 'type_code':
        return 'e.g., KC135';
      default:
        return 'Enter value';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="font-medium text-sm">Add Item to Watchlist</h4>

      {/* Match Type */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Match Type</label>
        <select
          value={matchType}
          onChange={(e) => setMatchType(e.target.value as WatchlistMatchType)}
          className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {(Object.keys(MATCH_TYPE_LABELS) as WatchlistMatchType[]).map((type) => (
            <option key={type} value={type}>
              {MATCH_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {/* Match Value */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Value</label>
        <input
          type="text"
          value={matchValue}
          onChange={(e) => setMatchValue(e.target.value.toUpperCase())}
          placeholder={getPlaceholder()}
          className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {matchType === 'callsign_pattern' && (
          <p className="text-xs text-muted-foreground">
            Use % as a wildcard. e.g., RCH% matches RCH001, RCH999, etc.
          </p>
        )}
      </div>

      {/* Priority */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Priority</label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as WatchlistPriority)}
          className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {(Object.keys(PRIORITY_LABELS) as WatchlistPriority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes about this item"
          rows={2}
          className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      {/* Alert Toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={alertOnDetection}
          onChange={(e) => setAlertOnDetection(e.target.checked)}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
        <span className="text-sm">Alert when detected</span>
      </label>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Adding...' : 'Add Item'}
        </button>
      </div>
    </form>
  );
}
