'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  Plane,
  Radio,
  Newspaper,
  MapPin,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Shield,
  Target,
  Zap,
  Crosshair,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatDistanceToNow } from 'date-fns';

interface IntelAlert {
  id: string;
  alert_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  data: {
    aircraft?: Array<{
      callsign: string;
      type: string;
      operator?: string;
    }>;
    formation?: {
      type: string;
      aircraft_count: number;
    };
    news?: Array<{
      title: string;
      source: string;
    }>;
    region?: string;
    activity_count?: number;
    anomalies?: string[];
  };
  created_at: string;
}

interface IntelSummary {
  threat_level: 'low' | 'elevated' | 'high' | 'critical';
  active_alerts: number;
  aircraft_tracked: number;
  formations_active: number;
  regions_active: string[];
  summary: string;
}

interface FeedItem {
  id: string;
  type: 'strike' | 'telegram' | 'alert' | 'news';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  source?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const threatColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  low: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', glow: 'shadow-green-500/20' },
  medium: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', glow: 'shadow-yellow-500/20' },
  elevated: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', glow: 'shadow-yellow-500/20' },
  high: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', glow: 'shadow-orange-500/20' },
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', glow: 'shadow-red-500/20' },
};

const alertTypeIcons: Record<string, typeof AlertTriangle> = {
  flash_alert: AlertOctagon,
  formation_alert: Target,
  activity_spike: Zap,
  news_correlation: Newspaper,
  regional_alert: MapPin,
};

const feedTypeIcons: Record<string, typeof AlertTriangle> = {
  strike: Crosshair,
  telegram: MessageSquare,
  alert: AlertOctagon,
  news: Newspaper,
};

const feedTypeLabels: Record<string, string> = {
  strike: 'STRIKE',
  telegram: 'INTEL',
  alert: 'ALERT',
  news: 'NEWS',
};

