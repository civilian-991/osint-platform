'use client';

import { useState } from 'react';
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Bell,
  BellOff,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Plane,
  Clock,
} from 'lucide-react';
import { useGeofences } from '@/hooks/useGeofences';
import type { GeofenceWithStats, GeofenceAlertWithGeofence, CreateGeofenceRequest } from '@/lib/types/geofence';
import { getAlertTypeLabel, formatDwellTime, getAlertSeverityColor } from '@/lib/types/geofence';
import GeofenceForm from './GeofenceForm';
import { cn } from '@/lib/utils/cn';
import { formatDistanceToNow } from 'date-fns';

interface GeofenceManagerProps {
  onSelectGeofence?: (geofence: GeofenceWithStats) => void;
  onEditGeofence?: (geofence: GeofenceWithStats) => void;
  onStartDrawing?: () => void;
  selectedGeofenceId?: string;
}

export default function GeofenceManager({
  onSelectGeofence,
  onEditGeofence,
  onStartDrawing,
  selectedGeofenceId,
}: GeofenceManagerProps) {
  const {
    geofences,
    alerts,
    unreadAlertCount,
    loading,
    error,
    createGeofence,
    updateGeofence,
    deleteGeofence,
    markAlertRead,
    markAllAlertsRead,
    dismissAlert,
  } = useGeofences();

  const [expandedGeofences, setExpandedGeofences] = useState<Set<string>>(new Set());
  const [showAlerts, setShowAlerts] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<GeofenceWithStats | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedGeofences((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleActive = async (geofence: GeofenceWithStats) => {
    try {
      await updateGeofence(geofence.id, { is_active: !geofence.is_active });
    } catch (err) {
      console.error('Failed to toggle geofence:', err);
    }
  };

  const handleDeleteGeofence = async (id: string) => {
    if (!confirm('Are you sure you want to delete this geofence? This cannot be undone.')) {
      return;
    }

    try {
      await deleteGeofence(id);
    } catch (err) {
      console.error('Failed to delete geofence:', err);
    }
  };

  const handleAlertClick = async (alert: GeofenceAlertWithGeofence) => {
    if (!alert.is_read) {
      await markAlertRead(alert.id);
    }
    // Find and select the geofence
    const geofence = geofences.find(g => g.id === alert.geofence_id);
    if (geofence) {
      onSelectGeofence?.(geofence);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-muted rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <span>Error loading geofences: {error.message}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Geofences</h2>
        <div className="flex items-center gap-2">
          {/* Alerts Toggle */}
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              showAlerts
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            <Bell className="h-4 w-4" />
            Alerts
            {unreadAlertCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center bg-red-500 text-white text-xs rounded-full">
                {unreadAlertCount}
              </span>
            )}
          </button>
          {/* New Geofence Button */}
          <button
            onClick={onStartDrawing || (() => setShowCreateForm(true))}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Geofence
          </button>
        </div>
      </div>

      {/* Alerts Panel */}
      {showAlerts && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50">
            <h3 className="font-medium text-sm">Recent Alerts</h3>
            {unreadAlertCount > 0 && (
              <button
                onClick={() => markAllAlertsRead()}
                className="text-xs text-primary hover:text-primary/80"
              >
                Mark all read
              </button>
            )}
          </div>
          {alerts.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No alerts yet
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-border">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => handleAlertClick(alert)}
                  className={cn(
                    'flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors',
                    !alert.is_read && 'bg-primary/5'
                  )}
                >
                  <div className={cn(
                    'mt-0.5 p-1.5 rounded-full',
                    alert.alert_type === 'entry' && 'bg-green-500/20 text-green-500',
                    alert.alert_type === 'exit' && 'bg-blue-500/20 text-blue-500',
                    alert.alert_type === 'dwell' && 'bg-orange-500/20 text-orange-500'
                  )}>
                    {alert.alert_type === 'dwell' ? (
                      <Clock className="h-3.5 w-3.5" />
                    ) : (
                      <Plane className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {alert.callsign || alert.icao_hex}
                      </span>
                      <span className={cn('text-xs', getAlertSeverityColor(alert.severity))}>
                        {getAlertTypeLabel(alert.alert_type)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {alert.geofence?.name || 'Unknown geofence'}
                      {alert.dwell_seconds && ` - ${formatDwellTime(alert.dwell_seconds)}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!alert.is_read && (
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-card border border-border rounded-lg p-4">
          <GeofenceForm
            onSubmit={async (data) => {
              await createGeofence(data as CreateGeofenceRequest);
              setShowCreateForm(false);
            }}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {/* Edit Form */}
      {editingGeofence && (
        <div className="bg-card border border-border rounded-lg p-4">
          <GeofenceForm
            geofence={editingGeofence}
            onSubmit={async (data) => {
              await updateGeofence(editingGeofence.id, data);
              setEditingGeofence(null);
            }}
            onCancel={() => setEditingGeofence(null)}
          />
        </div>
      )}

      {/* Geofences List */}
      {geofences.length === 0 && !showCreateForm ? (
        <div className="text-center py-8 text-muted-foreground">
          <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No geofences yet</p>
          <p className="text-sm mt-1">Create one to start monitoring aircraft in areas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {geofences.map((geofence) => (
            <div
              key={geofence.id}
              className={cn(
                'bg-card border rounded-lg overflow-hidden transition-all',
                selectedGeofenceId === geofence.id && 'ring-2 ring-primary',
                geofence.is_active ? 'border-border' : 'border-border/50 opacity-60'
              )}
            >
              {/* Geofence Header */}
              <div
                onClick={() => {
                  toggleExpanded(geofence.id);
                  onSelectGeofence?.(geofence);
                }}
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                {expandedGeofences.has(geofence.id) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}

                {/* Color indicator */}
                <div
                  className="w-3 h-3 rounded-full border-2"
                  style={{
                    backgroundColor: geofence.fill_color,
                    borderColor: geofence.stroke_color,
                  }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{geofence.name}</h3>
                    {geofence.aircraft_inside > 0 && (
                      <span className="flex items-center gap-1 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                        <Plane className="h-3 w-3" />
                        {geofence.aircraft_inside}
                      </span>
                    )}
                    {geofence.alerts_24h > 0 && (
                      <span className="flex items-center gap-1 text-xs bg-orange-500/20 text-orange-500 px-2 py-0.5 rounded-full">
                        <Bell className="h-3 w-3" />
                        {geofence.alerts_24h}
                      </span>
                    )}
                  </div>
                  {geofence.description && (
                    <p className="text-sm text-muted-foreground truncate">
                      {geofence.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingGeofence(geofence);
                      onEditGeofence?.(geofence);
                    }}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit geofence"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleActive(geofence);
                    }}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    title={geofence.is_active ? 'Disable geofence' : 'Enable geofence'}
                  >
                    {geofence.is_active ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteGeofence(geofence.id);
                    }}
                    className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                    title="Delete geofence"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedGeofences.has(geofence.id) && (
                <div className="border-t border-border bg-muted/30 p-4 space-y-3">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Area:</span>{' '}
                      <span className="font-medium">
                        {geofence.area_km2?.toFixed(1) || '?'} km²
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Dwell threshold:</span>{' '}
                      <span className="font-medium">
                        {formatDwellTime(geofence.dwell_threshold_seconds)}
                      </span>
                    </div>
                  </div>

                  {/* Alert Config */}
                  <div className="flex flex-wrap gap-2">
                    <span className={cn(
                      'text-xs px-2 py-1 rounded-full',
                      geofence.alert_on_entry
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {geofence.alert_on_entry ? 'Entry alerts on' : 'Entry alerts off'}
                    </span>
                    <span className={cn(
                      'text-xs px-2 py-1 rounded-full',
                      geofence.alert_on_exit
                        ? 'bg-blue-500/20 text-blue-500'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {geofence.alert_on_exit ? 'Exit alerts on' : 'Exit alerts off'}
                    </span>
                    <span className={cn(
                      'text-xs px-2 py-1 rounded-full',
                      geofence.alert_on_dwell
                        ? 'bg-orange-500/20 text-orange-500'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {geofence.alert_on_dwell ? 'Dwell alerts on' : 'Dwell alerts off'}
                    </span>
                    {geofence.military_only && (
                      <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-500">
                        Military only
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                    Created {formatDistanceToNow(new Date(geofence.created_at), { addSuffix: true })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
