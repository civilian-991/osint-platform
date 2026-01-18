'use client';

import { useState, useEffect } from 'react';
import { Bell, Mail, Clock, AlertCircle, Loader2, Check } from 'lucide-react';
import type {
  UserPreferences,
  NotificationType,
  EmailFrequency,
  UpdatePreferencesInput,
} from '@/lib/types/preferences';
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_DESCRIPTIONS,
  EMAIL_FREQUENCY_LABELS,
  DEFAULT_PREFERENCES,
} from '@/lib/types/preferences';
import { cn } from '@/lib/utils/cn';

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState<Partial<UserPreferences>>({
    ...DEFAULT_PREFERENCES,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/preferences');
      const result = await response.json();

      if (result.success) {
        setPreferences(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (updates: UpdatePreferencesInput) => {
    try {
      setSaving(true);
      setError(null);
      setSaved(false);

      const response = await fetch('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const result = await response.json();

      if (result.success) {
        setPreferences(result.data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        throw new Error(result.error || 'Failed to update preferences');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleNotificationType = (type: NotificationType) => {
    const currentTypes = preferences.notification_types || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    updatePreferences({ notification_types: newTypes });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Email Notifications Toggle */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Email Notifications</h3>
            <p className="text-sm text-muted-foreground">
              Receive email alerts for important events
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.email_notifications}
            onChange={(e) => updatePreferences({ email_notifications: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {preferences.email_notifications && (
        <>
          {/* Email Frequency */}
          <div>
            <label className="block text-sm font-medium mb-2">Email Frequency</label>
            <select
              value={preferences.email_frequency}
              onChange={(e) => updatePreferences({ email_frequency: e.target.value as EmailFrequency })}
              className="w-full max-w-xs px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {(Object.keys(EMAIL_FREQUENCY_LABELS) as EmailFrequency[]).map((freq) => (
                <option key={freq} value={freq}>
                  {EMAIL_FREQUENCY_LABELS[freq]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              {preferences.email_frequency === 'immediate'
                ? 'Receive notifications as they happen'
                : `Receive a ${preferences.email_frequency} digest of all notifications`}
            </p>
          </div>

          {/* Notification Types */}
          <div>
            <label className="block text-sm font-medium mb-3">Notification Types</label>
            <div className="space-y-3">
              {(Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[]).map((type) => (
                <label
                  key={type}
                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={preferences.notification_types?.includes(type)}
                    onChange={() => toggleNotificationType(type)}
                    className="h-5 w-5 mt-0.5 rounded border-border text-primary focus:ring-primary"
                  />
                  <div>
                    <div className="font-medium text-sm">{NOTIFICATION_TYPE_LABELS[type]}</div>
                    <div className="text-xs text-muted-foreground">
                      {NOTIFICATION_TYPE_DESCRIPTIONS[type]}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Confidence Threshold */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Minimum Confidence Threshold
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={(preferences.min_confidence_threshold || 0.7) * 100}
                onChange={(e) =>
                  updatePreferences({ min_confidence_threshold: parseInt(e.target.value) / 100 })
                }
                className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm font-mono w-12 text-right">
                {Math.round((preferences.min_confidence_threshold || 0.7) * 100)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Only receive alerts for correlations above this confidence level
            </p>
          </div>

          {/* Quiet Hours */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium">Quiet Hours (Optional)</label>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Start</label>
                <input
                  type="time"
                  value={preferences.quiet_hours_start || ''}
                  onChange={(e) =>
                    updatePreferences({ quiet_hours_start: e.target.value || null })
                  }
                  className="px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <span className="text-muted-foreground mt-4">to</span>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">End</label>
                <input
                  type="time"
                  value={preferences.quiet_hours_end || ''}
                  onChange={(e) =>
                    updatePreferences({ quiet_hours_end: e.target.value || null })
                  }
                  className="px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              No email notifications will be sent during quiet hours
            </p>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium mb-2">Timezone</label>
            <select
              value={preferences.timezone}
              onChange={(e) => updatePreferences({ timezone: e.target.value })}
              className="w-full max-w-xs px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="Europe/London">London (GMT/BST)</option>
              <option value="Europe/Paris">Central European (CET)</option>
              <option value="Asia/Dubai">Dubai (GST)</option>
              <option value="Asia/Jerusalem">Israel (IST)</option>
              <option value="Asia/Tehran">Tehran (IRST)</option>
            </select>
          </div>
        </>
      )}

      {/* Status indicators */}
      <div className="flex items-center gap-2 pt-4 border-t border-border">
        {saving && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </span>
        )}
        {saved && (
          <span className="flex items-center gap-2 text-sm text-green-500">
            <Check className="h-4 w-4" />
            Saved
          </span>
        )}
        {error && (
          <span className="flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="h-4 w-4" />
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