export default function IntelAlertPanel({ className }: { className?: string }) {
  const [alerts, setAlerts] = useState<IntelAlert[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [summary, setSummary] = useState<IntelSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'strikes' | 'telegram'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch unified intel feed
      const feedRes = await fetch('/api/intel/feed?limit=30');
      const feedData = await feedRes.json();
      if (feedData.success) {
        setFeedItems(feedData.data);
      }

      // Fetch alerts (fallback)
      const alertsRes = await fetch('/api/alerts/smart?limit=10');
      const alertsData = await alertsRes.json();
      if (alertsData.success) {
        const intelAlerts = alertsData.data.filter((a: IntelAlert) =>
          ['flash_alert', 'formation_alert', 'activity_spike', 'regional_alert', 'news_correlation'].includes(a.alert_type)
        );
        setAlerts(intelAlerts);
      }

      // Fetch summary
      const summaryRes = await fetch('/api/intel/summary');
      const summaryData = await summaryRes.json();
      if (summaryData.success) {
        setSummary(summaryData.data);
      }
    } catch (err) {
      console.error('Error fetching intel data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchData]);

  const threatStyle = summary ? threatColors[summary.threat_level] : threatColors.low;

  return (
    <div className={cn('glass rounded-xl overflow-hidden', className)}>
      {/* Threat Level Header */}
      <div
        className={cn(
          'p-4 border-b transition-all duration-500',
          threatStyle.bg,
          threatStyle.border,
          summary?.threat_level === 'critical' && 'animate-pulse'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', threatStyle.bg, threatStyle.border, 'border')}>
              <Shield className={cn('h-5 w-5', threatStyle.text)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={cn('font-bold text-lg uppercase tracking-wide', threatStyle.text)}>
                  {summary?.threat_level || 'Low'} Threat
                </h3>
                {summary?.threat_level === 'critical' && (
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Intelligence Assessment
              </p>
            </div>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Quick Stats */}
        {summary && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="text-center p-2 rounded-lg bg-background/30">
              <div className="flex items-center justify-center gap-1 text-foreground font-bold">
                <Plane className="h-3 w-3" />
                {summary.aircraft_tracked}
              </div>
              <div className="text-[10px] text-muted-foreground">Aircraft</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/30">
              <div className="flex items-center justify-center gap-1 text-foreground font-bold">
                <Target className="h-3 w-3" />
                {summary.formations_active}
              </div>
              <div className="text-[10px] text-muted-foreground">Formations</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/30">
              <div className="flex items-center justify-center gap-1 text-foreground font-bold">
                <Radio className="h-3 w-3" />
                {summary.regions_active.length}
              </div>
              <div className="text-[10px] text-muted-foreground">Regions</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/30">
        {[
          { key: 'all', label: 'All' },
          { key: 'strikes', label: 'Strikes' },
          { key: 'telegram', label: 'Telegram' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={cn(
              'flex-1 px-3 py-2 text-xs font-medium transition-colors',
              activeTab === tab.key
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {tab.key === 'strikes' && feedItems.filter(f => f.type === 'strike').length > 0 && (
              <span className="ml-1 px-1 rounded bg-red-500/20 text-red-400 text-[10px]">
                {feedItems.filter(f => f.type === 'strike').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Feed List */}
      <div className="divide-y divide-border/30 max-h-[500px] overflow-y-auto">
        {(() => {
          const filteredItems = feedItems.filter(item => {
            if (activeTab === 'all') return true;
            if (activeTab === 'strikes') return item.type === 'strike';
            if (activeTab === 'telegram') return item.type === 'telegram';
            return true;
          });

          if (filteredItems.length === 0 && alerts.length === 0) {
            return (
              <div className="p-8 text-center text-muted-foreground">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No active intelligence</p>
                <p className="text-xs mt-1">Monitoring all regions</p>
              </div>
            );
          }

          // Show feed items
          if (filteredItems.length > 0) {
            return filteredItems.map((item) => {
              const Icon = feedTypeIcons[item.type] || AlertTriangle;
              const isExpanded = expandedAlert === item.id;
              const severityStyle = threatColors[item.severity];
              const isStrike = item.type === 'strike';
              const isTelegram = item.type === 'telegram';

              return (
                <div
                  key={item.id}
                  className={cn(
                    'transition-all duration-200',
                    isStrike && 'bg-red-500/5 border-l-4 border-l-red-500',
                    isTelegram && 'border-l-4 border-l-blue-500/50'
                  )}
                >
                  <div
                    onClick={() => setExpandedAlert(isExpanded ? null : item.id)}
                    className="p-3 cursor-pointer hover:bg-muted/30"
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('p-1.5 rounded-lg shrink-0', severityStyle.bg, severityStyle.border, 'border')}>
                        <Icon className={cn('h-3.5 w-3.5', severityStyle.text)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                            isStrike ? 'bg-red-500/20 text-red-400' :
                            isTelegram ? 'bg-blue-500/20 text-blue-400' :
                            'bg-muted text-muted-foreground'
                          )}>
                            {feedTypeLabels[item.type]}
                          </span>
                          {item.severity === 'critical' && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                          )}
                        </div>
                        <h4 className={cn(
                          'font-medium text-sm leading-tight',
                          isStrike ? 'text-red-400' : 'text-foreground'
                        )}>
                          {item.title}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {item.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground/70">
                          <span>{formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}</span>
                          {item.source && (
                            <>
                              <span>•</span>
                              <span>{item.source}</span>
                            </>
                          )}
                          {item.region && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" />
                                {item.region}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <button className="p-1 text-muted-foreground">
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 animate-slide-up">
                      <div className="rounded-lg bg-muted/30 p-3 text-xs">
                        <p className="text-foreground/90 whitespace-pre-wrap">{item.description}</p>
                        {item.latitude && item.longitude && (
                          <a
                            href={`https://maps.google.com/?q=${item.latitude},${item.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 text-primary hover:underline"
                          >
                            <MapPin className="h-3 w-3" />
                            View on Map
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                        {isTelegram && item.source && (
                          <a
                            href={`https://t.me/${item.source.replace('@', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 text-blue-400 hover:underline"
                          >
                            <MessageSquare className="h-3 w-3" />
                            Open in Telegram
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            });
          }

          // Fallback to old alerts
          return alerts.map((alert) => {
            const Icon = alertTypeIcons[alert.alert_type] || AlertTriangle;
            const isExpanded = expandedAlert === alert.id;
            const isRedAlert = alert.alert_type === 'flash_alert';
            const severityStyle = threatColors[alert.severity];

            return (
              <div
                key={alert.id}
                className={cn(
                  'transition-all duration-200',
                  isRedAlert && 'bg-red-500/5 border-l-4 border-l-red-500',
                  alert.severity === 'high' && !isRedAlert && 'border-l-4 border-l-orange-500/50'
                )}
              >
                <div
                  onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                  className="p-4 cursor-pointer hover:bg-muted/30"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('p-2 rounded-lg shrink-0', severityStyle.bg, severityStyle.border, 'border')}>
                      <Icon className={cn('h-4 w-4', severityStyle.text)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={cn(
                          'font-semibold text-sm',
                          isRedAlert ? 'text-red-400' : 'text-foreground'
                        )}>
                          {alert.title}
                        </h4>
                        {isRedAlert && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                            FLASH
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {alert.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground/70">
                        <span>{formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}</span>
                        {alert.data.region && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5" />
                              {alert.data.region}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <button className="p-1 text-muted-foreground">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 space-y-3 animate-slide-up">
                    {/* Aircraft List */}
                    {alert.data.aircraft && alert.data.aircraft.length > 0 && (
                      <div className="rounded-lg bg-muted/30 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-foreground mb-2">
                          <Plane className="h-3 w-3" />
                          Aircraft Detected ({alert.data.aircraft.length})
                        </div>
                        <div className="space-y-1">
                          {alert.data.aircraft.slice(0, 5).map((ac, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="font-mono text-primary">{ac.callsign}</span>
                              <span className="text-muted-foreground">{ac.type}</span>
                            </div>
                          ))}
                          {alert.data.aircraft.length > 5 && (
                            <div className="text-[10px] text-muted-foreground text-center pt-1">
                              +{alert.data.aircraft.length - 5} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Related News */}
                    {alert.data.news && alert.data.news.length > 0 && (
                      <div className="rounded-lg bg-muted/30 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-foreground mb-2">
                          <Newspaper className="h-3 w-3" />
                          Related Intelligence
                        </div>
                        <div className="space-y-2">
                          {alert.data.news.map((news, i) => (
                            <div key={i} className="text-xs">
                              <p className="text-foreground/90 line-clamp-2">{news.title}</p>
                              <p className="text-muted-foreground/70 text-[10px] mt-0.5">{news.source}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Formation Details */}
                    {alert.data.formation && (
                      <div className="rounded-lg bg-muted/30 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-foreground mb-2">
                          <Target className="h-3 w-3" />
                          Formation Details
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Type:</span>
                            <span className="ml-1 text-foreground capitalize">
                              {alert.data.formation.type.replace('_', ' ')}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Aircraft:</span>
                            <span className="ml-1 text-foreground">{alert.data.formation.aircraft_count}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
