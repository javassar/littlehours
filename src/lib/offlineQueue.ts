import { get, set } from 'idb-keyval';
import { supabase, isSupabaseConfigured } from './supabase.ts';
import { parseEntryInBackground } from './parse.ts';

const QUEUE_STORAGE_KEY = 'littlehours_offline_queue';
const RATINGS_QUEUE_KEY = 'littlehours_offline_ratings_queue';

export interface QueuedEntry {
  id: string;
  user_id: string;
  raw_text: string;
  window_start: string;
  window_end: string;
  parse_status?: 'pending' | 'parsed' | 'needs_clarification' | 'failed';
  follow_ups: any[];
  on_vacation?: boolean;
  created_at: string;
  queued_at: string;
  isQueued?: boolean;
}

export interface QueuedRating {
  id: string;
  user_id: string;
  entry_id?: string | null;
  rating: number;
  rated_at: string;
  created_at: string;
  queued_at: string;
  isQueued?: boolean;
}

// In-memory fallback for environments without IndexedDB (e.g. Node tests)
let memoryQueueFallback: QueuedEntry[] = [];
let memoryRatingsFallback: QueuedRating[] = [];

function hasIndexedDB(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

type QueueListener = (queue: QueuedEntry[]) => void;
const listeners = new Set<QueueListener>();

type RatingsQueueListener = (queue: QueuedRating[]) => void;
const ratingsListeners = new Set<RatingsQueueListener>();

export function subscribeToQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeToRatingsQueue(listener: RatingsQueueListener): () => void {
  ratingsListeners.add(listener);
  return () => {
    ratingsListeners.delete(listener);
  };
}

function notifyListeners(queue: QueuedEntry[]) {
  listeners.forEach((fn) => {
    try {
      fn(queue);
    } catch (err) {
      console.error('Error in queue listener:', err);
    }
  });
}

function notifyRatingsListeners(queue: QueuedRating[]) {
  ratingsListeners.forEach((fn) => {
    try {
      fn(queue);
    } catch (err) {
      console.error('Error in ratings queue listener:', err);
    }
  });
}

/**
 * Get all currently queued offline entries.
 */
export async function getQueue(): Promise<QueuedEntry[]> {
  try {
    if (hasIndexedDB()) {
      const q = await get<QueuedEntry[]>(QUEUE_STORAGE_KEY);
      return q || [];
    }
    return [...memoryQueueFallback];
  } catch (err) {
    console.error('Failed to read IndexedDB queue:', err);
    return [...memoryQueueFallback];
  }
}

/**
 * Save the entire queue array to IndexedDB.
 */
async function saveQueue(queue: QueuedEntry[]): Promise<void> {
  try {
    if (hasIndexedDB()) {
      await set(QUEUE_STORAGE_KEY, queue);
    } else {
      memoryQueueFallback = [...queue];
    }
  } catch (err) {
    console.error('Failed to persist IndexedDB queue:', err);
    memoryQueueFallback = [...queue];
  }
  notifyListeners(queue);
}

/**
 * Add a new entry to the offline queue.
 */
export async function enqueueEntry(entry: Omit<QueuedEntry, 'queued_at' | 'isQueued'>): Promise<void> {
  const queue = await getQueue();
  // Prevent duplicate ID insertion in the queue
  const existingIdx = queue.findIndex((e) => e.id === entry.id);

  const queuedEntry: QueuedEntry = {
    ...entry,
    queued_at: new Date().toISOString(),
    isQueued: true,
  };

  if (existingIdx >= 0) {
    queue[existingIdx] = queuedEntry;
  } else {
    // Newest queued entry at the front
    queue.unshift(queuedEntry);
  }

  await saveQueue(queue);
}

/**
 * Remove an entry from the queue by ID.
 */
export async function dequeueEntry(id: string): Promise<void> {
  const queue = await getQueue();
  const filtered = queue.filter((e) => e.id !== id);
  if (filtered.length !== queue.length) {
    await saveQueue(filtered);
  }
}

/**
 * Milestone 3.7: Get all currently queued offline ratings.
 */
export async function getRatingsQueue(): Promise<QueuedRating[]> {
  try {
    if (hasIndexedDB()) {
      const q = await get<QueuedRating[]>(RATINGS_QUEUE_KEY);
      return q || [];
    }
    return [...memoryRatingsFallback];
  } catch (err) {
    console.error('Failed to read IndexedDB ratings queue:', err);
    return [...memoryRatingsFallback];
  }
}

/**
 * Milestone 3.7: Save the entire ratings queue array to IndexedDB.
 */
async function saveRatingsQueue(queue: QueuedRating[]): Promise<void> {
  try {
    if (hasIndexedDB()) {
      await set(RATINGS_QUEUE_KEY, queue);
    } else {
      memoryRatingsFallback = [...queue];
    }
  } catch (err) {
    console.error('Failed to persist IndexedDB ratings queue:', err);
    memoryRatingsFallback = [...queue];
  }
  notifyRatingsListeners(queue);
}

/**
 * Milestone 3.7: Add a new rating to the offline queue.
 */
export async function enqueueRating(rating: Omit<QueuedRating, 'queued_at' | 'isQueued'>): Promise<void> {
  const queue = await getRatingsQueue();
  const existingIdx = queue.findIndex((r) => r.id === rating.id);

  const queuedRating: QueuedRating = {
    ...rating,
    queued_at: new Date().toISOString(),
    isQueued: true,
  };

  if (existingIdx >= 0) {
    queue[existingIdx] = queuedRating;
  } else {
    queue.unshift(queuedRating);
  }

  await saveRatingsQueue(queue);
}

/**
 * Milestone 3.7: Remove a rating from the queue by ID.
 */
export async function dequeueRating(id: string): Promise<void> {
  const queue = await getRatingsQueue();
  const filtered = queue.filter((r) => r.id !== id);
  if (filtered.length !== queue.length) {
    await saveRatingsQueue(filtered);
  }
}

let isSyncing = false;

/**
 * Sync all queued entries and ratings to Supabase using upsert (so retries never duplicate).
 * Milestone 3.7: Inserts entries first and ratings second, because ratings reference entries.
 */
export async function syncQueue(
  onEntrySynced?: (id: string) => void,
  onRatingSynced?: (id: string) => void
): Promise<{ synced: number; remaining: number }> {
  if (isSyncing) {
    const current = await getQueue();
    const currentRatings = await getRatingsQueue();
    return { synced: 0, remaining: current.length + currentRatings.length };
  }

  // If browser reports offline, don't attempt network call
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const current = await getQueue();
    const currentRatings = await getRatingsQueue();
    return { synced: 0, remaining: current.length + currentRatings.length };
  }

  if (!isSupabaseConfigured) {
    const current = await getQueue();
    const currentRatings = await getRatingsQueue();
    return { synced: 0, remaining: current.length + currentRatings.length };
  }

  isSyncing = true;
  let syncedCount = 0;

  try {
    // 1. Sync entries first (entries are referenced by ratings)
    const queue = await getQueue();
    const remainingQueue: QueuedEntry[] = [];

    for (const entry of queue) {
      try {
        const { error } = await supabase.from('entries').upsert(
          {
            id: entry.id,
            user_id: entry.user_id,
            raw_text: entry.raw_text,
            window_start: entry.window_start,
            window_end: entry.window_end,
            parse_status: entry.parse_status || 'pending',
            follow_ups: entry.follow_ups || [],
            on_vacation: Boolean(entry.on_vacation),
          },
          { onConflict: 'id' }
        );

        if (error) {
          console.error(`Error syncing entry ${entry.id}:`, error.message);
          remainingQueue.push(entry);
        } else {
          syncedCount++;
          // Trigger background AI parsing for the newly synced entry
          parseEntryInBackground(entry.id);
          if (onEntrySynced) {
            onEntrySynced(entry.id);
          }
        }
      } catch (err) {
        console.error(`Network exception syncing entry ${entry.id}:`, err);
        remainingQueue.push(entry);
      }
    }

    await saveQueue(remainingQueue);

    // 2. Sync ratings second (with upsert on ID)
    const ratingsQueue = await getRatingsQueue();
    const remainingRatings: QueuedRating[] = [];

    for (const r of ratingsQueue) {
      try {
        const { error } = await supabase.from('pain_ratings').upsert(
          {
            id: r.id,
            user_id: r.user_id,
            entry_id: r.entry_id || null,
            rating: r.rating,
            rated_at: r.rated_at,
            created_at: r.created_at,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

        if (error) {
          console.error(`Error syncing rating ${r.id}:`, error.message);
          remainingRatings.push(r);
        } else {
          syncedCount++;
          if (onRatingSynced) {
            onRatingSynced(r.id);
          }
        }
      } catch (err) {
        console.error(`Network exception syncing rating ${r.id}:`, err);
        remainingRatings.push(r);
      }
    }

    await saveRatingsQueue(remainingRatings);

    return { synced: syncedCount, remaining: remainingQueue.length + remainingRatings.length };
  } finally {
    isSyncing = false;
  }
}

/**
 * Find the latest window_end among both saved Supabase entries and queued offline entries.
 */
export async function getLatestWindowEnd(userId: string): Promise<Date | null> {
  const queue = await getQueue();
  const userQueue = queue.filter((e) => e.user_id === userId);

  let latestQueuedMs = 0;
  for (const item of userQueue) {
    const ms = new Date(item.window_end).getTime();
    if (ms > latestQueuedMs) {
      latestQueuedMs = ms;
    }
  }

  let latestSupabaseMs = 0;
  if (isSupabaseConfigured && (typeof navigator === 'undefined' || navigator.onLine)) {
    try {
      const { data } = await supabase
        .from('entries')
        .select('window_end')
        .eq('user_id', userId)
        .order('window_end', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.window_end) {
        latestSupabaseMs = new Date(data.window_end).getTime();
      }
    } catch {
      // Offline or network error
    }
  }

  const maxMs = Math.max(latestQueuedMs, latestSupabaseMs);
  return maxMs > 0 ? new Date(maxMs) : null;
}

/**
 * Initialize sync listeners:
 * - Online event
 * - App regain focus / visibilitychange
 * - Periodic 30s interval while queue is not empty
 */
let syncInitialized = false;

export function initOfflineSync(onSynced?: (id: string) => void): () => void {
  if (syncInitialized || typeof window === 'undefined') {
    return () => {};
  }
  syncInitialized = true;

  const trigger = () => {
    syncQueue(onSynced);
  };

  window.addEventListener('online', trigger);
  window.addEventListener('focus', trigger);

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      trigger();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  // Periodic retry every 30s while queue is not empty
  const interval = setInterval(async () => {
    const q = await getQueue();
    const rq = await getRatingsQueue();
    if (q.length > 0 || rq.length > 0) {
      trigger();
    }
  }, 30000);

  // Initial attempt on mount
  trigger();

  return () => {
    window.removeEventListener('online', trigger);
    window.removeEventListener('focus', trigger);
    document.removeEventListener('visibilitychange', handleVisibility);
    clearInterval(interval);
    syncInitialized = false;
  };
}
