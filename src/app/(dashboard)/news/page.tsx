'use client';

import { useState, useEffect, useCallback } from 'react';
import NewsFeed from '@/components/news/NewsFeed';
import CredibilityBadge from '@/components/news/CredibilityBadge';
import type { NewsEvent } from '@/lib/types/news';
import { format } from 'date-fns';
import {
  X, ExternalLink, MapPin, Tag, Users, Clock, RefreshCw,
  Globe, Zap, Radio, AlertTriangle, Crosshair
} from 'lucide-react';

export default function NewsPage() {
  const [news, setNews] = useState<NewsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedNews, setSelectedNews] = useState<NewsEvent | null>(null);

  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/news?live=true&limit=100');

      if (!response.ok) {
        throw new Error(`Failed to fetch news: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        const withIds = result.data.map((item: NewsEvent, index: number) => ({
          ...item,
          id: item.id || `news-${index}`,
        }));
        setNews(withIds);
        setError(null);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const handleNewsClick = (item: NewsEvent) => {
    setSelectedNews(item);
  };

  return (
    <div className="flex-1 flex h-screen bg-background overflow-hidden">
      {/* News Feed Panel */}
      <div className="w-[420px] border-r border-border/50 flex flex-col bg-card/30 backdrop-blur-sm">
        {/* Panel Header */}
        <div className="relative px-5 py-4 border-b border-border/50 overflow-hidden">
          {/* Animated scan line */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent animate-pulse" />
            <div
              className="absolute h-px w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent"
              style={{
                animation: 'scanLine 3s ease-in-out infinite',
                top: '50%',
              }}
            />
          </div>

          <div className="relative flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
              <div className="relative p-2 rounded-lg bg-primary/10 border border-primary/30">
                <Radio className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                INTELLIGENCE FEED
              </h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  LIVE
                </span>
                <span className="text-border">|</span>
                <span>{news.length} reports</span>
              </div>
            </div>
          </div>
        </div>

        <NewsFeed
          news={news}
          onNewsClick={handleNewsClick}
          selectedNewsId={selectedNews?.id}
          loading={loading}
          compact={false}
        />
      </div>

      {/* News Details Panel */}
      <div className="flex-1 overflow-hidden bg-gradient-to-br from-background via-background to-card/20">
        {selectedNews ? (
          <NewsDetails
            news={selectedNews}
            onClose={() => setSelectedNews(null)}
          />
        ) : (
          <EmptyState loading={loading} onRefresh={fetchNews} newsCount={news.length} />
        )}
      </div>

      {/* Global Styles for animations */}
      <style jsx global>{`
        @keyframes scanLine {
          0%, 100% { transform: translateY(-100px); opacity: 0; }
          50% { transform: translateY(100px); opacity: 1; }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .animate-slide-up {
          animation: slideUp 0.4s ease-out forwards;
        }

        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

function EmptyState({
  loading,
  onRefresh,
  newsCount
}: {
  loading: boolean;
  onRefresh: () => void;
  newsCount: number;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full relative">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 212, 255, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 212, 255, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Crosshair decoration */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
        <Crosshair className="w-96 h-96 text-primary" strokeWidth={0.5} />
      </div>

      <div className="relative z-10 text-center max-w-md mx-auto px-6">
        <div className="relative inline-flex mb-6">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
          <div className="relative p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm">
            <Globe className="h-12 w-12 text-primary/60" />
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-3 text-foreground">
          Select Intelligence Report
        </h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          Choose a report from the feed to view detailed analysis,
          extracted entities, and source credibility assessment.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="group flex items-center justify-center gap-2 px-6 py-3 bg-primary/10 hover:bg-primary/20
                       border border-primary/30 rounded-lg text-primary font-medium transition-all duration-300
                       hover:shadow-lg hover:shadow-primary/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 transition-transform duration-500 ${loading ? 'animate-spin' : 'group-hover:rotate-180'}`} />
            Refresh Feed
          </button>
        </div>

        {newsCount > 0 && (
          <p className="mt-8 text-sm text-muted-foreground/60">
            <Zap className="inline h-3 w-3 mr-1 text-primary" />
            {newsCount} intelligence reports available
          </p>
        )}
      </div>
    </div>
  );
}

function NewsDetails({
  news,
  onClose,
}: {
  news: NewsEvent;
  onClose: () => void;
}) {
  const domain = new URL(news.url).hostname.replace('www.', '');

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-8">
          <div className="flex-1 animate-slide-up" style={{ animationDelay: '0ms' }}>
            {/* Source & Credibility */}
            <div className="flex items-center gap-3 mb-4">
              <CredibilityBadge score={news.credibility_score} size="lg" />
              <div className="h-4 w-px bg-border" />
              <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
                {domain}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold leading-tight mb-4 text-foreground">
              {news.title}
            </h1>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary/60" />
                <span>{format(new Date(news.published_at), 'PPpp')}</span>
              </div>
              {news.language && (
                <>
                  <div className="h-3 w-px bg-border" />
                  <span className="uppercase font-mono text-xs tracking-wider">
                    {news.language}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-3 rounded-xl bg-card/50 border border-border/50 hover:bg-destructive/10
                       hover:border-destructive/30 hover:text-destructive transition-all duration-200
                       group"
          >
            <X className="h-5 w-5 transition-transform group-hover:rotate-90" />
          </button>
        </div>

        {/* Featured Image */}
        {news.image_url && (
          <div
            className="relative mb-8 rounded-2xl overflow-hidden border border-border/50 animate-slide-up"
            style={{ animationDelay: '50ms' }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent z-10" />
            <img
              src={news.image_url}
              alt=""
              className="w-full max-h-[400px] object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).parentElement!.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Content Grid */}
        <div className="grid gap-6">
          {/* Countries - Prominent */}
          {news.countries.length > 0 && (
            <div
              className="p-5 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm animate-slide-up"
              style={{ animationDelay: '100ms' }}
            >
              <h2 className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">
                <Globe className="h-4 w-4 text-primary" />
                Regions Mentioned
              </h2>
              <div className="flex flex-wrap gap-2">
                {news.countries.map((country, index) => (
                  <span
                    key={index}
                    className="px-4 py-2 bg-primary/10 border border-primary/30 rounded-lg
                               text-primary font-medium capitalize transition-all duration-200
                               hover:bg-primary/20 hover:scale-105 cursor-default"
                  >
                    {country.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Entities */}
          {news.entities.length > 0 && (
            <div
              className="p-5 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm animate-slide-up"
              style={{ animationDelay: '150ms' }}
            >
              <h2 className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">
                <Users className="h-4 w-4 text-primary" />
                Extracted Entities
              </h2>
              <div className="flex flex-wrap gap-2">
                {news.entities.map((entity, index) => {
                  const typeConfig: Record<string, { bg: string; border: string; text: string }> = {
                    military: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
                    organization: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
                    aircraft: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' },
                    location: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' },
                    person: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
                  };

                  const config = typeConfig[entity.type] || {
                    bg: 'bg-muted/50',
                    border: 'border-border',
                    text: 'text-foreground'
                  };

                  return (
                    <span
                      key={index}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200
                                  hover:scale-105 cursor-default ${config.bg} ${config.border} ${config.text}`}
                    >
                      <span className="text-xs opacity-60 mr-1.5 uppercase">{entity.type}:</span>
                      {entity.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Locations */}
          {news.locations.length > 0 && (
            <div
              className="p-5 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm animate-slide-up"
              style={{ animationDelay: '200ms' }}
            >
              <h2 className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">
                <MapPin className="h-4 w-4 text-primary" />
                Geographic References
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {news.locations.map((loc, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50
                               hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">{loc.name}</span>
                    <span className="text-xs text-muted-foreground capitalize px-2 py-0.5 bg-background/50 rounded">
                      {loc.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          {news.categories.length > 0 && (
            <div
              className="p-5 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm animate-slide-up"
              style={{ animationDelay: '250ms' }}
            >
              <h2 className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">
                <Tag className="h-4 w-4 text-primary" />
                Classification Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {news.categories.map((cat, index) => (
                  <span
                    key={index}
                    className="px-4 py-2 bg-muted/50 border border-border/50 rounded-lg text-sm
                               font-medium capitalize text-foreground hover:bg-muted transition-colors"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Content */}
          {news.content && (
            <div
              className="p-5 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm animate-slide-up"
              style={{ animationDelay: '300ms' }}
            >
              <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">
                Report Summary
              </h2>
              <p className="text-foreground/90 leading-relaxed text-lg">
                {news.content}
              </p>
            </div>
          )}

          {/* Actions */}
          <div
            className="flex flex-wrap gap-4 pt-4 animate-slide-up"
            style={{ animationDelay: '350ms' }}
          >
            <a
              href={news.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-6 py-3 bg-primary text-primary-foreground
                         rounded-xl font-semibold transition-all duration-300
                         hover:shadow-lg hover:shadow-primary/25 hover:scale-[1.02]"
            >
              <ExternalLink className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              Read Full Article
            </a>

            <button
              onClick={onClose}
              className="flex items-center gap-2 px-6 py-3 bg-card/50 border border-border/50
                         rounded-xl font-medium text-muted-foreground hover:text-foreground
                         hover:bg-muted/50 transition-all duration-200"
            >
              <X className="h-4 w-4" />
              Close Report
            </button>
          </div>

          {/* Warning for low credibility */}
          {news.credibility_score < 0.5 && (
            <div
              className="flex items-start gap-4 p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 animate-slide-up"
              style={{ animationDelay: '400ms' }}
            >
              <AlertTriangle className="h-6 w-6 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-400 mb-1">Verification Advisory</h3>
                <p className="text-sm text-amber-200/80">
                  This source has a lower credibility rating. Cross-reference with multiple sources
                  before relying on this information for critical assessments.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
