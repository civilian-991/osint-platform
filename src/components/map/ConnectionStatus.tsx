'use client';

import { Wifi, WifiOff, RefreshCw, Loader2 } from 'lucide-react';
import type { SSEConnectionStatus } from '@/hooks/useSSEPositions';
import { cn } from '@/lib/utils/cn';
import { formatDistanceToNow } from 'date-fns';

interface ConnectionStatusProps {
  status: SSEConnectionStatus;
  lastUpdate: Date | null;
  onReconnect?: () => void;
  className?: string;
}

const STATUS_CONFIG: Record<SSEConnectionStatus, { icon: typeof Wifi; color: string; label: string; animate?: boolean }> = {
  connected: { icon: Wifi, color: 'text-green-500', label: 'Live' },
  connecting: { icon: Loader2, color: 'text-yellow-500', label: 'Connecting', animate: true },
  disconnected: { icon: WifiOff, color: 'text-gray-500', label: 'Disconnected' },
  error: { icon: WifiOff, color: 'text-red-500', label: 'Error' },
  polling: { icon: RefreshCw, color: 'text-blue-500', label: 'Polling' },
};

export default function ConnectionStatus({
  status,
  lastUpdate,
  onReconnect,
  className,
}: ConnectionStatusProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 bg-card/80 backdrop-blur-sm border border-border rounded-full text-sm',
        className
      )}
    >
      <Icon
        className={cn('h-4 w-4', config.color, config.animate && 'animate-spin')}
      />
      <span className={config.color}>{config.label}</span>

      {lastUpdate && (
        <span className="text-muted-foreground text-xs">
          · {formatDistanceToNow(lastUpdate, { addSuffix: true })}
        </span>
      )}

      {(status === 'disconnected' || status === 'error') && onReconnect && (
        <button
          onClick={onReconnect}
          className="ml-1 p-1 hover:bg-muted rounded transition-colors"
          title="Reconnect"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
