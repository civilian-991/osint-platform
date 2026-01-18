'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import type { TimeRange } from '@/lib/stores/playback-store';
import { cn } from '@/lib/utils/cn';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange, customStart?: Date, customEnd?: Date) => void;
  startTime: Date | null;
  endTime: Date | null;
}

const PRESET_RANGES: { value: TimeRange; label: string }[] = [
  { value: '1h', label: 'Last 1 hour' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '12h', label: 'Last 12 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: 'custom', label: 'Custom range' },
];

export default function TimeRangeSelector({
  value,
  onChange,
  startTime,
  endTime,
}: TimeRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowCustomPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRangeSelect = (range: TimeRange) => {
    if (range === 'custom') {
      setShowCustomPicker(true);
    } else {
      onChange(range);
      setIsOpen(false);
      setShowCustomPicker(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const start = new Date(customStart);
    const end = new Date(customEnd);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return;
    }

    if (start >= end) {
      return;
    }

    onChange('custom', start, end);
    setIsOpen(false);
    setShowCustomPicker(false);
  };

  const getCurrentLabel = () => {
    const preset = PRESET_RANGES.find((r) => r.value === value);
    return preset?.label || 'Select range';
  };

  // Format datetime for input
  const formatDateTimeLocal = (date: Date | null) => {
    if (!date) return '';
    return date.toISOString().slice(0, 16);
  };

  // Initialize custom inputs from current range
  useEffect(() => {
    if (startTime && endTime) {
      setCustomStart(formatDateTimeLocal(startTime));
      setCustomEnd(formatDateTimeLocal(endTime));
    }
  }, [startTime, endTime]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm',
          'bg-muted hover:bg-muted/80 transition-colors',
          isOpen && 'bg-muted/80'
        )}
      >
        <Calendar className="h-4 w-4" />
        <span>{getCurrentLabel()}</span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50 min-w-48">
          {/* Preset ranges */}
          {!showCustomPicker && (
            <div className="py-1">
              {PRESET_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => handleRangeSelect(range.value)}
                  className={cn(
                    'w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors',
                    range.value === value && 'bg-primary/10 text-primary font-medium'
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
          )}

          {/* Custom range picker */}
          {showCustomPicker && (
            <form onSubmit={handleCustomSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">End Time</label>
                <input
                  type="datetime-local"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomPicker(false)}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
                >
                  Apply
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
