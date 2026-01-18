'use client';

import { ExternalLink, Clock, MapPin, Tag } from 'lucide-react';
import type { NewsEvent } from '@/lib/types/news';
import CredibilityBadge from './CredibilityBadge';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils/cn';

interface NewsCardProps {
  news: NewsEvent;
  onClick?: () => void;
  isSelected?: boolean;
  compact?: boolean;
}

export default function NewsCard({
  news,
  onClick,
  isSelected,
  compact = false,
}: NewsCardProps) {
  const publishedAgo = formatDistanceToNow(new Date(news.published_at), {
    addSuffix: true,
  });

  const domain = new URL(news.url).hostname.replace('www.', '');

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={cn(
          'p-3 rounded-md cursor-pointer transition-colors',
          isSelected ? 'bg-primary/10 border border-primary' : 'hover:bg-muted'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium line-clamp-2">{news.title}</h3>
          <CredibilityBadge score={news.credibility_score} showLabel={false} size="sm" />
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span>{domain}</span>
          <span>{publishedAgo}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-card border rounded-lg overflow-hidden cursor-pointer transition-all',
        isSelected
          ? 'border-primary shadow-md ring-1 ring-primary'
          : 'border-border hover:border-primary/50 hover:shadow-sm'
      )}
    >
      {/* Image */}
      {news.image_url && (
        <div className="relative h-40 bg-muted">
          <img
            src={news.image_url}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <CredibilityBadge score={news.credibility_score} size="sm" />
          <a
            href={news.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-primary"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-lg mb-2 line-clamp-2">{news.title}</h3>

        {/* Content preview */}
        {news.content && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {news.content}
          </p>
        )}

        {/* Locations */}
        {news.locations.length > 0 && (
          <div className="flex items-center gap-1 mb-2 flex-wrap">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            {news.locations.slice(0, 3).map((loc, i) => (
              <span key={i} className="text-xs text-muted-foreground">
                {loc.name}
                {i < Math.min(news.locations.length, 3) - 1 && ','}
              </span>
            ))}
            {news.locations.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{news.locations.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Categories */}
        {news.categories.length > 0 && (
          <div className="flex items-center gap-1 mb-3 flex-wrap">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            {news.categories.slice(0, 4).map((cat, i) => (
              <span
                key={i}
                className="text-xs px-1.5 py-0.5 bg-muted rounded"
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
          <span className="font-medium">{domain}</span>
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{publishedAgo}</span>
          </div>
        </div>

        {/* Entities */}
        {news.entities.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-xs text-muted-foreground mb-1">Entities:</div>
            <div className="flex flex-wrap gap-1">
              {news.entities.slice(0, 6).map((entity, i) => (
                <span
                  key={i}
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded',
                    entity.type === 'military' && 'bg-red-500/10 text-red-500',
                    entity.type === 'organization' && 'bg-blue-500/10 text-blue-500',
                    entity.type === 'aircraft' && 'bg-purple-500/10 text-purple-500',
                    entity.type === 'location' && 'bg-green-500/10 text-green-500',
                    !['military', 'organization', 'aircraft', 'location'].includes(entity.type) &&
                      'bg-muted'
                  )}
                >
                  {entity.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
