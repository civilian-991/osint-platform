'use client';

import { Settings, Bell, Shield, Database } from 'lucide-react';
import { NotificationSettings } from '@/components/settings';

export default function SettingsPage() {
  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account preferences and notification settings
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Notifications Section */}
          <section className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30">
              <h2 className="font-semibold flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure how and when you receive alerts
              </p>
            </div>
            <div className="p-6">
              <NotificationSettings />
            </div>
          </section>

          {/* Data & Privacy Section */}
          <section className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30">
              <h2 className="font-semibold flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Data & Privacy
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">Data Retention</h3>
                  <p className="text-sm text-muted-foreground">
                    Your alert history and preferences are stored securely
                  </p>
                </div>
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">Export Your Data</h3>
                  <p className="text-sm text-muted-foreground">
                    Download all your saved data and preferences
                  </p>
                </div>
                <button className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors">
                  Export
                </button>
              </div>
            </div>
          </section>

          {/* API Access Section (future) */}
          <section className="bg-card border border-border rounded-lg overflow-hidden opacity-60">
            <div className="px-6 py-4 border-b border-border bg-muted/30">
              <h2 className="font-semibold flex items-center gap-2">
                <Database className="h-5 w-5" />
                API Access
                <span className="text-xs bg-muted px-2 py-0.5 rounded">Coming Soon</span>
              </h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-muted-foreground">
                API access for programmatic integration will be available soon.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
