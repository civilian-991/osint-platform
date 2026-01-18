'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type {
  GeofenceWithStats,
  CreateGeofenceRequest,
  UpdateGeofenceRequest,
} from '@/lib/types/geofence';
import { cn } from '@/lib/utils/cn';

interface GeofenceFormProps {
  geofence?: GeofenceWithStats;
  coordinates?: [number, number][];
  onSubmit: (data: CreateGeofenceRequest | UpdateGeofenceRequest) => Promise<void>;
  onCancel: () => void;
}

const PRESET_COLORS = [
  { fill: '#3b82f6', stroke: '#2563eb', name: 'Blue' },
  { fill: '#22c55e', stroke: '#16a34a', name: 'Green' },
  { fill: '#f59e0b', stroke: '#d97706', name: 'Orange' },
  { fill: '#ef4444', stroke: '#dc2626', name: 'Red' },
  { fill: '#8b5cf6', stroke: '#7c3aed', name: 'Purple' },
  { fill: '#ec4899', stroke: '#db2777', name: 'Pink' },
  { fill: '#06b6d4', stroke: '#0891b2', name: 'Cyan' },
  { fill: '#64748b', stroke: '#475569', name: 'Gray' },
];

const DWELL_PRESETS = [
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
];

export default function GeofenceForm({
  geofence,
  coordinates,
  onSubmit,
  onCancel,
}: GeofenceFormProps) {
  const [name, setName] = useState(geofence?.name || '');
  const [description, setDescription] = useState(geofence?.description || '');
  const [alertOnEntry, setAlertOnEntry] = useState(geofence?.alert_on_entry ?? true);
  const [alertOnExit, setAlertOnExit] = useState(geofence?.alert_on_exit ?? true);
  const [alertOnDwell, setAlertOnDwell] = useState(geofence?.alert_on_dwell ?? true);
  const [dwellThreshold, setDwellThreshold] = useState(geofence?.dwell_threshold_seconds ?? 300);
  const [fillColor, setFillColor] = useState(geofence?.fill_color || '#3b82f6');
  const [strokeColor, setStrokeColor] = useState(geofence?.stroke_color || '#2563eb');
  const [fillOpacity, setFillOpacity] = useState(geofence?.fill_opacity ?? 0.2);
  const [strokeWidth, setStrokeWidth] = useState(geofence?.stroke_width ?? 2);
  const [militaryOnly, setMilitaryOnly] = useState(geofence?.military_only ?? true);
  const [isActive, setIsActive] = useState(geofence?.is_active ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!geofence;

  const handleColorPreset = (preset: typeof PRESET_COLORS[0]) => {
    setFillColor(preset.fill);
    setStrokeColor(preset.stroke);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!isEditing && !coordinates && !geofence) {
      setError('Please draw a polygon on the map first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data: CreateGeofenceRequest | UpdateGeofenceRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        alert_on_entry: alertOnEntry,
        alert_on_exit: alertOnExit,
        alert_on_dwell: alertOnDwell,
        dwell_threshold_seconds: dwellThreshold,
        fill_color: fillColor,
        fill_opacity: fillOpacity,
        stroke_color: strokeColor,
        stroke_width: strokeWidth,
        military_only: militaryOnly,
        is_active: isActive,
      };

      // Only include coordinates for create or if explicitly provided for update
      if (coordinates) {
        (data as CreateGeofenceRequest).coordinates = coordinates;
      }

      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save geofence');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-medium text-lg">
        {isEditing ? 'Edit Geofence' : 'Create Geofence'}
      </h3>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-500 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Syria Border Zone"
          className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          autoFocus
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add notes about this geofence..."
          rows={2}
          className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      {/* Alert Options */}
      <div>
        <label className="block text-sm font-medium mb-2">Alert Triggers</label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={alertOnEntry}
              onChange={(e) => setAlertOnEntry(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm">Alert on entry</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={alertOnExit}
              onChange={(e) => setAlertOnExit(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm">Alert on exit</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={alertOnDwell}
              onChange={(e) => setAlertOnDwell(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm">Alert on dwell (loitering)</span>
          </label>
        </div>
      </div>

      {/* Dwell Threshold */}
      {alertOnDwell && (
        <div>
          <label className="block text-sm font-medium mb-2">Dwell Threshold</label>
          <div className="flex flex-wrap gap-2">
            {DWELL_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setDwellThreshold(preset.value)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-md border transition-colors',
                  dwellThreshold === preset.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border hover:border-primary'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color */}
      <div>
        <label className="block text-sm font-medium mb-2">Color</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleColorPreset(preset)}
              className={cn(
                'w-8 h-8 rounded-md border-2 transition-all',
                fillColor === preset.fill
                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                  : 'hover:scale-110'
              )}
              style={{ backgroundColor: preset.fill, borderColor: preset.stroke }}
              title={preset.name}
            />
          ))}
          {/* Custom color inputs */}
          <div className="flex items-center gap-2 ml-2">
            <input
              type="color"
              value={fillColor}
              onChange={(e) => setFillColor(e.target.value)}
              className="w-8 h-8 cursor-pointer rounded border border-border"
              title="Custom fill color"
            />
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => setStrokeColor(e.target.value)}
              className="w-8 h-8 cursor-pointer rounded border border-border"
              title="Custom stroke color"
            />
          </div>
        </div>

        {/* Opacity slider */}
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Fill Opacity</span>
            <span>{Math.round(fillOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={fillOpacity}
            onChange={(e) => setFillOpacity(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* Filters */}
      <div>
        <label className="block text-sm font-medium mb-2">Filters</label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={militaryOnly}
            onChange={(e) => setMilitaryOnly(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-sm">Military aircraft only</span>
        </label>
      </div>

      {/* Active Status */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-sm">Geofence active</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Geofence'}
        </button>
      </div>
    </form>
  );
}
