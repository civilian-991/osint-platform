'use client';

import { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  X,
  Clock,
  Loader2,
  AlertCircle,
  History,
} from 'lucide-react';
import { usePlayback } from '@/hooks/usePlayback';
import { usePlaybackStore, type PlaybackSpeed, type TimeRange } from '@/lib/stores/playback-store';
import TimelineScrubber from './TimelineScrubber';
import SpeedControl from './SpeedControl';
import TimeRangeSelector from './TimeRangeSelector';
import { cn } from '@/lib/utils/cn';
import { format } from 'date-fns';

interface PlaybackControllerProps {
  className?: string;
  onClose?: () => void;
}

export default function PlaybackController({ className, onClose }: PlaybackControllerProps) {
  const {
    isPlaybackMode,
    isPlaying,
    isLoading,
    error,
    timeRange,
    startTime,
    endTime,
    currentTime,
    speed,
    progress,
    frameCount,
    eventCount,
    enterPlaybackMode,
    exitPlaybackMode,
    setTimeRange,
    loadData,
    play,
    pause,
    toggle,
    setSpeed,
    seekToProgress,
    reset,
  } = usePlayback();

  const events = usePlaybackStore((state) => state.events);
  const [showRangeSelector, setShowRangeSelector] = useState(false);

  // Load data when time range changes
  useEffect(() => {
    if (isPlaybackMode && startTime && endTime && frameCount === 0) {
      loadData();
    }
  }, [isPlaybackMode, startTime, endTime, frameCount, loadData]);

  // Not in playback mode - show enter button
  if (!isPlaybackMode) {
    return (
      <button
        onClick={enterPlaybackMode}
        className={cn(
          'flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg',
          'hover:bg-muted transition-colors',
          className
        )}
      >
        <History className="h-4 w-4" />
        <span className="text-sm font-medium">Historical Playback</span>
      </button>
    );
  }

  const handleClose = () => {
    exitPlaybackMode();
    onClose?.();
  };

  return (
    <div
      className={cn(
        'bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Historical Playback</span>
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <button
          onClick={handleClose}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Main controls */}
      <div className="p-4 space-y-4">
        {/* Time range selector */}
        <div className="flex items-center gap-2">
          <TimeRangeSelector
            value={timeRange}
            onChange={(range, customStart, customEnd) => {
              setTimeRange(range, customStart, customEnd);
            }}
            startTime={startTime}
            endTime={endTime}
          />

          {frameCount > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {frameCount} frames
            </span>
          )}
        </div>

        {/* Timeline scrubber */}
        {frameCount > 0 && startTime && endTime && (
          <TimelineScrubber
            startTime={startTime}
            endTime={endTime}
            currentTime={currentTime || startTime}
            progress={progress}
            events={events}
            onSeek={seekToProgress}
            disabled={isLoading}
          />
        )}

        {/* Playback controls */}
        <div className="flex items-center justify-between">
          {/* Play/Pause controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={reset}
              disabled={isLoading || frameCount === 0}
              className={cn(
                'p-2 rounded-lg transition-colors',
                'hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title="Reset to beginning"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              onClick={toggle}
              disabled={isLoading || frameCount === 0}
              className={cn(
                'p-3 rounded-full transition-colors',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </button>
          </div>

          {/* Current time display */}
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {currentTime ? (
              <span className="font-mono">
                {format(currentTime, 'HH:mm:ss')}
              </span>
            ) : (
              <span className="text-muted-foreground">--:--:--</span>
            )}
          </div>

          {/* Speed control */}
          <SpeedControl
            value={speed}
            onChange={setSpeed}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border bg-muted/50">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {startTime && format(startTime, 'MMM d, HH:mm')}
            {' - '}
            {endTime && format(endTime, 'HH:mm')}
          </span>
          {eventCount > 0 && (
            <span>{eventCount} events</span>
          )}
        </div>
      </div>
    </div>
  );
}
