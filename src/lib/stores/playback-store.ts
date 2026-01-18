import { create } from 'zustand';

export interface PlaybackPosition {
  icao_hex: string;
  callsign: string | null;
  latitude: number;
  longitude: number;
  altitude: number | null;
  ground_speed: number | null;
  track: number | null;
  timestamp: string;
  aircraft_type: string | null;
  military_category: string | null;
}

export interface PlaybackFrame {
  timestamp: number;
  positions: PlaybackPosition[];
}

export interface TimelineEvent {
  event_id: string;
  event_type: 'news' | 'correlation' | 'strike';
  event_time: string;
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high';
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, unknown>;
}

export type PlaybackSpeed = 0.5 | 1 | 2 | 4 | 8;

export type TimeRange = '1h' | '6h' | '12h' | '24h' | 'custom';

export interface PlaybackState {
  // Mode
  isPlaybackMode: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;

  // Time range
  timeRange: TimeRange;
  startTime: Date | null;
  endTime: Date | null;
  currentTime: Date | null;

  // Playback control
  speed: PlaybackSpeed;
  sampleInterval: number; // seconds

  // Data
  frames: PlaybackFrame[];
  currentFrameIndex: number;
  events: TimelineEvent[];

  // Interpolated positions for current time
  currentPositions: PlaybackPosition[];

  // Actions
  enterPlaybackMode: () => void;
  exitPlaybackMode: () => void;
  setTimeRange: (range: TimeRange, customStart?: Date, customEnd?: Date) => void;
  loadData: () => Promise<void>;
  play: () => void;
  pause: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  seekTo: (time: Date) => void;
  seekToFrame: (frameIndex: number) => void;
  setCurrentPositions: (positions: PlaybackPosition[]) => void;
  advanceFrame: () => boolean; // Returns true if there are more frames
  reset: () => void;
}

const DEFAULT_SAMPLE_INTERVAL = 30; // 30 seconds

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  // Initial state
  isPlaybackMode: false,
  isPlaying: false,
  isLoading: false,
  error: null,

  timeRange: '1h',
  startTime: null,
  endTime: null,
  currentTime: null,

  speed: 1,
  sampleInterval: DEFAULT_SAMPLE_INTERVAL,

  frames: [],
  currentFrameIndex: 0,
  events: [],
  currentPositions: [],

  // Actions
  enterPlaybackMode: () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    set({
      isPlaybackMode: true,
      isPlaying: false,
      timeRange: '1h',
      startTime: oneHourAgo,
      endTime: now,
      currentTime: oneHourAgo,
      frames: [],
      currentFrameIndex: 0,
      events: [],
      currentPositions: [],
      error: null,
    });
  },

  exitPlaybackMode: () => {
    set({
      isPlaybackMode: false,
      isPlaying: false,
      frames: [],
      currentFrameIndex: 0,
      events: [],
      currentPositions: [],
      startTime: null,
      endTime: null,
      currentTime: null,
      error: null,
    });
  },

  setTimeRange: (range: TimeRange, customStart?: Date, customEnd?: Date) => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (range) {
      case '1h':
        start = new Date(now.getTime() - 1 * 60 * 60 * 1000);
        break;
      case '6h':
        start = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '12h':
        start = new Date(now.getTime() - 12 * 60 * 60 * 1000);
        break;
      case '24h':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (!customStart || !customEnd) {
          set({ error: 'Custom range requires start and end times' });
          return;
        }
        start = customStart;
        end = customEnd;
        break;
      default:
        start = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    }

    set({
      timeRange: range,
      startTime: start,
      endTime: end,
      currentTime: start,
      currentFrameIndex: 0,
      isPlaying: false,
      frames: [],
      events: [],
      currentPositions: [],
    });
  },

  loadData: async () => {
    const { startTime, endTime, sampleInterval } = get();

    if (!startTime || !endTime) {
      set({ error: 'No time range selected' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // Load positions and events in parallel
      const [positionsResponse, eventsResponse] = await Promise.all([
        fetch(
          `/api/positions/history?` +
            `startTime=${startTime.toISOString()}&` +
            `endTime=${endTime.toISOString()}&` +
            `sampleInterval=${sampleInterval}`
        ),
        fetch(
          `/api/timeline/events?` +
            `startTime=${startTime.toISOString()}&` +
            `endTime=${endTime.toISOString()}`
        ),
      ]);

      if (!positionsResponse.ok) {
        throw new Error('Failed to load position history');
      }
      if (!eventsResponse.ok) {
        throw new Error('Failed to load timeline events');
      }

      const positionsData = await positionsResponse.json();
      const eventsData = await eventsResponse.json();

      if (!positionsData.success) {
        throw new Error(positionsData.error || 'Failed to load positions');
      }
      if (!eventsData.success) {
        throw new Error(eventsData.error || 'Failed to load events');
      }

      set({
        frames: positionsData.data.frames,
        events: eventsData.data.events,
        isLoading: false,
        currentFrameIndex: 0,
        currentTime: startTime,
        currentPositions:
          positionsData.data.frames.length > 0
            ? positionsData.data.frames[0].positions
            : [],
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  play: () => {
    set({ isPlaying: true });
  },

  pause: () => {
    set({ isPlaying: false });
  },

  setSpeed: (speed: PlaybackSpeed) => {
    set({ speed });
  },

  seekTo: (time: Date) => {
    const { frames, startTime, endTime } = get();

    if (!startTime || !endTime) return;

    // Clamp time to range
    const targetTime = Math.max(
      startTime.getTime(),
      Math.min(endTime.getTime(), time.getTime())
    );

    // Find the closest frame
    let frameIndex = 0;
    for (let i = 0; i < frames.length; i++) {
      if (frames[i].timestamp <= targetTime) {
        frameIndex = i;
      } else {
        break;
      }
    }

    set({
      currentTime: new Date(targetTime),
      currentFrameIndex: frameIndex,
      currentPositions: frames[frameIndex]?.positions || [],
    });
  },

  seekToFrame: (frameIndex: number) => {
    const { frames } = get();

    if (frameIndex < 0 || frameIndex >= frames.length) return;

    const frame = frames[frameIndex];

    set({
      currentFrameIndex: frameIndex,
      currentTime: new Date(frame.timestamp),
      currentPositions: frame.positions,
    });
  },

  setCurrentPositions: (positions: PlaybackPosition[]) => {
    set({ currentPositions: positions });
  },

  advanceFrame: () => {
    const { currentFrameIndex, frames } = get();
    const nextIndex = currentFrameIndex + 1;

    if (nextIndex >= frames.length) {
      // End of playback
      set({ isPlaying: false });
      return false;
    }

    const frame = frames[nextIndex];
    set({
      currentFrameIndex: nextIndex,
      currentTime: new Date(frame.timestamp),
      currentPositions: frame.positions,
    });

    return true;
  },

  reset: () => {
    const { startTime, frames } = get();

    set({
      isPlaying: false,
      currentFrameIndex: 0,
      currentTime: startTime,
      currentPositions: frames.length > 0 ? frames[0].positions : [],
    });
  },
}));
