'use client';

import { ExternalLink, Clock, MapPin, Zap } from 'lucide-react';
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

  // Get credibility color for accent
  const getAccentColor = (score: number) => {
    if (score >= 0.8) return { border: 'border-green-500/30', glow: 'shadow-green-500/10' };
    if (score >= 0.6) return { border: 'border-amber-500/30', glow: 'shadow-amber-500/10' };
    if (score >= 0.4) return { border: 'border-orange-500/30', glow: 'shadow-orange-500/10' };
    return { border: 'border-red-500/30', glow: 'shadow-red-500/10' };
  };

  const accent = getAccentColor(news.credibility_score);

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={cn(
          'group relative p-3 rounded-lg cursor-pointer transition-all duration-200',
          isSelected
            ? `bg-primary/10 border-l-2 border-l-primary border border-primary/30 shadow-lg ${accent.glow}`
            : 'bg-card/50 border border-border/30 hover:bg-card hover:border-border/50'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              'text-sm font-medium line-clamp-2 leading-snug transition-colors',
              isSelected ? 'text-foreground' : 'text-foreground/90 group-hover:text-foreground'
            )}>
              {news.title}
            </h3>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-mono text-muted-foreground truncate max-w-[120px]">
                {domain}
              </span>
              <span className="text-border">·</span>
              <span className="text-xs text-muted-foreground/80">{publishedAgo}</span>
            </div>
          </div>
          <CredibilityBadge score={news.credibility_score} showLabel={false} size="sm" />
        </div>

        {/* Hover indicator */}
        <div className={cn(
          'absolute left-0 top-0 bottom-0 w-0.5 rounded-l transition-all duration-200',
          isSelected ? 'bg-primary' : 'bg-transparent group-hover:bg-primary/50'
        )} />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300',
        isSelected
          ? `bg-card border-2 ${accent.border} shadow-xl ${accent.glow}`
          : 'bg-card/50 border border-border/30 hover:bg-card hover:border-border/50 hover:shadow-lg'
      )}
    >
      {/* Featured Image with Overlay */}
      {news.image_url && (
        <div className="relative h-36 overflow-hidden">
          <img
            src={news.image_url}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).parentElement!.style.display = 'none';
            }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />

          {/* Source badge on image */}
          <div className="absolute top-3 left-3">
            <span className="px-2 py-1 text-xs font-mono bg-black/60 backdrop-blur-sm rounded text-white/90">
              {domain}
            </span>
          </div>

          {/* External link */}
          <a
            href={news.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-3 right-3 p-2 bg-black/60 backdrop-blur-sm rounded-lg
                       text-white/80 hover:text-white hover:bg-black/80 transition-all duration-200
                       opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}

      <div className="p-4">
        {/* Header - Credibility & Time */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <CredibilityBadge score={news.credibility_score} size="sm" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{publishedAgo}</span>
          </div>
        </div>

        {/* Title */}
        <h3 className={cn(
          'font-semibold leading-snug mb-3 transition-colors line-clamp-2',
          isSelected ? 'text-foreground' : 'text-foreground/90 group-hover:text-foreground'
        )}>
          {news.title}
        </h3>

        {/* Locations - if any */}
        {news.locations.length > 0 && (
          <div className="flex items-center gap-1.5 mb-3">
            <MapPin className="h-3.5 w-3.5 text-primary/70 flex-shrink-0" />
            <div className="flex items-center gap-1 overflow-hidden">
              {news.locations.slice(0, 2).map((loc, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 bg-primary/10 text-primary/90 rounded truncate"
                >
                  {loc.name}
                </span>
              ))}
              {news.locations.length > 2 && (
                <span className="text-xs text-muted-foreground">
                  +{news.locations.length - 2}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Categories - styled as tags */}
        {news.categories.length > 0 && (
          <div className="flex items-center gap-1 mb-3 flex-wrap">
            <Zap className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
            {news.categories.slice(0, 3).map((cat, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 bg-muted/50 border border-border/50 rounded capitalize text-muted-foreground"
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        {/* Entities - color coded */}
        {news.entities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border/30">
            {news.entities.slice(0, 4).map((entity, i) => {
              const typeColors: Record<string, string> = {
                military: 'bg-red-500/15 text-red-400 border-red-500/20',
                organization: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
                aircraft: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
                location: 'bg-green-500/15 text-green-400 border-green-500/20',
              };

              return (
                <span
                  key={i}
                  className={cn(
                    'text-xs px-2 py-1 rounded border font-medium',
                    typeColors[entity.type] || 'bg-muted/50 text-foreground/80 border-border/50'
                  )}
                >
                  {entity.name}
                </span>
              );
            })}
            {news.entities.length > 4 && (
              <span className="text-xs text-muted-foreground self-center">
                +{news.entities.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Countries */}
        {news.countries.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/30">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
              Regions:
            </span>
            <div className="flex flex-wrap gap-1">
              {news.countries.slice(0, 3).map((country, i) => (
                <span
                  key={i}
                  className="text-xs text-primary/80 capitalize"
                >
                  {country.replace('_', ' ')}{i < Math.min(news.countries.length, 3) - 1 && ','}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute inset-0 pointer-events-none border-2 border-primary/50 rounded-xl" />
      )}
    </div>
  );
}
