import { supabase, isSupabaseConfigured } from './supabase';

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
