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
