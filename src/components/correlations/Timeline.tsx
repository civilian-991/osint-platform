'use client';

import { useMemo } from 'react';
import { format, startOfHour, addHours, isWithinInterval } from 'date-fns';
import type { CorrelationWithRelations } from '@/lib/types/correlation';
import { getConfidenceLevel } from '@/lib/types/correlation';
import { cn } from '@/lib/utils/cn';

interface TimelineProps {
  correlations: CorrelationWithRelations[];
  onCorrelationClick?: (correlation: CorrelationWithRelations) => void;
  selectedCorrelationId?: string;
  hours?: number;
}

export default function Timeline({
  correlations,
  onCorrelationClick,
  selectedCorrelationId,
  hours = 24,
}: TimelineProps) {
  const timeSlots = useMemo(() => {
    const now = new Date();
    const start = startOfHour(addHours(now, -hours));
    const slots: Array<{
      time: Date;
      label: string;
      correlations: CorrelationWithRelations[];
    }> = [];

    for (let i = 0; i <= hours; i++) {
      const slotTime = addHours(start, i);
      const slotEnd = addHours(slotTime, 1);

      const slotCorrelations = correlations.filter((c) => {
        const created = new Date(c.created_at);
        return isWithinInterval(created, { start: slotTime, end: slotEnd });
      });

      slots.push({
        time: slotTime,
        label: format(slotTime, 'HH:mm'),
        correlations: slotCorrelations,
      });
    }

    return slots;
  }, [correlations, hours]);

  const maxCorrelations = useMemo(() => {
    return Math.max(1, ...timeSlots.map((s) => s.correlations.length));
  }, [timeSlots]);

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="font-semibold mb-4">Correlation Timeline</h3>

      {/* Timeline */}
      <div className="relative">
        {/* Time labels */}
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>{format(timeSlots[0]?.time || new Date(), 'MMM d, HH:mm')}</span>
          <span>{format(timeSlots[timeSlots.length - 1]?.time || new Date(), 'MMM d, HH:mm')}</span>
        </div>

        {/* Bar chart */}
        <div className="flex items-end gap-px h-24 bg-muted/30 rounded">
          {timeSlots.map((slot, index) => {
            const height = slot.correlations.length
              ? (slot.correlations.length / maxCorrelations) * 100
              : 0;

            // Get highest confidence in this slot
            const highestConfidence = slot.correlations.reduce((max, c) => {
              return c.confidence_score > max ? c.confidence_score : max;
            }, 0);

            const level = getConfidenceLevel(highestConfidence);
            const color = {
              high: 'bg-green-500',
              medium: 'bg-yellow-500',
              low: 'bg-red-500',
            }[level];

            const hasSelected = slot.correlations.some(
              (c) => c.id === selectedCorrelationId
            );

            return (
              <div
                key={index}
                className="flex-1 relative group cursor-pointer"
                onClick={() => {
                  if (slot.correlations.length > 0) {
                    onCorrelationClick?.(slot.correlations[0]);
                  }
                }}
              >
                {/* Bar */}
                <div
                  className={cn(
                    'absolute bottom-0 left-0 right-0 rounded-t transition-all',
                    slot.correlations.length ? color : 'bg-transparent',
                    hasSelected && 'ring-2 ring-primary ring-offset-1'
                  )}
                  style={{ height: `${height}%` }}
                />

                {/* Tooltip */}
                {slot.correlations.length > 0 && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                    <div className="bg-popover text-popover-foreground text-xs rounded px-2 py-1 shadow-lg whitespace-nowrap">
                      <div className="font-medium">{slot.label}</div>
                      <div>{slot.correlations.length} correlation(s)</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Time markers */}
        <div className="flex justify-between mt-1">
          {[0, 6, 12, 18, 24].map((hourMark) => {
            const slotIndex = Math.round((hourMark / 24) * (timeSlots.length - 1));
            const slot = timeSlots[slotIndex];
            if (!slot) return null;

            return (
              <div key={hourMark} className="text-xs text-muted-foreground">
                {slot.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span>High</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-500" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span>Low</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
        <div className="text-center">
          <div className="text-2xl font-bold">{correlations.length}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-500">
            {correlations.filter((c) => getConfidenceLevel(c.confidence_score) === 'high').length}
          </div>
          <div className="text-xs text-muted-foreground">High Confidence</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-500">
            {correlations.filter((c) => c.status === 'pending').length}
          </div>
          <div className="text-xs text-muted-foreground">Pending Review</div>
        </div>
      </div>
    </div>
  );
}
