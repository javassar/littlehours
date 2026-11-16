import { supabase, isSupabaseConfigured } from './supabase.ts';

export const STARTER_CATEGORIES = [
  'work',
  'job search',
  'phone and social media',
  'sleep',
  'exercise',
  'meals',
  'chores',
  'social time',
  'reading',
  'entertainment',
  'travel',
  'personal care',
  'errands',
  'rest',
];

export interface UserSettings {
  user_id: string;
  timezone: string;
  reminders_enabled: boolean;
  reminder_start_hour: number;
  reminder_end_hour: number;
  snooze_until: string | null;
  categories: string[];
}

/**
 * Ensures a settings row exists for the given user.
 * Called automatically upon successful login.
 */
export async function ensureUserSettings(userId: string): Promise<UserSettings | null> {
  if (!isSupabaseConfigured || !userId) {
    return null;
  }

  try {
    // 1. Check if settings row already exists
    const { data: existing, error: fetchError } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking user settings:', fetchError.message);
    }

    if (existing) {
      return existing as UserSettings;
    }

    // 2. If row does not exist, create it with default starter values
    const newSettings: UserSettings = {
      user_id: userId,
      timezone: 'America/Phoenix',
      reminders_enabled: true,
      reminder_start_hour: 8,
      reminder_end_hour: 23,
      snooze_until: null,
      categories: STARTER_CATEGORIES,
    };

    const { data: created, error: insertError } = await supabase
      .from('settings')
      .insert(newSettings)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating starter settings row:', insertError.message);
      return newSettings;
    }

    return created as UserSettings;
  } catch (err) {
    console.error('Failed to ensure user settings:', err);
    return null;
  }
}

/**
 * Milestone 2.6: Update categories list in user settings
 */
export async function updateUserCategories(userId: string, newCategories: string[]): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .update({ categories: newCategories })
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to update categories: ${error.message}`);
  }
}

/**
 * Milestone 2.6: Get count of segments using a category
 */
export async function getCategoryUsageCount(userId: string, category: string): Promise<number> {
  const { count, error } = await supabase
    .from('segments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('category', category.trim().toLowerCase());

  if (error) {
    console.warn('Error checking category usage:', error.message);
    return 0;
  }
  return count || 0;
}

/**
 * Milestone 2.6: Rename a category across settings and all existing segments
 */
export async function renameCategory(
  userId: string,
  oldName: string,
  newName: string,
  currentCategories: string[]
): Promise<{ updatedCount: number; newCategories: string[] }> {
  const cleanOld = oldName.trim().toLowerCase();
  const cleanNew = newName.trim().toLowerCase();

  if (!cleanNew) {
    throw new Error('New category name cannot be empty');
  }

  // Update in category list
  const newCategories = currentCategories.map((c) =>
    c.trim().toLowerCase() === cleanOld ? cleanNew : c
  );

  // 1. Update settings
  await updateUserCategories(userId, newCategories);

  // 2. Update existing segments using old category name
  const { data, error } = await supabase
    .from('segments')
    .update({ category: cleanNew })
    .eq('user_id', userId)
    .eq('category', cleanOld)
    .select('id');

  if (error) {
    console.warn('Could not update segments for renamed category:', error.message);
  }

  return {
    updatedCount: data?.length || 0,
    newCategories,
  };
}

/**
 * Milestone 2.6: Delete a category (blocked if segments use it)
 */
export async function deleteCategory(
  userId: string,
  category: string,
  currentCategories: string[]
): Promise<{ success: boolean; usageCount?: number; newCategories?: string[] }> {
  const cleanCat = category.trim().toLowerCase();
  const usageCount = await getCategoryUsageCount(userId, cleanCat);

  if (usageCount > 0) {
    return { success: false, usageCount };
  }

  const newCategories = currentCategories.filter(
    (c) => c.trim().toLowerCase() !== cleanCat
  );

  await updateUserCategories(userId, newCategories);
  return { success: true, newCategories };
}

/**
 * Milestone 2.6: Get segment counts grouped by prompt_version
 */
export async function getPromptVersionStats(userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('segments')
    .select('prompt_version')
    .eq('user_id', userId);

  if (error || !data) {
    return {};
  }

  const stats: Record<string, number> = {};
  for (const s of data) {
    const version = s.prompt_version || 'v1';
    stats[version] = (stats[version] || 0) + 1;
  }
  return stats;
}

/**
 * Common timezones for picker
 */
export const COMMON_TIMEZONES = [
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
];

/**
 * Milestone 3.4: Update user settings fields
 */
export async function updateUserSettings(
  userId: string,
  updates: Partial<Omit<UserSettings, 'user_id'>>
): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('settings')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update settings: ${error.message}`);
  }
  return data as UserSettings;
}

