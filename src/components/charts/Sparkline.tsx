'use client';

import { FC, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  color?: string;
  fillOpacity?: number;
  showArea?: boolean;
  className?: string;
}

const Sparkline: FC<SparklineProps> = ({
  data,
  width = 100,
  height = 30,
  strokeWidth = 1.5,
  color = '#3b82f6',
  fillOpacity = 0.1,
  showArea = true,
  className,
}) => {
  const path = useMemo(() => {
    if (data.length < 2) return '';

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2; // 2px padding
      return { x, y };
    });

    // Create line path
    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      linePath += ` L ${points[i].x} ${points[i].y}`;
    }

    return linePath;
  }, [data, width, height]);

  const areaPath = useMemo(() => {
    if (data.length < 2 || !showArea) return '';

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return { x, y };
    });

    let areaPath = `M ${points[0].x} ${height}`;
    areaPath += ` L ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      areaPath += ` L ${points[i].x} ${points[i].y}`;
    }
    areaPath += ` L ${points[points.length - 1].x} ${height}`;
    areaPath += ' Z';

    return areaPath;
  }, [data, width, height, showArea]);

  if (data.length < 2) {
    return (
      <div
        className={cn('flex items-center justify-center text-xs text-muted-foreground', className)}
        style={{ width, height }}
      >
        No data
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
    >
      {showArea && (
        <path
          d={areaPath}
          fill={color}
          fillOpacity={fillOpacity}
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={width}
        cy={height - ((data[data.length - 1] - Math.min(...data)) / (Math.max(...data) - Math.min(...data) || 1)) * (height - 4) - 2}
        r={2}
        fill={color}
      />
    </svg>
  );
};

export default Sparkline;

// Sparkline with label
interface SparklineWithLabelProps extends SparklineProps {
  label: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
}

export const SparklineWithLabel: FC<SparklineWithLabelProps> = ({
  label,
  value,
  change,
  changeLabel,
  ...sparklineProps
}) => {
  const changeColor = change && change > 0 ? 'text-green-500' : change && change < 0 ? 'text-red-500' : 'text-muted-foreground';
  const changeSign = change && change > 0 ? '+' : '';

  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-card border">
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
        {change !== undefined && (
          <p className={cn('text-xs', changeColor)}>
            {changeSign}{change.toFixed(1)}%{changeLabel && ` ${changeLabel}`}
          </p>
        )}
      </div>
      <Sparkline {...sparklineProps} />
    </div>
  );
};
