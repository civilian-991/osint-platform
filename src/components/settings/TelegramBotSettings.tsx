'use client';

import { useState, useEffect } from 'react';
import { Send, CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';

interface BotStatus {
  enabled: boolean;
  success: boolean;
  botName?: string;
  error?: string;
  config: {
    hasToken: boolean;
    hasChatId: boolean;
  };
}

export function TelegramBotSettings() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/telegram/bot');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const sendTestMessage = async () => {
    setSending(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/telegram/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'test' }),
      });
      const data = await response.json();
      setTestResult({
        success: data.success,
        message: data.success ? 'Test message sent!' : 'Failed to send message',
      });
    } catch (error) {
      setTestResult({ success: false, message: 'Error sending test message' });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status?.enabled ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span className="text-sm font-medium">
            {status?.enabled ? 'Bot Connected' : 'Bot Not Configured'}
          </span>
        </div>
        {status?.botName && (
          <span className="text-xs text-muted-foreground">@{status.botName}</span>
        )}
      </div>

      {/* Configuration checklist */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          {status?.config.hasToken ? (
            <CheckCircle className="h-3 w-3 text-green-500" />
          ) : (
            <XCircle className="h-3 w-3 text-red-500" />
          )}
          <span className={status?.config.hasToken ? 'text-foreground' : 'text-muted-foreground'}>
            TELEGRAM_BOT_TOKEN
          </span>
        </div>
        <div className="flex items-center gap-2">
          {status?.config.hasChatId ? (
            <CheckCircle className="h-3 w-3 text-green-500" />
          ) : (
            <XCircle className="h-3 w-3 text-red-500" />
          )}
          <span className={status?.config.hasChatId ? 'text-foreground' : 'text-muted-foreground'}>
            TELEGRAM_ALERT_CHAT_ID
          </span>
        </div>
      </div>

      {/* Setup instructions if not configured */}
      {!status?.enabled && (
        <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
            <div className="text-xs text-amber-200 space-y-1">
              <p className="font-medium">Setup Required:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-amber-300/80">
                <li>Message @BotFather on Telegram</li>
                <li>Create a new bot with /newbot</li>
                <li>Copy the bot token</li>
                <li>Add bot to your channel as admin</li>
                <li>Get chat ID (use @userinfobot)</li>
                <li>Add to Vercel environment variables</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Test button */}
      {status?.enabled && (
        <div className="space-y-2">
          <button
            onClick={sendTestMessage}
            disabled={sending}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary/20 hover:bg-primary/30 text-primary rounded-md transition-colors disabled:opacity-50"
          >
            {sending ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            Send Test Message
          </button>

          {testResult && (
            <div
              className={`text-xs p-2 rounded ${
                testResult.success
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {testResult.message}
            </div>
          )}
        </div>
      )}

      {/* Alert types info */}
      <div className="pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">Automatic alerts sent for:</p>
        <div className="flex flex-wrap gap-2">
          {['Strikes', 'Aircraft', 'Formations'].map((type) => (
            <span
              key={type}
              className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground"
            >
              {type}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
