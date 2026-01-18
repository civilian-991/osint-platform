'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  Info,
  X,
  Check,
  Eye,
  ChevronRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatDistanceToNow } from 'date-fns';
import { ThreatLevelBadge, getThreatLevelFromScore } from '@/components/ml';

interface SmartAlert {
  id: string;
  alert_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  data: Record<string, unknown>;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
  priority_score: number;
  relevance_score: number;
  final_score?: number;
}

interface AlertsSummary {
  total: number;
  unread: number;
  critical: number;
  high: number;
}

interface SmartAlertsPanelProps {
  maxAlerts?: number;
  onAlertClick?: (alert: SmartAlert) => void;
  className?: string;
}

const severityConfig: Record<string, {
  icon: typeof AlertCircle;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  critical: {
    icon: AlertOctagon,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  high: {
    icon: AlertTriangle,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  medium: {
    icon: AlertCircle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  low: {
    icon: Info,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  info: {
    icon: Info,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/30',
  },
};

export default function SmartAlertsPanel({
  maxAlerts = 10,
  onAlertClick,
  className,
}: SmartAlertsPanelProps) {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [summary, setSummary] = useState<AlertsSummary>({ total: 0, unread: 0, critical: 0, high: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/alerts/smart?limit=${maxAlerts}`);
      const result = await response.json();

      if (result.success) {
        setAlerts(result.data);
        setSummary(result.summary);
      } else {
        setError(result.error || 'Failed to fetch alerts');
      }
    } catch (err) {
      setError('Network error');
      console.error('Error fetching smart alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [maxAlerts]);

  const recordInteraction = useCallback(async (alertId: string, interactionType: string) => {
    try {
      await fetch('/api/alerts/smart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, interactionType }),
      });
    } catch (err) {
      console.error('Error recording interaction:', err);
    }
  }, []);

  const handleAlertClick = useCallback((alert: SmartAlert) => {
    recordInteraction(alert.id, 'clicked');
    if (!alert.is_read) {
      recordInteraction(alert.id, 'read');
      setAlerts(prev => prev.map(a =>
        a.id === alert.id ? { ...a, is_read: true } : a
      ));
      setSummary(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
    }
    onAlertClick?.(alert);
  }, [recordInteraction, onAlertClick]);

  const handleDismiss = useCallback((e: React.MouseEvent, alertId: string) => {
    e.stopPropagation();
    recordInteraction(alertId, 'dismissed');
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    setSummary(prev => ({ ...prev, total: prev.total - 1, unread: Math.max(0, prev.unread - 1) }));
  }, [recordInteraction]);

  const handleMarkRead = useCallback((e: React.MouseEvent, alertId: string) => {
    e.stopPropagation();
    recordInteraction(alertId, 'read');
    setAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, is_read: true } : a
    ));
    setSummary(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
  }, [recordInteraction]);

  useEffect(() => {
    fetchAlerts();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  return (
    <div className={cn('glass rounded-xl', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Sparkles className="h-5 w-5 text-primary" />
            {summary.unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                {summary.unread > 9 ? '9+' : summary.unread}
              </span>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Smart Alerts</h3>
            <p className="text-xs text-muted-foreground">
              Prioritized by relevance
            </p>
          </div>
        </div>

        <button
          onClick={fetchAlerts}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Summary badges */}
      {(summary.critical > 0 || summary.high > 0) && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-muted/20">
          {summary.critical > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
              <AlertOctagon className="h-3 w-3" />
              {summary.critical} Critical
            </span>
          )}
          {summary.high > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <AlertTriangle className="h-3 w-3" />
              {summary.high} High
            </span>
          )}
        </div>
      )}

      {/* Alert list */}
      <div className="divide-y divide-border/30 max-h-[400px] overflow-y-auto">
        {loading && alerts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin" />
            Loading alerts...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400">
            <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
            {error}
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="h-6 w-6 mx-auto mb-2 opacity-50" />
            No alerts at this time
          </div>
        ) : (
          alerts.map((alert) => {
            const config = severityConfig[alert.severity] || severityConfig.info;
            const Icon = config.icon;
            const timeAgo = formatDistanceToNow(new Date(alert.created_at), { addSuffix: true });

            return (
              <div
                key={alert.id}
                onClick={() => handleAlertClick(alert)}
                className={cn(
                  'group relative p-4 cursor-pointer transition-all duration-200',
                  alert.is_read
                    ? 'bg-transparent hover:bg-muted/30'
                    : 'bg-primary/5 hover:bg-primary/10',
                  alert.severity === 'critical' && !alert.is_read && 'animate-pulse'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={cn(
                      'p-2 rounded-lg border shrink-0',
                      config.bgColor,
                      config.borderColor
                    )}
                  >
                    <Icon className={cn('h-4 w-4', config.color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={cn(
                        'font-medium text-sm truncate',
                        alert.is_read ? 'text-foreground/80' : 'text-foreground'
                      )}>
                        {alert.title}
                      </h4>
                      {!alert.is_read && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {alert.description}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
                      <span>{timeAgo}</span>
                      {alert.final_score && (
                        <>
                          <span>•</span>
                          <span>Relevance: {Math.round(alert.final_score * 100)}%</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!alert.is_read && (
                      <button
                        onClick={(e) => handleMarkRead(e, alert.id)}
                        className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                        title="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDismiss(e, alert.id)}
                      className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                      title="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                </div>

                {/* Threat indicator for aircraft alerts */}
                {typeof alert.data?.threat_score === 'number' && (
                  <div className="mt-2 pt-2 border-t border-border/20">
                    <ThreatLevelBadge
                      level={getThreatLevelFromScore(alert.data.threat_score)}
                      score={alert.data.threat_score}
                      showScore
                      size="sm"
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {alerts.length > 0 && (
        <div className="p-3 border-t border-border/50 text-center">
          <a
            href="/alerts"
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            View all {summary.total} alerts →
          </a>
        </div>
      )}
    </div>
  );
}
