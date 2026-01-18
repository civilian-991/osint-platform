/**
 * Email Service
 * Handles sending email notifications using Resend
 */

import { query, execute, queryOne } from '@/lib/db';
import type { Alert } from '@/lib/types/correlation';
import type { EmailContent, EmailQueueItem, NotificationType } from '@/lib/types/preferences';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface QueueEmailParams {
  userId: string;
  alertId?: string;
  emailType: string;
  subject: string;
  recipient: string;
  content: EmailContent;
}

export class EmailService {
  private apiKey: string | undefined;
  private fromEmail: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.EMAIL_FROM || 'alerts@osint-aviation.com';
    this.baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  }

  /**
   * Check if email service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Send an email using Resend
   */
  async sendEmail(params: SendEmailParams): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!this.apiKey) {
      console.warn('Email service not configured: RESEND_API_KEY missing');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Resend API error: ${error}`);
      }

      const result = await response.json();
      return { success: true, id: result.id };
    } catch (error) {
      console.error('Failed to send email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Queue an email for sending
   */
  async queueEmail(params: QueueEmailParams): Promise<string> {
    const result = await queryOne<{ id: string }>(
      `INSERT INTO email_queue (user_id, alert_id, email_type, subject, recipient, content)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        params.userId,
        params.alertId || null,
        params.emailType,
        params.subject,
        params.recipient,
        params.content,
      ]
    );

    return result?.id || '';
  }

  /**
   * Process pending emails from queue
   */
  async processQueue(limit: number = 50): Promise<{ processed: number; sent: number; failed: number }> {
    // Get pending emails
    const pendingEmails = await query<EmailQueueItem>(
      `SELECT * FROM email_queue
       WHERE status = 'pending'
       AND attempts < 3
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );

    let sent = 0;
    let failed = 0;

    for (const email of pendingEmails) {
      // Update attempt count
      await execute(
        `UPDATE email_queue SET attempts = attempts + 1, last_attempt_at = NOW() WHERE id = $1`,
        [email.id]
      );

      // Generate HTML from content
      const html = this.generateAlertEmailHtml(email.content);

      // Try to send
      const result = await this.sendEmail({
        to: email.recipient,
        subject: email.subject,
        html,
        text: email.content.body,
      });

      if (result.success) {
        await execute(
          `UPDATE email_queue SET status = 'sent', sent_at = NOW() WHERE id = $1`,
          [email.id]
        );
        sent++;
      } else {
        const newStatus = email.attempts >= 2 ? 'failed' : 'pending';
        await execute(
          `UPDATE email_queue SET status = $1, error_message = $2 WHERE id = $3`,
          [newStatus, result.error, email.id]
        );
        if (newStatus === 'failed') failed++;
      }
    }

    return { processed: pendingEmails.length, sent, failed };
  }

  /**
   * Queue notification email for an alert
   */
  async queueAlertNotification(
    alert: Alert,
    userId: string,
    userEmail: string
  ): Promise<void> {
    // Check if we should send based on user preferences
    const shouldSend = await queryOne<{ should_send_notification: boolean }>(
      `SELECT should_send_notification($1, $2, $3) as should_send_notification`,
      [userId, alert.alert_type, alert.data?.confidence || 0]
    );

    if (!shouldSend?.should_send_notification) {
      return;
    }

    // Check for duplicate (same alert not yet sent)
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM email_queue
       WHERE alert_id = $1 AND status = 'pending'`,
      [alert.id]
    );

    if (existing) {
      return;
    }

    const content: EmailContent = {
      title: alert.title,
      body: alert.description || this.generateAlertDescription(alert),
      alertData: alert.data,
      ctaUrl: `${this.baseUrl}/alerts`,
      ctaText: 'View Alert',
    };

    await this.queueEmail({
      userId,
      alertId: alert.id,
      emailType: alert.alert_type,
      subject: `[OSINT Aviation] ${alert.title}`,
      recipient: userEmail,
      content,
    });
  }

  /**
   * Generate alert description based on alert type and data
   */
  private generateAlertDescription(alert: Alert): string {
    const data = alert.data || {};

    switch (alert.alert_type) {
      case 'watchlist_aircraft':
        return `Aircraft ${data.callsign || data.icao_hex} has been detected. ` +
          `It matched "${data.match_value}" in watchlist "${data.watchlist_name}".`;

      case 'high_confidence_match':
        return `A high confidence correlation (${Math.round((data.confidence as number || 0) * 100)}%) ` +
          `has been detected between news and flight activity.`;

      case 'unusual_pattern':
        return `An unusual flight pattern has been detected: ${data.pattern_type || 'unknown pattern'}.`;

      case 'region_activity':
        return `Activity has been detected in region: ${data.region_name || 'unknown region'}.`;

      default:
        return 'A new alert has been generated.';
    }
  }

  /**
   * Generate HTML email for alert
   */
  private generateAlertEmailHtml(content: EmailContent): string {
    const severityColor = '#f59e0b'; // amber

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">OSINT Aviation Alert</h1>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <div style="background: ${severityColor}20; border-left: 4px solid ${severityColor}; padding: 15px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
      <h2 style="margin: 0 0 5px; color: #1f2937; font-size: 18px;">${content.title}</h2>
    </div>

    <p style="color: #4b5563; margin-bottom: 20px;">${content.body}</p>

    ${content.alertData ? `
    <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 10px; font-size: 14px; color: #6b7280; text-transform: uppercase;">Details</h3>
      <pre style="margin: 0; font-family: monospace; font-size: 12px; white-space: pre-wrap; color: #374151;">${JSON.stringify(content.alertData, null, 2)}</pre>
    </div>
    ` : ''}

    ${content.ctaUrl ? `
    <a href="${content.ctaUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">${content.ctaText || 'View Details'}</a>
    ` : ''}
  </div>

  <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
    <p style="margin: 0; color: #9ca3af; font-size: 12px;">
      You're receiving this because you have email notifications enabled.<br>
      <a href="${this.baseUrl}/settings" style="color: #6b7280;">Manage notification preferences</a>
    </p>
  </div>
</body>
</html>`;
  }
}

// Export singleton instance
export const emailService = new EmailService();
