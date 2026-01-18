'use client';

import { useState, useRef, useEffect } from 'react';
import { Gauge } from 'lucide-react';
import type { PlaybackSpeed } from '@/lib/stores/playback-store';
import { cn } from '@/lib/utils/cn';

interface SpeedControlProps {
  value: PlaybackSpeed;
  onChange: (speed: PlaybackSpeed) => void;
  disabled?: boolean;
}

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2, 4, 8];

export default function SpeedControl({
  value,
  onChange,
  disabled = false,
}: SpeedControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const formatSpeed = (speed: PlaybackSpeed) => {
    return speed === 1 ? '1x' : `${speed}x`;
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-sm',
          'hover:bg-muted transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isOpen && 'bg-muted'
        )}
      >
        <Gauge className="h-4 w-4" />
        <span className="font-medium">{formatSpeed(value)}</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              onClick={() => {
                onChange(speed);
                setIsOpen(false);
              }}
              className={cn(
                'w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors',
                speed === value && 'bg-primary/10 text-primary font-medium'
              )}
            >
              {formatSpeed(speed)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
