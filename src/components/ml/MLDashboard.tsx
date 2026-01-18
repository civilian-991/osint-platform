'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Brain,
  Zap,
  AlertTriangle,
  Target,
  Users,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  TrendingUp,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface MLStats {
  queue: {
    pending: number;
    processing: number;
    completed_24h: number;
    failed_24h: number;
    byType: Record<string, number>;
  };
  anomalies: {
    total_24h: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  };
  intents: {
    total: number;
    byIntent: Record<string, number>;
  };
  threats: {
    total: number;
    byLevel: Record<string, number>;
    avgScore: number;
  };
  formations: {
    active: number;
    total_24h: number;
    byType: Record<string, number>;
  };
  profiles: {
    total: number;
    trained: number;
  };
  cache: {
    total: number;
    hitRate24h: number;
  };
}

interface MLDashboardProps {
  className?: string;
  compact?: boolean;
}

export default function MLDashboard({ className, compact = false }: MLDashboardProps) {
  const [stats, setStats] = useState<MLStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ml/stats');
      const result = await response.json();

      if (result.success) {
        setStats(result.data);
      } else {
        setError(result.error || 'Failed to fetch ML stats');
      }
    } catch (err) {
      setError('Network error');
      console.error('Error fetching ML stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading && !stats) {
    return (
      <div className={cn('glass rounded-xl p-6', className)}>
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('glass rounded-xl p-6', className)}>
        <div className="flex items-center justify-center h-40 text-red-400">
          <AlertTriangle className="h-6 w-6 mr-2" />
          {error}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  if (compact) {
    return (
      <div className={cn('glass rounded-xl p-4', className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">ML Status</span>
          </div>
          <button
            onClick={fetchStats}
            className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <StatCard
            label="Queue"
            value={stats.queue.pending}
            icon={Clock}
            color="text-blue-400"
            size="sm"
          />
          <StatCard
            label="Anomalies"
            value={stats.anomalies.total_24h}
            icon={AlertTriangle}
            color="text-amber-400"
            size="sm"
          />
          <StatCard
            label="Formations"
            value={stats.formations.active}
            icon={Users}
            color="text-purple-400"
            size="sm"
          />
          <StatCard
            label="Threats"
            value={stats.threats.total}
            icon={Shield}
            color="text-red-400"
            size="sm"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('glass rounded-xl', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">ML Intelligence</h3>
            <p className="text-xs text-muted-foreground">Real-time processing stats</p>
          </div>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Main stats grid */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Queue Pending"
          value={stats.queue.pending}
          subValue={`${stats.queue.processing} processing`}
          icon={Clock}
          color="text-blue-400"
          bgColor="bg-blue-500/10"
        />
        <StatCard
          label="Completed (24h)"
          value={stats.queue.completed_24h}
          subValue={`${stats.queue.failed_24h} failed`}
          icon={CheckCircle}
          color="text-green-400"
          bgColor="bg-green-500/10"
        />
        <StatCard
          label="Anomalies (24h)"
          value={stats.anomalies.total_24h}
          subValue={`${stats.anomalies.bySeverity?.critical || 0} critical`}
          icon={AlertTriangle}
          color="text-amber-400"
          bgColor="bg-amber-500/10"
        />
        <StatCard
          label="Active Formations"
          value={stats.formations.active}
          subValue={`${stats.formations.total_24h} detected today`}
          icon={Users}
          color="text-purple-400"
          bgColor="bg-purple-500/10"
        />
      </div>

      {/* Secondary stats */}
      <div className="px-4 pb-4 grid grid-cols-3 gap-4">
        <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-medium text-foreground">Intent Classifications</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.intents.total}</div>
          {Object.keys(stats.intents.byIntent).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(stats.intents.byIntent).slice(0, 3).map(([intent, count]) => (
                <span key={intent} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {intent}: {count}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-red-400" />
            <span className="text-xs font-medium text-foreground">Threat Assessments</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.threats.total}</div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-muted-foreground">Avg Score:</span>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  stats.threats.avgScore >= 0.6 ? 'bg-red-500' :
                  stats.threats.avgScore >= 0.4 ? 'bg-amber-500' : 'bg-green-500'
                )}
                style={{ width: `${stats.threats.avgScore * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">
              {Math.round(stats.threats.avgScore * 100)}%
            </span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-indigo-400" />
            <span className="text-xs font-medium text-foreground">Behavioral Profiles</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.profiles.total}</div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-muted-foreground">Trained:</span>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{
                  width: stats.profiles.total > 0
                    ? `${(stats.profiles.trained / stats.profiles.total) * 100}%`
                    : '0%'
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">
              {stats.profiles.trained}
            </span>
          </div>
        </div>
      </div>

      {/* Processing queue breakdown */}
      {Object.keys(stats.queue.byType).length > 0 && (
        <div className="px-4 pb-4">
          <div className="p-3 rounded-lg bg-muted/10 border border-border/20">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-foreground">Queue by Task Type</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.queue.byType).map(([type, count]) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20"
                >
                  <span className="font-medium">{type.replace('_', ' ')}</span>
                  <span className="opacity-70">{count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cache stats footer */}
      <div className="px-4 py-3 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
        <span>Gemini Cache: {stats.cache.total} entries</span>
        <span>Last updated: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  subValue?: string;
  icon: typeof Brain;
  color: string;
  bgColor?: string;
  size?: 'sm' | 'md';
}

function StatCard({ label, value, subValue, icon: Icon, color, bgColor, size = 'md' }: StatCardProps) {
  if (size === 'sm') {
    return (
      <div className="text-center">
        <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
        <div className="text-lg font-bold text-foreground">{value}</div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
      </div>
    );
  }

  return (
    <div className={cn('p-3 rounded-lg border border-border/30', bgColor || 'bg-muted/20')}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', color)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value.toLocaleString()}</div>
      {subValue && (
        <div className="text-[10px] text-muted-foreground mt-1">{subValue}</div>
      )}
    </div>
  );
}
