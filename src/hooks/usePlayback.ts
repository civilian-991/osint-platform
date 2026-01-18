'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePlaybackStore, type PlaybackSpeed, type TimeRange } from '@/lib/stores/playback-store';
import { PlaybackAnimator, createPlaybackAnimator } from '@/lib/services/playback-animator';

interface UsePlaybackReturn {
  // State
  isPlaybackMode: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  timeRange: TimeRange;
  startTime: Date | null;
  endTime: Date | null;
  currentTime: Date | null;
  speed: PlaybackSpeed;
  progress: number;
  frameCount: number;
  currentFrameIndex: number;
  eventCount: number;

  // Actions
  enterPlaybackMode: () => void;
  exitPlaybackMode: () => void;
  setTimeRange: (range: TimeRange, customStart?: Date, customEnd?: Date) => void;
  loadData: () => Promise<void>;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  seekTo: (time: Date) => void;
  seekToProgress: (progress: number) => void;
  reset: () => void;
}

export function usePlayback(): UsePlaybackReturn {
  const store = usePlaybackStore();
  const animatorRef = useRef<PlaybackAnimator | null>(null);

  // Calculate progress
  const progress = store.startTime && store.endTime && store.currentTime
    ? (store.currentTime.getTime() - store.startTime.getTime()) /
      (store.endTime.getTime() - store.startTime.getTime())
    : 0;

  // Create animator when entering playback mode
  useEffect(() => {
    if (store.isPlaybackMode && store.frames.length > 0 && !animatorRef.current) {
      animatorRef.current = createPlaybackAnimator({
        frames: store.frames,
        speed: store.speed,
        onPositionsUpdate: (positions, time) => {
          store.setCurrentPositions(positions);
        },
        onFrameChange: (frameIndex) => {
          // Store frame change is handled by animator
        },
        onPlaybackEnd: () => {
          store.pause();
        },
      });
    }

    return () => {
      if (animatorRef.current) {
        animatorRef.current.stop();
        animatorRef.current = null;
      }
    };
  }, [store.isPlaybackMode, store.frames]);

  // Update animator when speed changes
  useEffect(() => {
    if (animatorRef.current) {
      animatorRef.current.updateOptions({ speed: store.speed });
    }
  }, [store.speed]);

  // Update animator when frames change
  useEffect(() => {
    if (animatorRef.current) {
      animatorRef.current.updateOptions({ frames: store.frames });
    }
  }, [store.frames]);

  // Handle play/pause
  useEffect(() => {
    if (animatorRef.current) {
      if (store.isPlaying) {
        animatorRef.current.start();
      } else {
        animatorRef.current.stop();
      }
    }
  }, [store.isPlaying]);

  const play = useCallback(() => {
    store.play();
  }, [store]);

  const pause = useCallback(() => {
    store.pause();
  }, [store]);

  const toggle = useCallback(() => {
    if (store.isPlaying) {
      store.pause();
    } else {
      store.play();
    }
  }, [store]);

  const seekTo = useCallback((time: Date) => {
    store.seekTo(time);
    if (animatorRef.current) {
      animatorRef.current.seekTo(time.getTime());
    }
  }, [store]);

  const seekToProgress = useCallback((progress: number) => {
    if (!store.startTime || !store.endTime) return;

    const duration = store.endTime.getTime() - store.startTime.getTime();
    const targetTime = new Date(store.startTime.getTime() + duration * progress);
    seekTo(targetTime);
  }, [store.startTime, store.endTime, seekTo]);

  const reset = useCallback(() => {
    store.reset();
    if (animatorRef.current) {
      animatorRef.current.reset();
    }
  }, [store]);

  const exitPlaybackMode = useCallback(() => {
    if (animatorRef.current) {
      animatorRef.current.stop();
      animatorRef.current = null;
    }
    store.exitPlaybackMode();
  }, [store]);

  return {
    // State
    isPlaybackMode: store.isPlaybackMode,
    isPlaying: store.isPlaying,
    isLoading: store.isLoading,
    error: store.error,
    timeRange: store.timeRange,
    startTime: store.startTime,
    endTime: store.endTime,
    currentTime: store.currentTime,
    speed: store.speed,
    progress,
    frameCount: store.frames.length,
    currentFrameIndex: store.currentFrameIndex,
    eventCount: store.events.length,

    // Actions
    enterPlaybackMode: store.enterPlaybackMode,
    exitPlaybackMode,
    setTimeRange: store.setTimeRange,
    loadData: store.loadData,
    play,
    pause,
    toggle,
    setSpeed: store.setSpeed,
    seekTo,
    seekToProgress,
    reset,
  };
}
