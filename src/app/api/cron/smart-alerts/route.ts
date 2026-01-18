import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { smartAlertingService } from '@/lib/services/smart-alerting';

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  if (!cronSecret) {
    console.warn('CRON_SECRET not set');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check if ML processing is enabled
  if (process.env.ENABLE_ML_PROCESSING !== 'true') {
    return NextResponse.json({
      success: true,
      message: 'ML processing is disabled',
    });
  }

  try {
    // Get all users with alert models
    const users = await query<{ user_id: string }>(
      `SELECT DISTINCT user_id FROM user_alert_models`
    );

    let usersProcessed = 0;
    let alertsPrioritized = 0;
    const recommendations: Record<string, number> = {
      send: 0,
      batch: 0,
      skip: 0,
    };

    for (const user of users) {
      try {
        // Re-prioritize alerts for this user
        const prioritized = await smartAlertingService.prioritizeAlerts(user.user_id);

        alertsPrioritized += prioritized.length;
        usersProcessed++;

        // Count recommendations
        for (const p of prioritized) {
          recommendations[p.recommendation] = (recommendations[p.recommendation] || 0) + 1;
        }
      } catch (userError) {
        console.error(`Error processing alerts for user ${user.user_id}:`, userError);
      }
    }

    // Also look for users with unread alerts who don't have models yet
    const newUsers = await query<{ user_id: string }>(
      `SELECT DISTINCT user_id FROM alerts
       WHERE user_id IS NOT NULL
       AND is_read = FALSE
       AND user_id NOT IN (SELECT user_id FROM user_alert_models)`
    );

    // Create models for new users
    for (const user of newUsers) {
      try {
        await smartAlertingService.getOrCreateUserModel(user.user_id);
        usersProcessed++;
      } catch (userError) {
        console.error(`Error creating model for user ${user.user_id}:`, userError);
      }
    }

    // Get overall stats
    const stats = await smartAlertingService.getStats();

    return NextResponse.json({
      success: true,
      message: `Processed ${usersProcessed} users, prioritized ${alertsPrioritized} alerts`,
      stats: {
        usersProcessed,
        alertsPrioritized,
        recommendations,
        totalModels: stats.total_models,
        totalInteractions: stats.total_interactions,
        avgClickThroughRate: Math.round(stats.avg_click_through_rate * 100) / 100,
        avgDismissRate: Math.round(stats.avg_dismiss_rate * 100) / 100,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in smart-alerts cron:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Support POST for Vercel cron
export async function POST(request: NextRequest) {
  return GET(request);
}
