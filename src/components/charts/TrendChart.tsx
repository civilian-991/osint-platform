'use client';

import { FC, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { TrendData, TrendDataPoint } from '@/lib/types/dashboard';
import { METRIC_LABELS, getTrendColor, formatTrendPercent } from '@/lib/types/dashboard';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrendChartProps {
  data: TrendData;
  width?: number;
  height?: number;
  showLabels?: boolean;
  showLegend?: boolean;
  className?: string;
}

const TrendChart: FC<TrendChartProps> = ({
  data,
  width = 400,
  height = 200,
  showLabels = true,
  showLegend = true,
  className,
}) => {
  const padding = { top: 20, right: 20, bottom: showLabels ? 40 : 20, left: showLabels ? 60 : 20 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const { path, points, yTicks, xTicks } = useMemo(() => {
    const dataPoints = data.data_points;
    if (dataPoints.length < 2) {
      return { path: '', points: [], yTicks: [], xTicks: [] };
    }

    const values = dataPoints.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = dataPoints.map((d, index) => {
      const x = (index / (dataPoints.length - 1)) * chartWidth + padding.left;
      const y = chartHeight - ((d.value - min) / range) * chartHeight + padding.top;
      return { x, y, value: d.value, timestamp: d.timestamp };
    });

    // Create path
    let pathData = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathData += ` L ${points[i].x} ${points[i].y}`;
    }

    // Y-axis ticks
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      y: chartHeight * (1 - ratio) + padding.top,
      value: min + range * ratio,
    }));

    // X-axis ticks (first, middle, last)
    const xTicks = [0, Math.floor(dataPoints.length / 2), dataPoints.length - 1]
      .filter((i, idx, arr) => i >= 0 && i < dataPoints.length && arr.indexOf(i) === idx)
      .map((i) => ({
        x: points[i].x,
        label: formatDate(dataPoints[i].timestamp),
      }));

    return { path: pathData, points, yTicks, xTicks };
  }, [data.data_points, chartWidth, chartHeight, padding]);

  const color = getTrendColor(data.change_direction, true);

  const TrendIcon = data.change_direction === 'up' ? TrendingUp :
                    data.change_direction === 'down' ? TrendingDown : Minus;

  if (data.data_points.length < 2) {
    return (
      <div className={cn('flex items-center justify-center text-muted-foreground', className)} style={{ width, height }}>
        Not enough data
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {showLegend && (
        <div className="flex items-center justify-between mb-2 px-2">
          <div>
            <span className="text-sm font-medium">
              {METRIC_LABELS[data.metric] || data.metric}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{formatValue(data.current_value)}</span>
            <div className="flex items-center gap-1" style={{ color }}>
              <TrendIcon className="h-4 w-4" />
              <span className="text-sm">{formatTrendPercent(data.change_percent)}</span>
            </div>
          </div>
        </div>
      )}

      <svg width={width} height={height} className="overflow-visible">
        {/* Grid lines */}
        {showLabels && yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={tick.y}
              x2={width - padding.right}
              y2={tick.y}
              stroke="currentColor"
              strokeOpacity={0.1}
            />
            <text
              x={padding.left - 8}
              y={tick.y}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-xs fill-muted-foreground"
            >
              {formatValue(tick.value)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {showLabels && xTicks.map((tick, i) => (
          <text
            key={i}
            x={tick.x}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            className="text-xs fill-muted-foreground"
          >
            {tick.label}
          </text>
        ))}

        {/* Area fill */}
        <path
          d={`${path} L ${points[points.length - 1].x} ${chartHeight + padding.top} L ${points[0].x} ${chartHeight + padding.top} Z`}
          fill={color}
          fillOpacity={0.1}
        />

        {/* Line */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={3}
            fill="white"
            stroke={color}
            strokeWidth={2}
            className="opacity-0 hover:opacity-100 transition-opacity"
          />
        ))}

        {/* End point */}
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={4}
          fill={color}
        />
      </svg>
    </div>
  );
};

function formatValue(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default TrendChart;
