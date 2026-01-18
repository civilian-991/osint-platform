export interface UserPreferences {
  id: string;
  user_id: string;
  email_notifications: boolean;
  email_frequency: EmailFrequency;
  notification_types: NotificationType[];
  min_confidence_threshold: number;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export type EmailFrequency = 'immediate' | 'hourly' | 'daily' | 'weekly';

export type NotificationType =
  | 'high_confidence_match'
  | 'watchlist_aircraft'
  | 'new_correlation'
  | 'unusual_pattern'
  | 'breaking_news'
  | 'region_activity'
  | 'daily_digest'
  | 'weekly_digest';

export interface EmailQueueItem {
  id: string;
  user_id: string;
  alert_id: string | null;
  email_type: string;
  subject: string;
  recipient: string;
  content: EmailContent;
  status: EmailStatus;
  attempts: number;
  last_attempt_at: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export type EmailStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

export interface EmailContent {
  title: string;
  body: string;
  alertData?: Record<string, unknown>;
  ctaUrl?: string;
  ctaText?: string;
}

export interface UpdatePreferencesInput {
  email_notifications?: boolean;
  email_frequency?: EmailFrequency;
  notification_types?: NotificationType[];
  min_confidence_threshold?: number;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  timezone?: string;
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  high_confidence_match: 'High Confidence Correlations',
  watchlist_aircraft: 'Watchlist Aircraft Detections',
  new_correlation: 'All New Correlations',
  unusual_pattern: 'Unusual Flight Patterns',
  breaking_news: 'Breaking News Events',
  region_activity: 'Region of Interest Activity',
  daily_digest: 'Daily Summary',
  weekly_digest: 'Weekly Summary',
};

export const NOTIFICATION_TYPE_DESCRIPTIONS: Record<NotificationType, string> = {
  high_confidence_match: 'Get notified when correlations exceed your confidence threshold',
  watchlist_aircraft: 'Get notified when aircraft on your watchlists are detected',
  new_correlation: 'Get notified for every new news-flight correlation',
  unusual_pattern: 'Get notified when unusual flight patterns are detected',
  breaking_news: 'Get notified about breaking military aviation news',
  region_activity: 'Get notified about activity in your regions of interest',
  daily_digest: 'Receive a daily summary of platform activity',
  weekly_digest: 'Receive a weekly summary of platform activity',
};

export const EMAIL_FREQUENCY_LABELS: Record<EmailFrequency, string> = {
  immediate: 'Immediately',
  hourly: 'Hourly Digest',
  daily: 'Daily Digest',
  weekly: 'Weekly Digest',
};

export const DEFAULT_PREFERENCES: Omit<UserPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  email_notifications: true,
  email_frequency: 'immediate',
  notification_types: ['high_confidence_match', 'watchlist_aircraft'],
  min_confidence_threshold: 0.70,
  quiet_hours_start: null,
  quiet_hours_end: null,
  timezone: 'UTC',
};
