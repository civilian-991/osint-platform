export interface Watchlist {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WatchlistWithItems extends Watchlist {
  items: WatchlistItem[];
}

export interface WatchlistItem {
  id: string;
  watchlist_id: string;
  match_type: WatchlistMatchType;
  match_value: string;
  priority: WatchlistPriority;
  notes: string | null;
  alert_on_detection: boolean;
  created_at: string;
}

export type WatchlistMatchType =
  | 'icao_hex'
  | 'registration'
  | 'callsign_pattern'
  | 'type_code';

export type WatchlistPriority =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export interface WatchlistMatch {
  watchlist_id: string;
  watchlist_name: string;
  item_id: string;
  match_type: WatchlistMatchType;
  match_value: string;
  priority: WatchlistPriority;
  notes: string | null;
  user_id: string;
}

export interface CreateWatchlistInput {
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateWatchlistInput {
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface CreateWatchlistItemInput {
  match_type: WatchlistMatchType;
  match_value: string;
  priority?: WatchlistPriority;
  notes?: string;
  alert_on_detection?: boolean;
}

export interface UpdateWatchlistItemInput {
  match_type?: WatchlistMatchType;
  match_value?: string;
  priority?: WatchlistPriority;
  notes?: string;
  alert_on_detection?: boolean;
}

export const MATCH_TYPE_LABELS: Record<WatchlistMatchType, string> = {
  icao_hex: 'ICAO Hex Code',
  registration: 'Registration',
  callsign_pattern: 'Callsign Pattern',
  type_code: 'Aircraft Type',
};

export const PRIORITY_LABELS: Record<WatchlistPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const PRIORITY_COLORS: Record<WatchlistPriority, string> = {
  low: 'bg-gray-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

export function getPriorityBadgeClass(priority: WatchlistPriority): string {
  const colors: Record<WatchlistPriority, string> = {
    low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return colors[priority];
}
