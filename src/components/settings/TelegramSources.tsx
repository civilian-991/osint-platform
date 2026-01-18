'use client';

import { useEffect, useState } from 'react';
import { Radio, ExternalLink, RefreshCw } from 'lucide-react';

interface TelegramChannel {
  id: string;
  channel_username: string;
  display_name: string;
  description: string;
  category: string;
  language: string;
  is_active: boolean;
  last_fetched_at: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  alerts: '#ef4444',
  military: '#f97316',
  aviation: '#3b82f6',
  osint: '#8b5cf6',
  news: '#10b981',
  other: '#6b7280',
};

const CATEGORY_LABELS: Record<string, string> = {
  alerts: 'Real-time Alerts',
  military: 'Military',
  aviation: 'Aviation',
  osint: 'OSINT',
  news: 'News',
  other: 'Other',
};

export function TelegramSources() {
  const [channels, setChannels] = useState<TelegramChannel[]>([]);
  const [grouped, setGrouped] = useState<Record<string, TelegramChannel[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/telegram/channels');
      const data = await response.json();
      if (data.success) {
        setChannels(data.channels);
        setGrouped(data.grouped);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load channels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Radio className="h-4 w-4 text-green-400" />
            <div className="absolute inset-0 animate-ping">
              <Radio className="h-4 w-4 text-green-400 opacity-30" />
            </div>
          </div>
          <span className="text-sm">
            <span className="font-semibold text-primary">{channels.length}</span>
            <span className="text-muted-foreground"> active sources</span>
          </span>
        </div>
        <button
          onClick={fetchChannels}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {/* Categories */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([category, categoryChannels]) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[category] || CATEGORY_COLORS.other }}
              />
              <span className="text-sm font-medium">
                {CATEGORY_LABELS[category] || category}
              </span>
              <span className="text-xs text-muted-foreground">
                ({categoryChannels.length})
              </span>
            </div>
            <div className="grid gap-2">
              {categoryChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-primary">
                        @{channel.channel_username}
                      </span>
                      {channel.language && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                          {channel.language}
                        </span>
                      )}
                    </div>
                    {channel.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {channel.description}
                      </p>
                    )}
                  </div>
                  <a
                    href={`https://t.me/${channel.channel_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="pt-4 border-t border-border">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[key] }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
