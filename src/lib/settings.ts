import { supabase, isSupabaseConfigured } from './supabase.ts';
import starterCategoriesRaw from './starterCategories.json';

export interface CategoryItem {
  name: string;
  description: string;
}

export const STARTER_CATEGORIES: CategoryItem[] = starterCategoriesRaw;

/**
 * Normalizes categories from settings (handles legacy string[] or CategoryItem[]).
 */
export function normalizeCategories(raw: unknown): CategoryItem[] {
  if (!Array.isArray(raw)) return STARTER_CATEGORIES;
  return raw.map((item) => {
    if (typeof item === 'string') {
      const clean = item.trim().toLowerCase();
      // Apply rename aliases
      const aliased = clean === 'digital media time' ? 'social media' : clean === 'misc hobby' ? 'hobbies' : clean;
      const found = STARTER_CATEGORIES.find((c) => c.name.toLowerCase() === aliased);
      return {
        name: aliased,
        description: found?.description || '',
      };
    }
    if (item && typeof item === 'object') {
      const obj = item as { name?: string; description?: string };
      const rawName = String(obj.name || '').trim().toLowerCase();
      const aliased = rawName === 'digital media time' ? 'social media' : rawName === 'misc hobby' ? 'hobbies' : rawName;
      const found = STARTER_CATEGORIES.find((c) => c.name.toLowerCase() === aliased);
      return {
        name: aliased,
        description: String(obj.description || found?.description || ''),
      };
    }
    return { name: String(item), description: '' };
  });
}

export interface UserSettings {
  user_id: string;
  timezone: string;
  reminders_enabled: boolean;
  reminder_start_hour: number;
  reminder_end_hour: number;
  snooze_until: string | null;
  categories: CategoryItem[];
  vacation_mode?: boolean;
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
      return {
        ...existing,
        categories: normalizeCategories(existing.categories),
      } as UserSettings;
    }

    // 2. If row does not exist, create it with default starter values
    const newSettings = {
      user_id: userId,
      timezone: 'America/Phoenix',
      reminders_enabled: true,
      reminder_start_hour: 8,
      reminder_end_hour: 23,
      snooze_until: null,
      categories: STARTER_CATEGORIES,
      vacation_mode: false,
    };

    const { data: created, error: insertError } = await supabase
      .from('settings')
      .insert(newSettings)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating starter settings row:', insertError.message);
      return newSettings as UserSettings;
    }

    return {
      ...created,
      categories: normalizeCategories(created.categories),
    } as UserSettings;
  } catch (err) {
    console.error('Failed to ensure user settings:', err);
    return null;
  }
}

/**
 * Milestone 2.6 & 3.7: Update categories list in user settings
 */
