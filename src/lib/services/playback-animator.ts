/**
 * Playback Animator Service
 * Handles requestAnimationFrame loop for smooth aircraft playback
 */

import type { PlaybackSpeed, PlaybackPosition, PlaybackFrame } from '@/lib/stores/playback-store';
import { interpolateFrame } from './position-interpolator';

export interface AnimatorOptions {
  frames: PlaybackFrame[];
  speed: PlaybackSpeed;
  onPositionsUpdate: (positions: PlaybackPosition[], time: number) => void;
  onFrameChange: (frameIndex: number) => void;
  onPlaybackEnd: () => void;
}

export class PlaybackAnimator {
  private frames: PlaybackFrame[];
  private speed: PlaybackSpeed;
  private onPositionsUpdate: (positions: PlaybackPosition[], time: number) => void;
  private onFrameChange: (frameIndex: number) => void;
  private onPlaybackEnd: () => void;

  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private lastTickTime: number | null = null;

  private currentFrameIndex: number = 0;
  private currentTime: number = 0;
  private startTime: number = 0;
  private endTime: number = 0;

  // Interpolation settings
  private interpolationEnabled: boolean = true;
  private targetFps: number = 60;

  constructor(options: AnimatorOptions) {
    this.frames = options.frames;
    this.speed = options.speed;
    this.onPositionsUpdate = options.onPositionsUpdate;
    this.onFrameChange = options.onFrameChange;
    this.onPlaybackEnd = options.onPlaybackEnd;

    if (this.frames.length > 0) {
      this.startTime = this.frames[0].timestamp;
      this.endTime = this.frames[this.frames.length - 1].timestamp;
      this.currentTime = this.startTime;
    }
  }

  /**
   * Update options (used when speed changes or frames are updated)
   */
  updateOptions(options: Partial<AnimatorOptions>) {
    if (options.frames !== undefined) {
      this.frames = options.frames;
      if (this.frames.length > 0) {
        this.startTime = this.frames[0].timestamp;
        this.endTime = this.frames[this.frames.length - 1].timestamp;
      }
    }
    if (options.speed !== undefined) {
      this.speed = options.speed;
    }
    if (options.onPositionsUpdate !== undefined) {
      this.onPositionsUpdate = options.onPositionsUpdate;
    }
    if (options.onFrameChange !== undefined) {
      this.onFrameChange = options.onFrameChange;
    }
    if (options.onPlaybackEnd !== undefined) {
      this.onPlaybackEnd = options.onPlaybackEnd;
    }
  }

  /**
   * Set current playback position
   */
  seekTo(time: number) {
    this.currentTime = Math.max(this.startTime, Math.min(this.endTime, time));
    this.currentFrameIndex = this.findFrameIndex(this.currentTime);
    this.updatePositions();
  }

  /**
   * Set current frame index
   */
  seekToFrame(frameIndex: number) {
    if (frameIndex >= 0 && frameIndex < this.frames.length) {
      this.currentFrameIndex = frameIndex;
      this.currentTime = this.frames[frameIndex].timestamp;
      this.updatePositions();
    }
  }

  /**
   * Enable or disable interpolation
   */
  setInterpolation(enabled: boolean) {
    this.interpolationEnabled = enabled;
  }

  /**
   * Start playback
   */
  start() {
    if (this.isRunning || this.frames.length === 0) return;

    this.isRunning = true;
    this.lastTickTime = performance.now();
    this.tick();
  }

  /**
   * Stop playback
   */
  stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.lastTickTime = null;
  }

  /**
   * Reset to beginning
   */
  reset() {
    this.stop();
    this.currentFrameIndex = 0;
    if (this.frames.length > 0) {
      this.currentTime = this.frames[0].timestamp;
      this.updatePositions();
    }
  }

  /**
   * Get current state
   */
  getState() {
    return {
      isRunning: this.isRunning,
      currentFrameIndex: this.currentFrameIndex,
      currentTime: this.currentTime,
      progress: this.getProgress(),
    };
  }

  /**
   * Get playback progress (0-1)
   */
  getProgress(): number {
    if (this.endTime === this.startTime) return 0;
    return (this.currentTime - this.startTime) / (this.endTime - this.startTime);
  }

  /**
   * Main animation tick
   */
  private tick = () => {
    if (!this.isRunning) return;

    const now = performance.now();
    const elapsed = this.lastTickTime ? now - this.lastTickTime : 0;
    this.lastTickTime = now;

    // Calculate how much simulated time has passed based on speed
    // Speed 1 = real-time, Speed 2 = 2x faster, etc.
    const simulatedElapsed = elapsed * this.speed;

    // Advance current time
    this.currentTime += simulatedElapsed;

    // Check if we've reached the end
    if (this.currentTime >= this.endTime) {
      this.currentTime = this.endTime;
      this.currentFrameIndex = this.frames.length - 1;
      this.updatePositions();
      this.stop();
      this.onPlaybackEnd();
      return;
    }

    // Find the current frame
    const newFrameIndex = this.findFrameIndex(this.currentTime);
    if (newFrameIndex !== this.currentFrameIndex) {
      this.currentFrameIndex = newFrameIndex;
      this.onFrameChange(this.currentFrameIndex);
    }

    // Update positions (with interpolation if enabled)
    this.updatePositions();

    // Schedule next tick
    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  /**
   * Find the frame index for a given time
   */
  private findFrameIndex(time: number): number {
    // Binary search for the frame
    let low = 0;
    let high = this.frames.length - 1;

    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      if (this.frames[mid].timestamp <= time) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    return low;
  }

  /**
   * Update positions for the current time
   */
  private updatePositions() {
    if (this.frames.length === 0) return;

    let positions: PlaybackPosition[];

    if (this.interpolationEnabled && this.currentFrameIndex < this.frames.length - 1) {
      // Interpolate between current and next frame
      const frame1 = this.frames[this.currentFrameIndex];
      const frame2 = this.frames[this.currentFrameIndex + 1];
      positions = interpolateFrame(frame1, frame2, this.currentTime);
    } else {
      // Use the current frame directly
      positions = this.frames[this.currentFrameIndex].positions;
    }

    this.onPositionsUpdate(positions, this.currentTime);
  }
}

/**
 * Create a playback animator instance
 */
export function createPlaybackAnimator(options: AnimatorOptions): PlaybackAnimator {
  return new PlaybackAnimator(options);
}
