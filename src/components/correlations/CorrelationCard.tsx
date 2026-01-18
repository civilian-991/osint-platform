'use client';

import { Link2, Clock, MapPin, Plane, Newspaper, Check, X, Flag } from 'lucide-react';
import type { CorrelationWithRelations, CorrelationStatus } from '@/lib/types/correlation';
import ConfidenceIndicator from './ConfidenceIndicator';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils/cn';

interface CorrelationCardProps {
  correlation: CorrelationWithRelations;
  onVerify?: (status: CorrelationStatus) => void;
  onClick?: () => void;
  isSelected?: boolean;
}

export default function CorrelationCard({
  correlation,
  onVerify,
  onClick,
  isSelected,
}: CorrelationCardProps) {
  const createdAgo = formatDistanceToNow(new Date(correlation.created_at), {
    addSuffix: true,
  });

  const typeLabels: Record<string, string> = {
    temporal: 'Temporal Match',
    spatial: 'Spatial Match',
    entity: 'Entity Match',
    pattern: 'Pattern Match',
    combined: 'Combined Match',
  };

  const statusConfig: Record<CorrelationStatus, { icon: typeof Check; color: string; label: string }> = {
    pending: { icon: Flag, color: 'text-yellow-500', label: 'Pending Review' },
    verified: { icon: Check, color: 'text-green-500', label: 'Verified' },
    dismissed: { icon: X, color: 'text-red-500', label: 'Dismissed' },
    flagged: { icon: Flag, color: 'text-orange-500', label: 'Flagged' },
  };

  const StatusIcon = statusConfig[correlation.status].icon;

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-card border rounded-lg p-4 cursor-pointer transition-all',
        isSelected
          ? 'border-primary shadow-md ring-1 ring-primary'
          : 'border-border hover:border-primary/50 hover:shadow-sm'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          <span className="font-semibold">{typeLabels[correlation.correlation_type]}</span>
        </div>

        <div className={cn('flex items-center gap-1 text-sm', statusConfig[correlation.status].color)}>
          <StatusIcon className="h-4 w-4" />
          <span>{statusConfig[correlation.status].label}</span>
        </div>
      </div>

      {/* Confidence */}
      <div className="mb-4">
        <ConfidenceIndicator score={correlation.confidence_score} size="md" />
      </div>

      {/* Score breakdown */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
        <div className="flex items-center justify-between bg-muted rounded px-2 py-1">
          <span className="text-muted-foreground">Temporal</span>
          <span>{Math.round(correlation.temporal_score * 100)}%</span>
        </div>
        <div className="flex items-center justify-between bg-muted rounded px-2 py-1">
          <span className="text-muted-foreground">Spatial</span>
          <span>{Math.round(correlation.spatial_score * 100)}%</span>
        </div>
        <div className="flex items-center justify-between bg-muted rounded px-2 py-1">
          <span className="text-muted-foreground">Entity</span>
          <span>{Math.round(correlation.entity_score * 100)}%</span>
        </div>
        <div className="flex items-center justify-between bg-muted rounded px-2 py-1">
          <span className="text-muted-foreground">Pattern</span>
          <span>{Math.round(correlation.pattern_score * 100)}%</span>
        </div>
      </div>

      {/* Linked items */}
      <div className="space-y-2 mb-4">
        {/* News Event */}
        {correlation.news_event && (
          <div className="flex items-start gap-2 p-2 bg-muted/50 rounded">
            <Newspaper className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-1">
                {correlation.news_event.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(correlation.news_event.published_at), 'MMM d, HH:mm')}
              </p>
            </div>
          </div>
        )}

        {/* Aircraft */}
        {correlation.aircraft && (
          <div className="flex items-start gap-2 p-2 bg-muted/50 rounded">
            <Plane className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium font-mono">
                {correlation.aircraft.registration || correlation.aircraft.icao_hex}
              </p>
              <p className="text-xs text-muted-foreground">
                {correlation.aircraft.type_description || correlation.aircraft.type_code}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Evidence */}
      {correlation.evidence && (
        <div className="space-y-1 text-xs border-t border-border pt-3 mb-4">
          {correlation.evidence.temporal && (
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                {correlation.evidence.temporal.differenceMinutes} min difference
              </span>
            </div>
          )}
          {correlation.evidence.spatial?.newsLocation && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                Near {correlation.evidence.spatial.newsLocation.name}
              </span>
            </div>
          )}
          {correlation.evidence.pattern && (
            <div className="flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                {correlation.evidence.pattern.detectedPattern} pattern detected
              </span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {onVerify && correlation.status === 'pending' && (
        <div className="flex items-center gap-2 pt-3 border-t border-border">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVerify('verified');
            }}
            className="flex-1 py-1.5 px-3 bg-green-500/10 text-green-500 rounded text-sm font-medium hover:bg-green-500/20 transition-colors"
          >
            Verify
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVerify('dismissed');
            }}
            className="flex-1 py-1.5 px-3 bg-red-500/10 text-red-500 rounded text-sm font-medium hover:bg-red-500/20 transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVerify('flagged');
            }}
            className="py-1.5 px-3 bg-orange-500/10 text-orange-500 rounded text-sm font-medium hover:bg-orange-500/20 transition-colors"
          >
            Flag
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-muted-foreground pt-2">
        Created {createdAgo}
      </div>
    </div>
  );
}
