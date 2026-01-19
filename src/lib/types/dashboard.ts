// Dashboard & UX Types
// Saved searches, layouts, widgets, and trend data

// ============================================
// SAVED SEARCHES
// ============================================

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  // Filter criteria
  filters: SearchFilters;
  // Display options
  sort_by: string | null;
  sort_order: 'asc' | 'desc';
  view_mode: ViewMode;
  // Usage tracking
  use_count: number;
  last_used_at: string | null;
  // Sharing
  is_shared: boolean;
  shared_with: string[];
  // Organization
  folder: string | null;
  color: string | null;
  icon: string | null;
  position: number;
  // Status
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface SearchFilters {
  // Aircraft filters
  aircraft_types?: string[];
  military_categories?: string[];
  operators?: string[];
  icao_hexes?: string[];
  callsign_pattern?: string;
  registration_pattern?: string;
  // Status filters
  threat_levels?: string[];
  in_formation?: boolean;
  has_anomaly?: boolean;
  is_military?: boolean;
  // Geographic filters
  regions?: string[];
  countries?: string[];
  bounding_box?: BoundingBox;
  near_infrastructure?: string[];
  in_airspace?: string[];
  // Time filters
  time_range?: TimeRange;
  active_within_hours?: number;
  // Metric filters
  min_altitude?: number;
  max_altitude?: number;
  min_speed?: number;
  max_speed?: number;
  min_threat_score?: number;
  // Custom filters
  custom?: Record<string, unknown>;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface TimeRange {
  start: string;
  end: string;
}

export type ViewMode = 'list' | 'map' | 'grid' | 'table';

export interface SavedSearchInput {
  name: string;
  description?: string;
  filters: SearchFilters;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  view_mode?: ViewMode;
  folder?: string;
  color?: string;
  icon?: string;
  is_pinned?: boolean;
}

// ============================================
// DASHBOARD LAYOUTS
// ============================================

export interface DashboardLayout {
  id: string;
  user_id: string;
  name: string;
  // Layout definition
  layout: WidgetLayout[];
  // Grid settings
  grid_columns: number;
  row_height: number;
  // Status
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface WidgetLayout {
  widget_id: string;
  widget_type: WidgetType;
  // Grid position (using react-grid-layout convention)
  x: number;
  y: number;
  w: number;
  h: number;
  // Widget-specific config
  config: WidgetConfig;
  // Visual
  title?: string;
  collapsed?: boolean;
}

export type WidgetType =
  | 'aircraft_list'
  | 'aircraft_map'
  | 'threat_summary'
  | 'formation_list'
  | 'alert_feed'
  | 'trend_chart'
  | 'sparkline_grid'
  | 'network_graph'
  | 'activity_heatmap'
  | 'operator_summary'
  | 'quick_filters'
  | 'saved_searches'
  | 'recent_activity'
  | 'stats_cards'
  | 'custom';

export interface WidgetConfig {
  // Data source
  data_source?: string;
  filters?: SearchFilters;
  refresh_interval_ms?: number;
  // Display options
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  show_header?: boolean;
  show_footer?: boolean;
  // Chart-specific
  chart_type?: 'line' | 'bar' | 'area' | 'pie';
  metrics?: string[];
  time_range?: string; // '24h', '7d', '30d', etc.
  // Custom
  custom?: Record<string, unknown>;
}

export interface DashboardLayoutInput {
  name: string;
  layout: WidgetLayout[];
  grid_columns?: number;
  row_height?: number;
  is_default?: boolean;
}

// ============================================
// QUICK FILTERS
// ============================================

export interface QuickFilterPreset {
  id: string;
  user_id: string | null; // null = system preset
  name: string;
  category: FilterCategory;
  filters: SearchFilters;
  // Display
  label: string;
  icon: string | null;
  color: string | null;
  position: number;
  // Status
  is_active: boolean;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export type FilterCategory =
  | 'aircraft_type'
  | 'region'
  | 'threat_level'
  | 'operator'
  | 'status'
  | 'custom';

export interface QuickFilterPresetInput {
  name: string;
  category: FilterCategory;
  filters: SearchFilters;
  label: string;
  icon?: string;
  color?: string;
  position?: number;
}

// ============================================
// ACTIVITY METRICS & TRENDS
// ============================================

export interface ActivityMetrics {
  id: string;
  metric_date: string;
  // Scope
  scope_type: MetricScope;
  scope_value: string | null;
  // Aircraft metrics
  total_aircraft: number;
  unique_aircraft: number;
  military_aircraft: number;
  civilian_aircraft: number;
  // Flight metrics
  total_flights: number;
  total_flight_hours: number;
  avg_flight_duration_minutes: number | null;
  // Activity metrics
  formations_detected: number;
  anomalies_detected: number;
  alerts_generated: number;
  // Threat metrics
  high_threat_events: number;
  avg_threat_score: number | null;
  max_threat_score: number | null;
  // Position metrics
  total_positions: number;
  positions_per_aircraft: number | null;
  // Breakdowns
  aircraft_type_breakdown: Record<string, number>;
  formation_type_breakdown: Record<string, number>;
  intent_breakdown: Record<string, number>;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export type MetricScope = 'global' | 'region' | 'operator';

export interface TrendData {
  metric: string;
  period: TrendPeriod;
  data_points: TrendDataPoint[];
  // Summary stats
  current_value: number;
  previous_value: number;
  change_percent: number;
  change_direction: 'up' | 'down' | 'flat';
  // Trend analysis
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  min_value: number;
  max_value: number;
  avg_value: number;
}

export interface TrendDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export type TrendPeriod = '24h' | '7d' | '30d' | '90d' | '1y';

export interface TrendRequest {
  metrics: string[];
  period: TrendPeriod;
  scope?: MetricScope;
  scope_value?: string;
}

// ============================================
// WIDGET REGISTRY
// ============================================

export interface WidgetDefinition {
  type: WidgetType;
  name: string;
  description: string;
  icon: string;
  // Size constraints
  min_width: number;
  min_height: number;
  default_width: number;
  default_height: number;
  max_width?: number;
  max_height?: number;
  // Capabilities
  supports_filters: boolean;
  supports_refresh: boolean;
  supports_export: boolean;
  // Default config
  default_config: WidgetConfig;
}

export const WIDGET_DEFINITIONS: Record<WidgetType, WidgetDefinition> = {
  aircraft_list: {
    type: 'aircraft_list',
    name: 'Aircraft List',
    description: 'Scrollable list of tracked aircraft',
    icon: 'List',
    min_width: 3,
    min_height: 4,
    default_width: 4,
    default_height: 8,
    supports_filters: true,
    supports_refresh: true,
    supports_export: true,
    default_config: { limit: 20, sort_by: 'last_seen', sort_order: 'desc' },
  },
  aircraft_map: {
    type: 'aircraft_map',
    name: 'Aircraft Map',
    description: 'Interactive map with aircraft positions',
    icon: 'Map',
    min_width: 4,
    min_height: 4,
    default_width: 8,
    default_height: 8,
    supports_filters: true,
    supports_refresh: true,
    supports_export: false,
    default_config: {},
  },
  threat_summary: {
    type: 'threat_summary',
    name: 'Threat Summary',
    description: 'Overview of current threat levels',
    icon: 'ShieldAlert',
    min_width: 2,
    min_height: 2,
    default_width: 3,
    default_height: 4,
    supports_filters: false,
    supports_refresh: true,
    supports_export: false,
    default_config: {},
  },
  formation_list: {
    type: 'formation_list',
    name: 'Active Formations',
    description: 'List of detected formations',
    icon: 'Users',
    min_width: 3,
    min_height: 3,
    default_width: 4,
    default_height: 6,
    supports_filters: true,
    supports_refresh: true,
    supports_export: true,
    default_config: { limit: 10 },
  },
  alert_feed: {
    type: 'alert_feed',
    name: 'Alert Feed',
    description: 'Real-time alert stream',
    icon: 'Bell',
    min_width: 3,
    min_height: 4,
    default_width: 4,
    default_height: 8,
    supports_filters: true,
    supports_refresh: true,
    supports_export: false,
    default_config: { limit: 50 },
  },
  trend_chart: {
    type: 'trend_chart',
    name: 'Trend Chart',
    description: 'Time-series trend visualization',
    icon: 'TrendingUp',
    min_width: 4,
    min_height: 3,
    default_width: 6,
    default_height: 4,
    supports_filters: true,
    supports_refresh: true,
    supports_export: true,
    default_config: {
      chart_type: 'line',
      metrics: ['total_aircraft'],
      time_range: '7d',
    },
  },
  sparkline_grid: {
    type: 'sparkline_grid',
    name: 'Sparkline Grid',
    description: 'Compact metric sparklines',
    icon: 'Activity',
    min_width: 2,
    min_height: 2,
    default_width: 4,
    default_height: 3,
    supports_filters: false,
    supports_refresh: true,
    supports_export: false,
    default_config: {
      metrics: ['total_aircraft', 'formations_detected', 'anomalies_detected'],
    },
  },
  network_graph: {
    type: 'network_graph',
    name: 'Network Graph',
    description: 'Aircraft relationship network',
    icon: 'Network',
    min_width: 4,
    min_height: 4,
    default_width: 6,
    default_height: 6,
    supports_filters: true,
    supports_refresh: true,
    supports_export: true,
    default_config: {},
  },
  activity_heatmap: {
    type: 'activity_heatmap',
    name: 'Activity Heatmap',
    description: 'Geographic activity density',
    icon: 'Flame',
    min_width: 4,
    min_height: 4,
    default_width: 6,
    default_height: 5,
    supports_filters: true,
    supports_refresh: true,
    supports_export: false,
    default_config: { time_range: '24h' },
  },
  operator_summary: {
    type: 'operator_summary',
    name: 'Operator Summary',
    description: 'Breakdown by operator',
    icon: 'Building',
    min_width: 2,
    min_height: 3,
    default_width: 3,
    default_height: 4,
    supports_filters: false,
    supports_refresh: true,
    supports_export: true,
    default_config: { limit: 10 },
  },
  quick_filters: {
    type: 'quick_filters',
    name: 'Quick Filters',
    description: 'One-click filter presets',
    icon: 'Filter',
    min_width: 2,
    min_height: 1,
    default_width: 4,
    default_height: 2,
    supports_filters: false,
    supports_refresh: false,
    supports_export: false,
    default_config: {},
  },
  saved_searches: {
    type: 'saved_searches',
    name: 'Saved Searches',
    description: 'Your saved search presets',
    icon: 'Bookmark',
    min_width: 2,
    min_height: 2,
    default_width: 3,
    default_height: 4,
    supports_filters: false,
    supports_refresh: false,
    supports_export: false,
    default_config: {},
  },
  recent_activity: {
    type: 'recent_activity',
    name: 'Recent Activity',
    description: 'Latest events and updates',
    icon: 'Clock',
    min_width: 2,
    min_height: 3,
    default_width: 3,
    default_height: 5,
    supports_filters: false,
    supports_refresh: true,
    supports_export: false,
    default_config: { limit: 20 },
  },
  stats_cards: {
    type: 'stats_cards',
    name: 'Stats Cards',
    description: 'Key metric cards',
    icon: 'BarChart',
    min_width: 4,
    min_height: 1,
    default_width: 12,
    default_height: 2,
    supports_filters: false,
    supports_refresh: true,
    supports_export: false,
    default_config: {},
  },
  custom: {
    type: 'custom',
    name: 'Custom Widget',
    description: 'User-defined widget',
    icon: 'Settings',
    min_width: 1,
    min_height: 1,
    default_width: 4,
    default_height: 4,
    supports_filters: true,
    supports_refresh: true,
    supports_export: false,
    default_config: {},
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getTrendDirection(changePercent: number): 'up' | 'down' | 'flat' {
  if (changePercent > 1) return 'up';
  if (changePercent < -1) return 'down';
  return 'flat';
}

export function getTrendColor(direction: 'up' | 'down' | 'flat', positive: boolean = true): string {
  if (direction === 'flat') return '#6b7280';
  if (direction === 'up') return positive ? '#16a34a' : '#dc2626';
  return positive ? '#dc2626' : '#16a34a';
}

export function formatTrendPercent(percent: number): string {
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(1)}%`;
}

export function getDefaultLayout(): WidgetLayout[] {
  return [
    { widget_id: 'stats', widget_type: 'stats_cards', x: 0, y: 0, w: 12, h: 2, config: {} },
    { widget_id: 'map', widget_type: 'aircraft_map', x: 0, y: 2, w: 8, h: 8, config: {} },
    { widget_id: 'alerts', widget_type: 'alert_feed', x: 8, y: 2, w: 4, h: 4, config: { limit: 20 } },
    { widget_id: 'formations', widget_type: 'formation_list', x: 8, y: 6, w: 4, h: 4, config: { limit: 10 } },
    { widget_id: 'trends', widget_type: 'sparkline_grid', x: 0, y: 10, w: 6, h: 3, config: {} },
    { widget_id: 'quick', widget_type: 'quick_filters', x: 6, y: 10, w: 6, h: 3, config: {} },
  ];
}

// Period to days mapping
export const PERIOD_DAYS: Record<TrendPeriod, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

// Metric display names
export const METRIC_LABELS: Record<string, string> = {
  total_aircraft: 'Total Aircraft',
  unique_aircraft: 'Unique Aircraft',
  military_aircraft: 'Military Aircraft',
  civilian_aircraft: 'Civilian Aircraft',
  total_flights: 'Total Flights',
  total_flight_hours: 'Flight Hours',
  formations_detected: 'Formations',
  anomalies_detected: 'Anomalies',
  alerts_generated: 'Alerts',
  high_threat_events: 'High Threat Events',
  avg_threat_score: 'Avg Threat Score',
  total_positions: 'Positions',
};
