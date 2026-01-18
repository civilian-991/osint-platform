'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Send,
  Eye,
  RefreshCw,
  Search,
  Plus,
  ExternalLink,
  Image as ImageIcon,
  Video,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatDistanceToNow } from 'date-fns';

interface TelegramMessage {
  channel_username: string;
  channel_name: string;
  category: string;
  message_id: number;
  content: string;
  media_type: string;
  views: number;
  posted_at: string;
  relevance_score: number | null;
}

interface TelegramStats {
  total_channels: number;
  active_channels: number;
  total_messages: number;
  messages_24h: number;
}

const categoryColors: Record<string, { bg: string; text: string }> = {
  aviation: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  military: { bg: 'bg-red-500/20', text: 'text-red-400' },
  news: { bg: 'bg-green-500/20', text: 'text-green-400' },
  osint: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  general: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
};

const mediaIcons: Record<string, typeof ImageIcon> = {
  photo: ImageIcon,
  video: Video,
  document: FileText,
  text: FileText,
};

export default function TelegramFeed({ className }: { className?: string }) {
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [stats, setStats] = useState<TelegramStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannel, setNewChannel] = useState({ username: '', displayName: '', category: 'general' });

  const fetchMessages = useCallback(async (search?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '30' });
      if (search) params.set('search', search);

      const response = await fetch(`/api/intel/telegram?${params}`);
      const data = await response.json();

      if (data.success) {
        setMessages(data.data);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(() => {
    fetchMessages(searchQuery || undefined);
  }, [fetchMessages, searchQuery]);

  const handleAddChannel = async () => {
    if (!newChannel.username) return;

    try {
      const response = await fetch('/api/intel/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChannel),
      });

      const data = await response.json();

      if (data.success) {
        setShowAddChannel(false);
        setNewChannel({ username: '', displayName: '', category: 'general' });
        fetchMessages();
      } else {
        alert(data.error || 'Failed to add channel');
      }
    } catch (error) {
      console.error('Error adding channel:', error);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(() => fetchMessages(), 60000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const formatViews = (views: number): string => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  return (
    <div className={cn('glass rounded-xl overflow-hidden', className)}>
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-[#0088cc]" />
            <h3 className="font-semibold text-foreground">Telegram Intel</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddChannel(!showAddChannel)}
              className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground"
              title="Add channel"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => fetchMessages()}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="flex gap-4 text-xs text-muted-foreground mb-3">
            <span>{stats.active_channels} channels</span>
            <span>{stats.messages_24h} messages (24h)</span>
          </div>
        )}

        {/* Search */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search keywords..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted/30 border border-border/50 text-sm focus:outline-none focus:border-primary/50"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-3 py-2 rounded-lg bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30"
          >
            Search
          </button>
        </div>

        {/* Add Channel Form */}
        {showAddChannel && (
          <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
            <input
              type="text"
              value={newChannel.username}
              onChange={(e) => setNewChannel({ ...newChannel, username: e.target.value })}
              placeholder="@channel_username"
              className="w-full px-3 py-2 rounded bg-background/50 border border-border/50 text-sm"
            />
            <input
              type="text"
              value={newChannel.displayName}
              onChange={(e) => setNewChannel({ ...newChannel, displayName: e.target.value })}
              placeholder="Display name (optional)"
              className="w-full px-3 py-2 rounded bg-background/50 border border-border/50 text-sm"
            />
            <div className="flex gap-2">
              <select
                value={newChannel.category}
                onChange={(e) => setNewChannel({ ...newChannel, category: e.target.value })}
                className="flex-1 px-3 py-2 rounded bg-background/50 border border-border/50 text-sm"
              >
                <option value="aviation">Aviation</option>
                <option value="military">Military</option>
                <option value="news">News</option>
                <option value="osint">OSINT</option>
                <option value="general">General</option>
              </select>
              <button
                onClick={handleAddChannel}
                className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="divide-y divide-border/30 max-h-[600px] overflow-y-auto">
        {loading && messages.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin" />
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p>No messages found</p>
            <p className="text-xs mt-1">Add channels to start monitoring</p>
          </div>
        ) : (
          messages.map((message, i) => {
            const MediaIcon = mediaIcons[message.media_type] || FileText;
            const catStyle = categoryColors[message.category] || categoryColors.general;

            return (
              <div
                key={`${message.channel_username}-${message.message_id}-${i}`}
                className="p-3 hover:bg-muted/20 transition-colors"
              >
                {/* Channel header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-[#0088cc]/20 flex items-center justify-center">
                    <Send className="h-4 w-4 text-[#0088cc]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://t.me/s/${message.channel_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-sm text-foreground hover:text-primary truncate flex items-center gap-1"
                      >
                        {message.channel_name}
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </a>
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', catStyle.bg, catStyle.text)}>
                        {message.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{formatDistanceToNow(new Date(message.posted_at), { addSuffix: true })}</span>
                      {message.views > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Eye className="h-2.5 w-2.5" />
                            {formatViews(message.views)}
                          </span>
                        </>
                      )}
                      {message.media_type !== 'text' && (
                        <>
                          <span>•</span>
                          <MediaIcon className="h-2.5 w-2.5" />
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Message content */}
                <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words line-clamp-4">
                  {message.content || (
                    <span className="text-muted-foreground italic">
                      [{message.media_type} content]
                    </span>
                  )}
                </p>

                {/* Relevance indicator */}
                {message.relevance_score !== null && message.relevance_score > 0.7 && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-400">
                    <AlertCircle className="h-3 w-3" />
                    High relevance ({Math.round(message.relevance_score * 100)}%)
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
