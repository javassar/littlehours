/**
 * Milestone 3.3 & 3.5: Supabase Edge Function `send-reminders`
 * Hourly sender that sends Web Push reminders to users within their active reminder window.
 * Skips reminders if the user has logged within the last 30 minutes.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@^3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Converts a date to the local hour (0-23) in the target timezone.
 */
export function getLocalHour(date: Date, timeZone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    });
    const hourStr = formatter.format(date);
    const hour = parseInt(hourStr, 10);
    return hour === 24 ? 0 : hour;
  } catch (err) {
    console.warn(`Invalid timezone "${timeZone}", falling back to America/Phoenix:`, err);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Phoenix',
      hour: 'numeric',
      hour12: false,
    });
    const hourStr = formatter.format(date);
    const hour = parseInt(hourStr, 10);
    return hour === 24 ? 0 : hour;
  }
}

/**
 * Milestone 3.5: Check if the user's latest entry ended within the last 30 minutes.
 * If so, the reminder is skipped because the user has already checked in.
 */
export interface RecentEntryCheckResult {
  isRecent: boolean;
  minutesAgo: number;
  reason?: string;
}

export function checkRecentEntry(
  latestWindowEnd: string | Date | null | undefined,
  currentTime: Date,
  thresholdMs: number = 30 * 60 * 1000
): RecentEntryCheckResult {
  if (!latestWindowEnd) {
    return { isRecent: false, minutesAgo: -1 };
  }

  const endedAt = new Date(latestWindowEnd);
  if (isNaN(endedAt.getTime())) {
    return { isRecent: false, minutesAgo: -1 };
  }

  const diffMs = currentTime.getTime() - endedAt.getTime();
  // Within the last 30 minutes: endedAt is recent (allowing 60s clock skew) and within threshold
  if (diffMs >= -60_000 && diffMs <= thresholdMs) {
    const minutesAgo = Math.max(0, Math.round(diffMs / 60000));
    return {
      isRecent: true,
      minutesAgo,
      reason: `logged recently (latest entry ended at ${endedAt.toISOString()}, ${minutesAgo}m ago)`,
    };
  }

  const minutesAgo = Math.round(diffMs / 60000);
  return { isRecent: false, minutesAgo };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const runStartTime = new Date();
  console.log(`[send-reminders] Run started at ${runStartTime.toISOString()}`);

  try {
    // 1. Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Configure WebPush with VAPID secrets
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:jacqueline@littlehours.app';

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY in Edge Function secrets');
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // 3. Parse optional parameters (for manual testing and simulated clock)
    const body = await req.json().catch(() => ({}));
    const targetUserId = body.user_id as string | undefined;
    const testClock = body.test_clock as string | undefined;
    const ignoreQuietHours = Boolean(body.ignore_quiet_hours);
    const ignoreRecentLog = Boolean(body.ignore_recent_log);

    // Use simulated time if provided, otherwise real current time
    const currentTime = testClock ? new Date(testClock) : new Date();
    console.log(
      `[send-reminders] Evaluating reminders for time: ${currentTime.toISOString()}${
        testClock ? ' (test clock)' : ''
      }`
    );

    // 4. Load push subscriptions
    let subQuery = supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth');

    if (targetUserId) {
      subQuery = subQuery.eq('user_id', targetUserId);
    }

    const { data: allSubscriptions, error: subError } = await subQuery;
    if (subError) {
      throw new Error(`Failed to load subscriptions: ${subError.message}`);
    }

    if (!allSubscriptions || allSubscriptions.length === 0) {
      console.log('[send-reminders] No active push subscriptions found.');
      return new Response(
        JSON.stringify({
          status: 'ok',
          message: 'No push subscriptions found',
          users_checked: 0,
          notifications_sent: 0,
          skipped: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group subscriptions by user_id
    const userSubsMap = new Map<string, typeof allSubscriptions>();
    for (const sub of allSubscriptions) {
      const list = userSubsMap.get(sub.user_id) || [];
      list.push(sub);
      userSubsMap.set(sub.user_id, list);
    }

    const userIds = Array.from(userSubsMap.keys());
    console.log(`[send-reminders] Found ${allSubscriptions.length} subscription(s) across ${userIds.length} user(s).`);

    // 5. Load settings for all target users
    const { data: allSettings, error: settingsError } = await supabase
      .from('settings')
      .select('user_id, timezone, reminders_enabled, reminder_start_hour, reminder_end_hour, snooze_until')
      .in('user_id', userIds);

    if (settingsError) {
      console.warn('Could not load user settings, will use defaults:', settingsError.message);
    }

    const settingsMap = new Map<string, any>();
    for (const s of allSettings || []) {
      settingsMap.set(s.user_id, s);
    }

    // Tracking stats
    let totalSent = 0;
    let totalFailed = 0;
    let totalPruned = 0;
    const skippedLog: Array<{ user_id: string; reason: string }> = [];

    // Notification payload
    const payload = JSON.stringify({
      title: 'Little Hours',
      body: 'Tell me how you spent the past hour.',
      url: '/?focus=1',
    });

    // 6. Evaluate and send for each user
    for (const userId of userIds) {
      const subs = userSubsMap.get(userId) || [];
      const userSettings = settingsMap.get(userId) || {};

      const timeZone = userSettings.timezone || 'America/Phoenix';
      const remindersEnabled = userSettings.reminders_enabled !== false;
      const startHour =
        typeof userSettings.reminder_start_hour === 'number'
          ? userSettings.reminder_start_hour
          : 8;
      const endHour =
        typeof userSettings.reminder_end_hour === 'number'
          ? userSettings.reminder_end_hour
          : 23;
      const snoozeUntil = userSettings.snooze_until;

      // Rule 1: reminders_enabled must be on
      if (!remindersEnabled) {
        console.log(`[send-reminders] Skipped user ${userId}: reminders disabled`);
        skippedLog.push({ user_id: userId, reason: 'reminders disabled' });
        continue;
      }

      // Rule 2: snooze_until must be empty or in the past
      if (snoozeUntil && new Date(snoozeUntil) > currentTime) {
        console.log(`[send-reminders] Skipped user ${userId}: snoozed until ${snoozeUntil}`);
        skippedLog.push({ user_id: userId, reason: `snoozed until ${snoozeUntil}` });
        continue;
      }

      // Rule 3: local hour must be between reminder_start_hour (8) and reminder_end_hour (23) inclusive
      const localHour = getLocalHour(currentTime, timeZone);
      if (!ignoreQuietHours && (localHour < startHour || localHour > endHour)) {
        console.log(
          `[send-reminders] Skipped user ${userId}: quiet hours (${localHour}:00 in ${timeZone}, active: ${startHour}:00-${endHour}:00)`
        );
        skippedLog.push({
          user_id: userId,
          reason: `quiet hours (${localHour}:00 in ${timeZone})`,
        });
        continue;
      }

      // Rule 4: Skip when user has just logged within the last 30 minutes (Milestone 3.5)
      if (!ignoreRecentLog) {
        const { data: latestEntry, error: entryError } = await supabase
          .from('entries')
          .select('id, window_end')
          .eq('user_id', userId)
          .order('window_end', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (entryError) {
          console.warn(`[send-reminders] Could not check recent entries for user ${userId}:`, entryError.message);
        } else if (latestEntry && latestEntry.window_end) {
          const recentCheck = checkRecentEntry(latestEntry.window_end, currentTime);
          if (recentCheck.isRecent) {
            console.log(
              `[send-reminders] Skipped user ${userId}: ${recentCheck.reason}`
            );
            skippedLog.push({
              user_id: userId,
              reason: recentCheck.reason || 'logged recently',
            });
            continue;
          }
        }
      }

      // Send to every subscription for this user
      for (const sub of subs) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload, {
            TTL: 3600,
            headers: {
              Urgency: 'normal',
            },
          });
          totalSent++;
          console.log(`[send-reminders] Notification sent to user ${userId} (sub ${sub.id})`);
        } catch (pushErr: any) {
          const status = pushErr.statusCode || pushErr.status;
          console.warn(`[send-reminders] Push error for user ${userId} (sub ${sub.id}): status ${status}`);

          // Rule 4: If push service answers 404 or 410, delete that subscription
          if (status === 404 || status === 410) {
            console.log(`[send-reminders] Deleting expired/unregistered subscription ${sub.id} (HTTP ${status})`);
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            totalPruned++;
          } else {
            totalFailed++;
          }
        }
      }
    }

    // 7. Log run summary
    console.log(`[send-reminders] Run finished in ${Date.now() - runStartTime.getTime()}ms:`);
    console.log(`  Users checked: ${userIds.length}`);
    console.log(`  Notifications sent: ${totalSent}`);
    console.log(`  Notifications failed: ${totalFailed}`);
    console.log(`  Subscriptions pruned (404/410): ${totalPruned}`);
    console.log(`  Users skipped: ${skippedLog.length}`);

    return new Response(
      JSON.stringify({
        status: 'ok',
        timestamp: currentTime.toISOString(),
        users_checked: userIds.length,
        notifications_sent: totalSent,
        notifications_failed: totalFailed,
        subscriptions_pruned: totalPruned,
        skipped: skippedLog,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[send-reminders] Fatal error during run:', errorMsg);
    return new Response(
      JSON.stringify({
        status: 'error',
        error: errorMsg,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