export async function updateUserCategories(
  userId: string,
  newCategories: CategoryItem[] | string[]
): Promise<void> {
  const normalized = normalizeCategories(newCategories);
  const { error } = await supabase
    .from('settings')
    .update({ categories: normalized })
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to update categories: ${error.message}`);
  }
}

/**
 * Milestone 3.7: Update a category's description in place
 */
export async function updateCategoryDescription(
  userId: string,
  categoryName: string,
  newDescription: string,
  currentCategories: CategoryItem[]
): Promise<CategoryItem[]> {
  const cleanName = categoryName.trim().toLowerCase();
  const updated = currentCategories.map((c) =>
    c.name.trim().toLowerCase() === cleanName
      ? { ...c, description: newDescription.trim() }
      : c
  );

  await updateUserCategories(userId, updated);
  return updated;
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
 * Milestone 2.6 & 3.7: Rename a category across settings and all existing segments
 */
export async function renameCategory(
  userId: string,
  oldName: string,
  newName: string,
  currentCategories: CategoryItem[]
): Promise<{ updatedCount: number; newCategories: CategoryItem[] }> {
  const cleanOld = oldName.trim().toLowerCase();
  const cleanNew = newName.trim().toLowerCase();

  if (!cleanNew) {
    throw new Error('New category name cannot be empty');
  }

  // Update in category list
  const newCategories = currentCategories.map((c) =>
    c.name.trim().toLowerCase() === cleanOld ? { ...c, name: cleanNew } : c
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
 * Milestone 2.6 & 3.7: Delete a category (blocked if segments use it)
 */
export async function deleteCategory(
  userId: string,
  category: string,
  currentCategories: CategoryItem[]
): Promise<{ success: boolean; usageCount?: number; newCategories?: CategoryItem[] }> {
  const cleanCat = category.trim().toLowerCase();
  const usageCount = await getCategoryUsageCount(userId, cleanCat);

  if (usageCount > 0) {
    return { success: false, usageCount };
  }

  const newCategories = currentCategories.filter(
    (c) => c.name.trim().toLowerCase() !== cleanCat
  );

  await updateUserCategories(userId, newCategories);
  return { success: true, newCategories };
}

/**
 * Milestone 3.7: Person statistics for the People screen
 */
export interface PersonStat {
  name: string;
  count: number;
  totalMinutes: number;
}

/**
 * Milestone 3.7: Load stats for every person in segments.company
 */
export async function getPeopleStats(userId: string): Promise<PersonStat[]> {
  const { data: segments, error } = await supabase
    .from('segments')
    .select('start_time, end_time, company')
    .eq('user_id', userId);

  if (error || !segments) {
    console.warn('Error loading people stats:', error?.message);
    return [];
  }

  const map = new Map<string, { count: number; totalMinutes: number }>();

  for (const seg of segments) {
    const rawCompany: string[] = Array.isArray(seg.company) ? seg.company : [];
    const startMs = new Date(seg.start_time).getTime();
    const endMs = new Date(seg.end_time).getTime();
    const durationMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));

    // Deduplicate names within the same segment ignoring case
    const seenInSeg = new Set<string>();
    for (const rawName of rawCompany) {
      const cleanName = rawName.trim();
      if (!cleanName) continue;
      const lower = cleanName.toLowerCase();
      if (seenInSeg.has(lower)) continue;
      seenInSeg.add(lower);

      const existing = map.get(lower);
      if (existing) {
        existing.count += 1;
        existing.totalMinutes += durationMinutes;
      } else {
        map.set(lower, { count: 1, totalMinutes: durationMinutes });
      }
    }
  }

  // Preserve proper capitalization by searching first appearance
  const stats: PersonStat[] = [];
  for (const [lower, data] of map.entries()) {
    // Find canonical name casing from segments
    let canonical = lower;
    for (const seg of segments) {
      const match = (seg.company || []).find(
        (n: string) => n.trim().toLowerCase() === lower
      );
      if (match) {
        canonical = match.trim();
        break;
      }
    }

    stats.push({
      name: canonical,
      count: data.count,
      totalMinutes: data.totalMinutes,
    });
  }

  return stats.sort((a, b) => b.totalMinutes - a.totalMinutes);
}

/**
 * Milestone 3.7: Rename a person across all segments (merging if newName exists)
 */
export async function renamePerson(
  userId: string,
  oldName: string,
  newName: string
): Promise<{ updatedCount: number }> {
  const cleanOld = oldName.trim().toLowerCase();
  const cleanNew = newName.trim();

  if (!cleanNew) {
    throw new Error('New name cannot be empty');
  }

  // Load all segments containing oldName
  const { data: segments, error } = await supabase
    .from('segments')
    .select('id, company')
    .eq('user_id', userId);

  if (error || !segments) {
    throw new Error(`Failed to load segments: ${error?.message}`);
  }

  let updatedCount = 0;
  for (const seg of segments) {
    const company: string[] = Array.isArray(seg.company) ? seg.company : [];
    const hasOld = company.some((n) => n.trim().toLowerCase() === cleanOld);
    if (!hasOld) continue;

    // Replace old with new, deduplicate case-insensitively
    const updatedCompany: string[] = [];
    const seen = new Set<string>();

    for (const n of company) {
      const target = n.trim().toLowerCase() === cleanOld ? cleanNew : n.trim();
      if (!target) continue;
      if (!seen.has(target.toLowerCase())) {
        seen.add(target.toLowerCase());
        updatedCompany.push(target);
      }
    }

    await supabase
      .from('segments')
      .update({ company: updatedCompany })
      .eq('id', seg.id);

    updatedCount++;
  }

  return { updatedCount };
}

/**
 * Milestone 3.7: Delete a person from all segments' company arrays
 */
export async function deletePerson(
  userId: string,
  nameToDelete: string
): Promise<{ updatedCount: number }> {
  const cleanTarget = nameToDelete.trim().toLowerCase();

  const { data: segments, error } = await supabase
    .from('segments')
    .select('id, company')
    .eq('user_id', userId);

  if (error || !segments) {
    throw new Error(`Failed to load segments: ${error?.message}`);
  }

  let updatedCount = 0;
  for (const seg of segments) {
    const company: string[] = Array.isArray(seg.company) ? seg.company : [];
    const hasTarget = company.some((n) => n.trim().toLowerCase() === cleanTarget);
    if (!hasTarget) continue;

    const filtered = company.filter((n) => n.trim().toLowerCase() !== cleanTarget);

    await supabase
      .from('segments')
      .update({ company: filtered })
      .eq('id', seg.id);

    updatedCount++;
  }

  return { updatedCount };
}

/**
 * Milestone 3.7: Toggle or update vacation_mode on user settings
 */
export async function setVacationMode(userId: string, vacationMode: boolean): Promise<void> {
  await updateUserSettings(userId, { vacation_mode: vacationMode } as Partial<UserSettings>);
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
 * Milestone 3.4 & 3.5: Compute the next scheduled reminder time based on settings, snooze,
 * and whether the user has logged within the last 30 minutes.
 */
export function computeNextReminderTime(
  settings: Pick<
    UserSettings,
    'reminders_enabled' | 'timezone' | 'reminder_start_hour' | 'reminder_end_hour' | 'snooze_until'
  >,
  currentTime: Date = new Date(),
  latestEntryEnd?: string | Date | null
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
  const recentThresholdMs = 30 * 60 * 1000;
  const entryEndTime = latestEntryEnd ? new Date(latestEntryEnd).getTime() : null;

  while (iterations < 72) {
    const hour = getLocalHour(candidate, timeZone);
    const inWindow = hour >= startHour && hour <= endHour;

    // Milestone 3.5: If candidate falls within 30 minutes of latest entry, the reminder is skipped
    let skippedDueToRecentLog = false;
    if (inWindow && entryEndTime && !isNaN(entryEndTime)) {
      const diffAtCandidate = candidate.getTime() - entryEndTime;
      if (diffAtCandidate >= -60_000 && diffAtCandidate <= recentThresholdMs) {
        skippedDueToRecentLog = true;
      }
    }

    if (inWindow && !skippedDueToRecentLog) {
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

