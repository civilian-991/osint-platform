'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, X, Filter, RefreshCw, Loader2 } from 'lucide-react';
import type { Alert, AlertSeverity, AlertType } from '@/lib/types/correlation';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils/cn';

const SEVERITY_CONFIG: Record<AlertSeverity, { color: string; bgColor: string; label: string }> = {
  critical: { color: 'text-red-600', bgColor: 'bg-red-500/10', label: 'Critical' },
  high: { color: 'text-orange-500', bgColor: 'bg-orange-500/10', label: 'High' },
  medium: { color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', label: 'Medium' },
  low: { color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'Low' },
};

const TYPE_LABELS: Record<AlertType, string> = {
  new_correlation: 'New Correlation',
  high_confidence_match: 'High Confidence Match',
  unusual_pattern: 'Unusual Pattern',
  watchlist_aircraft: 'Watchlist Aircraft',
  breaking_news: 'Breaking News',
  region_activity: 'Region Activity',
  geofence_entry: 'Geofence Entry',
  geofence_exit: 'Geofence Exit',
  geofence_dwell: 'Geofence Dwell',
  aircraft_first_appearance: 'New Aircraft',
  aircraft_departure: 'Aircraft Departure',
  aircraft_landing: 'Aircraft Landing',
  aircraft_disappeared: 'Signal Lost',
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/alerts');
      if (!response.ok) {
        throw new Error(`Failed to fetch alerts: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        setAlerts(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const filteredAlerts = filter === 'unread'
    ? alerts.filter((a) => !a.is_read)
    : alerts;

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  const markAsRead = async (id: string) => {
    try {
      await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_read: true }),
      });
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_read: true } : a))
      );
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  const dismissAlert = async (id: string) => {
    try {
      await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_dismissed: true }),
      });
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_dismissed: true } : a))
      );
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all_read: true }),
      });
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Alerts
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-destructive text-destructive-foreground rounded-full text-sm">
                {unreadCount}
              </span>
            )}
          </h1>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors"
              >
                <Check className="h-4 w-4" />
                Mark all as read
              </button>
            )}
            <button
              onClick={fetchAlerts}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-3 py-1 rounded text-sm transition-colors',
              filter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={cn(
              'px-3 py-1 rounded text-sm transition-colors',
              filter === 'unread'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Bell className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg mb-2">No alerts</p>
            <p className="text-sm">
              {filter === 'unread'
                ? 'You\'ve read all your alerts!'
                : 'Alerts will appear here when correlations are detected.'}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredAlerts
              .filter((a) => !a.is_dismissed)
              .map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onMarkAsRead={() => markAsRead(alert.id)}
                  onDismiss={() => dismissAlert(alert.id)}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AlertCard({
  alert,
  onMarkAsRead,
  onDismiss,
}: {
  alert: Alert;
  onMarkAsRead: () => void;
  onDismiss: () => void;
}) {
  const severity = SEVERITY_CONFIG[alert.severity];
  const timeAgo = formatDistanceToNow(new Date(alert.created_at), { addSuffix: true });

  return (
    <div
      className={cn(
        'flex items-start gap-4 p-4 rounded-lg border transition-colors',
        alert.is_read
          ? 'bg-card border-border'
          : 'bg-primary/5 border-primary/20'
      )}
    >
      {/* Severity indicator */}
      <div className={cn('p-2 rounded-lg', severity.bgColor)}>
        <Bell className={cn('h-5 w-5', severity.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded', severity.bgColor, severity.color)}>
            {severity.label}
          </span>
          <span className="text-xs text-muted-foreground">
            {TYPE_LABELS[alert.alert_type]}
          </span>
        </div>

        <h3 className={cn('font-semibold mb-1', !alert.is_read && 'text-primary')}>
          {alert.title}
        </h3>

        {alert.description && (
          <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
        )}

        <div className="text-xs text-muted-foreground">{timeAgo}</div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {!alert.is_read && (
          <button
            onClick={onMarkAsRead}
            className="p-1.5 hover:bg-muted rounded transition-colors"
            title="Mark as read"
          >
            <Check className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <button
          onClick={onDismiss}
          className="p-1.5 hover:bg-muted rounded transition-colors"
          title="Dismiss"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
