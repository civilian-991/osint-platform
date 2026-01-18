import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { getServerSession } from '@/lib/auth/server';
import type { UserPreferences, UpdatePreferencesInput } from '@/lib/types/preferences';
import { DEFAULT_PREFERENCES } from '@/lib/types/preferences';

export async function GET() {
  try {
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const preferences = await queryOne<UserPreferences>(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    // Return defaults if no preferences exist
    if (!preferences) {
      return NextResponse.json({
        success: true,
        data: {
          ...DEFAULT_PREFERENCES,
          user_id: userId,
        },
        isDefault: true,
      });
    }

    return NextResponse.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userId = session?.data?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: UpdatePreferencesInput = await request.json();

    // Validate input
    if (body.email_frequency && !['immediate', 'hourly', 'daily', 'weekly'].includes(body.email_frequency)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email_frequency' },
        { status: 400 }
      );
    }

    if (body.min_confidence_threshold !== undefined) {
      if (body.min_confidence_threshold < 0 || body.min_confidence_threshold > 1) {
        return NextResponse.json(
          { success: false, error: 'min_confidence_threshold must be between 0 and 1' },
          { status: 400 }
        );
      }
    }

    // Check if preferences exist
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    if (existing) {
      // Update existing preferences
      const setClauses: string[] = [];
      const params: (string | number | boolean | string[] | null)[] = [userId];
      let paramIndex = 2;

      if (body.email_notifications !== undefined) {
        setClauses.push(`email_notifications = $${paramIndex}`);
        params.push(body.email_notifications);
        paramIndex++;
      }

      if (body.email_frequency !== undefined) {
        setClauses.push(`email_frequency = $${paramIndex}`);
        params.push(body.email_frequency);
        paramIndex++;
      }

      if (body.notification_types !== undefined) {
        setClauses.push(`notification_types = $${paramIndex}`);
        params.push(JSON.stringify(body.notification_types));
        paramIndex++;
      }

      if (body.min_confidence_threshold !== undefined) {
        setClauses.push(`min_confidence_threshold = $${paramIndex}`);
        params.push(body.min_confidence_threshold);
        paramIndex++;
      }

      if (body.quiet_hours_start !== undefined) {
        setClauses.push(`quiet_hours_start = $${paramIndex}`);
        params.push(body.quiet_hours_start);
        paramIndex++;
      }

      if (body.quiet_hours_end !== undefined) {
        setClauses.push(`quiet_hours_end = $${paramIndex}`);
        params.push(body.quiet_hours_end);
        paramIndex++;
      }

      if (body.timezone !== undefined) {
        setClauses.push(`timezone = $${paramIndex}`);
        params.push(body.timezone);
        paramIndex++;
      }

      if (setClauses.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No fields to update' },
          { status: 400 }
        );
      }

      const result = await query<UserPreferences>(
        `UPDATE user_preferences SET ${setClauses.join(', ')} WHERE user_id = $1 RETURNING *`,
        params
      );

      return NextResponse.json({
        success: true,
        data: result[0],
      });
    } else {
      // Create new preferences
      const result = await query<UserPreferences>(
        `INSERT INTO user_preferences (
          user_id, email_notifications, email_frequency, notification_types,
          min_confidence_threshold, quiet_hours_start, quiet_hours_end, timezone
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          userId,
          body.email_notifications ?? DEFAULT_PREFERENCES.email_notifications,
          body.email_frequency ?? DEFAULT_PREFERENCES.email_frequency,
          JSON.stringify(body.notification_types ?? DEFAULT_PREFERENCES.notification_types),
          body.min_confidence_threshold ?? DEFAULT_PREFERENCES.min_confidence_threshold,
          body.quiet_hours_start ?? DEFAULT_PREFERENCES.quiet_hours_start,
          body.quiet_hours_end ?? DEFAULT_PREFERENCES.quiet_hours_end,
          body.timezone ?? DEFAULT_PREFERENCES.timezone,
        ]
      );

      return NextResponse.json({
        success: true,
        data: result[0],
      });
    }
  } catch (error) {
    console.error('Error updating preferences:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
