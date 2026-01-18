'use client';

import { useRef, useState, useCallback } from 'react';
import type { TimelineEvent } from '@/lib/stores/playback-store';
import { cn } from '@/lib/utils/cn';

interface TimelineScrubberProps {
  startTime: Date;
  endTime: Date;
  currentTime: Date;
  progress: number;
  events: TimelineEvent[];
  onSeek: (progress: number) => void;
  disabled?: boolean;
}

export default function TimelineScrubber({
  startTime,
  endTime,
  currentTime,
  progress,
  events,
  onSeek,
  disabled = false,
}: TimelineScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);

  const duration = endTime.getTime() - startTime.getTime();

  // Calculate event positions
  const eventPositions = events.map((event) => {
    const eventTime = new Date(event.event_time).getTime();
    return {
      event,
      position: (eventTime - startTime.getTime()) / duration,
    };
  });

  // Handle mouse/touch events for seeking
  const getProgressFromEvent = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      return Math.max(0, Math.min(1, x / rect.width));
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      setIsDragging(true);
      onSeek(getProgressFromEvent(e.clientX));
    },
    [disabled, getProgressFromEvent, onSeek]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!trackRef.current) return;

      // Update hover position
      const rect = trackRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setHoverPosition(x / rect.width);

      // Handle dragging
      if (isDragging && !disabled) {
        onSeek(getProgressFromEvent(e.clientX));
      }
    },
    [isDragging, disabled, getProgressFromEvent, onSeek]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setHoverPosition(null);
    setHoveredEvent(null);
  }, []);

  // Format time for display
  const formatTimeLabel = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-1">
      {/* Event markers */}
      <div className="relative h-3">
        {eventPositions.map(({ event, position }) => (
          <div
            key={event.event_id}
            className={cn(
              'absolute top-0 w-2 h-2 rounded-full transform -translate-x-1/2 cursor-pointer transition-transform hover:scale-150',
              event.severity === 'high' && 'bg-red-500',
              event.severity === 'medium' && 'bg-yellow-500',
              event.severity === 'low' && 'bg-blue-500'
            )}
            style={{ left: `${position * 100}%` }}
            onMouseEnter={() => setHoveredEvent(event)}
            onMouseLeave={() => setHoveredEvent(null)}
            title={`${event.title} (${event.event_type})`}
          />
        ))}

        {/* Hovered event tooltip */}
        {hoveredEvent && (
          <div
            className="absolute top-4 z-10 bg-popover border border-border rounded-lg p-2 shadow-lg max-w-64"
            style={{
              left: `${
                eventPositions.find((e) => e.event.event_id === hoveredEvent.event_id)
                  ?.position ?? 0
              * 100}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <p className="text-xs font-medium truncate">{hoveredEvent.title}</p>
            <p className="text-xs text-muted-foreground">{hoveredEvent.event_type}</p>
          </div>
        )}
      </div>

      {/* Timeline track */}
      <div
        ref={trackRef}
        className={cn(
          'relative h-2 bg-muted rounded-full cursor-pointer',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Progress fill */}
        <div
          className="absolute inset-y-0 left-0 bg-primary rounded-full"
          style={{ width: `${progress * 100}%` }}
        />

        {/* Hover indicator */}
        {hoverPosition !== null && !disabled && (
          <div
            className="absolute inset-y-0 w-0.5 bg-foreground/30"
            style={{ left: `${hoverPosition * 100}%` }}
          />
        )}

        {/* Playhead */}
        <div
          className={cn(
            'absolute top-1/2 w-3 h-3 bg-primary rounded-full transform -translate-x-1/2 -translate-y-1/2',
            'shadow-md border-2 border-background',
            isDragging && 'scale-125'
          )}
          style={{ left: `${progress * 100}%` }}
        />
      </div>

      {/* Time labels */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatTimeLabel(startTime)}</span>
        {hoverPosition !== null && (
          <span className="text-foreground">
            {formatTimeLabel(
              new Date(startTime.getTime() + hoverPosition * duration)
            )}
          </span>
        )}
        <span>{formatTimeLabel(endTime)}</span>
      </div>
    </div>
  );
}
