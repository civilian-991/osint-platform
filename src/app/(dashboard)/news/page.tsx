'use client';

import { useState, useEffect, useCallback } from 'react';
import NewsFeed from '@/components/news/NewsFeed';
import NewsCard from '@/components/news/NewsCard';
import CredibilityBadge from '@/components/news/CredibilityBadge';
import type { NewsEvent } from '@/lib/types/news';
import { format } from 'date-fns';
import { X, ExternalLink, MapPin, Tag, Users, Clock, RefreshCw } from 'lucide-react';

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
        // Add IDs if missing (for live GDELT data)
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
    <div className="flex-1 flex h-screen">
      {/* News Feed */}
      <div className="w-96 border-r border-border overflow-hidden">
        <NewsFeed
          news={news}
          onNewsClick={handleNewsClick}
          selectedNewsId={selectedNews?.id}
          loading={loading}
          compact={false}
        />
      </div>

      {/* News Details */}
      <div className="flex-1 overflow-y-auto">
        {selectedNews ? (
          <NewsDetails
            news={selectedNews}
            onClose={() => setSelectedNews(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p className="mb-4">Select a news item to view details</p>
            <button
              onClick={fetchNews}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh News
            </button>
          </div>
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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <CredibilityBadge score={news.credibility_score} size="md" />
            <span className="text-sm text-muted-foreground">{domain}</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">{news.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{format(new Date(news.published_at), 'PPpp')}</span>
            </div>
            {news.language && <span>Language: {news.language.toUpperCase()}</span>}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 hover:bg-muted rounded-md transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Image */}
      {news.image_url && (
        <div className="mb-6 rounded-lg overflow-hidden bg-muted">
          <img
            src={news.image_url}
            alt=""
            className="w-full max-h-80 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Content */}
      {news.content && (
        <div className="mb-6">
          <h2 className="font-semibold text-lg mb-2">Content</h2>
          <p className="text-muted-foreground leading-relaxed">{news.content}</p>
        </div>
      )}

      {/* Locations */}
      {news.locations.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Mentioned Locations
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {news.locations.map((loc, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2"
              >
                <span>{loc.name}</span>
                <span className="text-xs text-muted-foreground capitalize">
                  {loc.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entities */}
      {news.entities.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Entities
          </h2>
          <div className="flex flex-wrap gap-2">
            {news.entities.map((entity, index) => {
              const typeColors: Record<string, string> = {
                military: 'bg-red-500/10 text-red-500 border-red-500/20',
                organization: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                aircraft: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
                location: 'bg-green-500/10 text-green-500 border-green-500/20',
                person: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
              };

              return (
                <span
                  key={index}
                  className={`px-3 py-1 rounded-full text-sm border ${
                    typeColors[entity.type] || 'bg-muted'
                  }`}
                >
                  {entity.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Categories */}
      {news.categories.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Categories
          </h2>
          <div className="flex flex-wrap gap-2">
            {news.categories.map((cat, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-muted rounded-full text-sm capitalize"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Countries */}
      {news.countries.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold text-lg mb-3">Countries</h2>
          <div className="flex flex-wrap gap-2">
            {news.countries.map((country, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm capitalize"
              >
                {country.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-6 border-t border-border">
        <a
          href={news.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Read Full Article
        </a>
      </div>
    </div>
  );
}
