/**
 * Week in Review Data Fetching Module
 * SPEC-3.9 Milestone 4.1
 *
 * Paged retrieval of segments, parent entries, attention entries,
 * settings, and earliest entry date for the Week in Review screen.
 */

import { supabase, isSupabaseConfigured } from './supabase.ts';
import { ensureUserSettings } from './settings.ts';
import type { UserSettings } from './settings.ts';
import {
  getPreviousWeekStart,
  getNextWeekStart,
} from './weekSummary.ts';
import type {
  WeekSummaryInputSegment,
  WeekSummaryInputEntry,
} from './weekSummary.ts';
import { getQueue, getRatingsQueue } from './offlineQueue.ts';

export const PAGE_SIZE = 1000;

export interface FetchWeekReviewDataParams {
  userId: string;
  weekStart: Date;
  timeZone?: string;
}

export interface WeekReviewFetchedData {
  weekStart: Date;
  weekEnd: Date;
  previousWeekStart: Date;
  segments: WeekSummaryInputSegment[];
  previousSegments: WeekSummaryInputSegment[];
  entries: WeekSummaryInputEntry[];
  earliestEntryDate: Date | null;
  settings: UserSettings | null;
  unsyncedChanges: number;
}

/**
 * Paged fetch for segments and parent entries across two weeks (selected week + previous week).
 */
export async function fetchWeekReviewData(
  params: FetchWeekReviewDataParams
): Promise<WeekReviewFetchedData> {
  const { userId, weekStart } = params;

  // 1. Get settings first to resolve timezone
  const settings = await ensureUserSettings(userId);
  const timeZone = params.timeZone || settings?.timezone || 'America/Phoenix';

  const weekEnd = getNextWeekStart(weekStart, timeZone);
  const previousWeekStart = getPreviousWeekStart(weekStart, timeZone);

  const prevStartIso = previousWeekStart.toISOString();
  const weekEndIso = weekEnd.toISOString();

  // If Supabase is not configured, return empty shell
  if (!isSupabaseConfigured || !userId) {
    const unsynced = await getUnsyncedCount();
    return {
      weekStart,
      weekEnd,
      previousWeekStart,
      segments: [],
      previousSegments: [],
      entries: [],
      earliestEntryDate: null,
      settings,
      unsyncedChanges: unsynced,
    };
  }

  // 2. Fetch segments across 2 weeks with pagination
  const allSegments: WeekSummaryInputSegment[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('segments')
      .select('id, entry_id, start_time, end_time, activity_label, category, confirmed, company')
      .eq('user_id', userId)
      .lt('start_time', weekEndIso)
      .gt('end_time', prevStartIso)
      .order('start_time', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching segments for week review:', error.message);
      throw error;
    }

    if (!data || data.length === 0) break;
    allSegments.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  // 3. Fetch entries across 2 weeks with pagination
  const allEntries: WeekSummaryInputEntry[] = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('entries')
      .select('id, window_start, window_end, parse_status, on_vacation, clarification_question')
      .eq('user_id', userId)
      .lt('window_start', weekEndIso)
      .gt('window_end', prevStartIso)
      .order('window_start', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching entries for week review:', error.message);
      throw error;
    }

    if (!data || data.length === 0) break;
    allEntries.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  // 4. Earliest entry query (to bound navigation)
  const { data: earliestRow } = await supabase
    .from('entries')
    .select('window_start')
    .eq('user_id', userId)
    .order('window_start', { ascending: true })
    .limit(1)
    .maybeSingle();

  const earliestEntryDate = earliestRow?.window_start ? new Date(earliestRow.window_start) : null;

  // 5. Partition segments into selected week and previous week
  const weekStartMs = weekStart.getTime();
  const weekEndMs = weekEnd.getTime();
  const prevStartMs = previousWeekStart.getTime();

  const selectedWeekSegments: WeekSummaryInputSegment[] = [];
  const previousWeekSegments: WeekSummaryInputSegment[] = [];

  for (const seg of allSegments) {
    const sStart = new Date(seg.start_time).getTime();
    const sEnd = new Date(seg.end_time).getTime();

    // Check overlap with selected week
    if (sStart < weekEndMs && sEnd > weekStartMs) {
      selectedWeekSegments.push(seg);
    }
    // Check overlap with previous week
    if (sStart < weekStartMs && sEnd > prevStartMs) {
      previousWeekSegments.push(seg);
    }
  }

  // 6. Check unsynced mutations
  const unsyncedChanges = await getUnsyncedCount();

  return {
    weekStart,
    weekEnd,
    previousWeekStart,
    segments: selectedWeekSegments,
    previousSegments: previousWeekSegments,
    entries: allEntries,
    earliestEntryDate,
    settings,
    unsyncedChanges,
  };
}

async function getUnsyncedCount(): Promise<number> {
  try {
    const q = await getQueue();
    const rq = await getRatingsQueue();
    return q.length + rq.length;
  } catch {
    return 0;
  }
}