/**
 * Milestone 3.4: Snooze reminders for a given number of minutes (default 60 = 1 hour)
 */
export async function snoozeReminders(
  userId: string,
  durationMinutes: number = 60
): Promise<string> {
  const snoozeUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
  await updateUserSettings(userId, { snooze_until: snoozeUntil });
  return snoozeUntil;
}

/**
 * Milestone 3.4: Cancel active snooze
 */
export async function cancelSnooze(userId: string): Promise<void> {
  await updateUserSettings(userId, { snooze_until: null });
}

/**
 * Helper to compute local hour (0-23) in a given timezone
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
  } catch {
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
 * Milestone 3.4: Compute the next scheduled reminder time based on settings and snooze
 */
export function computeNextReminderTime(
  settings: Pick<
    UserSettings,
    'reminders_enabled' | 'timezone' | 'reminder_start_hour' | 'reminder_end_hour' | 'snooze_until'
  >,
  currentTime: Date = new Date()
): Date | null {
  if (!settings.reminders_enabled) {
    return null;
  }

  const timeZone = settings.timezone || 'America/Phoenix';
  const startHour =
    typeof settings.reminder_start_hour === 'number' ? settings.reminder_start_hour : 8;
  const endHour =
    typeof settings.reminder_end_hour === 'number' ? settings.reminder_end_hour : 23;

  let earliestAllowed = currentTime.getTime();
  if (settings.snooze_until) {
    const snoozeTime = new Date(settings.snooze_until).getTime();
    if (snoozeTime > earliestAllowed) {
      earliestAllowed = snoozeTime;
    }
  }

  // Next top of the hour after earliestAllowed
  const candidate = new Date(earliestAllowed);
  if (
    candidate.getMinutes() > 0 ||
    candidate.getSeconds() > 0 ||
    candidate.getMilliseconds() > 0
  ) {
    candidate.setMinutes(0, 0, 0);
    candidate.setHours(candidate.getHours() + 1);
  }

  // Search forward for the next hour inside the [startHour, endHour] window
  let iterations = 0;
  while (iterations < 72) {
    const hour = getLocalHour(candidate, timeZone);
    if (hour >= startHour && hour <= endHour) {
      return candidate;
    }
    candidate.setHours(candidate.getHours() + 1);
    iterations++;
  }

  return candidate;
}

/**
 * Milestone 3.4: Formats a Date to a friendly string: "Today at 3:00 PM", "Tomorrow at 8:00 AM", etc.
 */
export function formatFriendlyTime(
  date: Date,
  timeZone: string,
  relativeTo: Date = new Date()
): string {
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  });

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });

  const targetDateStr = dateFormatter.format(date);
  const todayStr = dateFormatter.format(relativeTo);

  const tomorrow = new Date(relativeTo);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = dateFormatter.format(tomorrow);

  const timeStr = timeFormatter.format(date);

  if (targetDateStr === todayStr) {
    return `Today at ${timeStr}`;
  } else if (targetDateStr === tomorrowStr) {
    return `Tomorrow at ${timeStr}`;
  } else {
    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return `${dayFormatter.format(date)} at ${timeStr}`;
  }
}

