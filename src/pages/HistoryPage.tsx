import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  Deer,
  Toast,
  EntryEditSheet,
  ConfirmationSheet,
  FollowUpCard,
  RotatingSparkle,
  EntryItem,
  SegmentItem,
  FollowUpItem,
  TrashIcon,
  Chip,
  RatingEditSheet,
  RatingItem,
  ModalPortal,
} from '../components';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { retryParseEntry, parseEntryInBackground } from '../lib/parse';
import { getPainWord } from '../lib/painScale';
import {
  formatTimeRange,
  formatDuration,
  formatDayHeading,
  getDayKey,
  formatDurationMs,
  formatTime,
} from '../lib/time';
import {
  getQueue,
  subscribeToQueue,
  enqueueEntry,
  dequeueEntry,
  QueuedEntry,
  getRatingsQueue,
  subscribeToRatingsQueue,
  dequeueRating,
  QueuedRating,
} from '../lib/offlineQueue';
import { OverlapAdjustmentsPayload } from '../lib/overlap';

const PAGE_SIZE = 30;

export const HistoryPage: React.FC = () => {
  const { user, settings } = useAuth();
  const timeZone = settings?.timezone || 'America/Phoenix';

  const [entries, setEntries] = useState<EntryItem[]>([]);
  const [queuedEntries, setQueuedEntries] = useState<QueuedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Milestone 3.7: Pain ratings state
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [queuedRatings, setQueuedRatings] = useState<QueuedRating[]>([]);
  const [selectedRating, setSelectedRating] = useState<RatingItem | null>(null);
  const [isRatingEditOpen, setIsRatingEditOpen] = useState(false);

  // Edit sheet state
  const [selectedEntry, setSelectedEntry] = useState<EntryItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Confirmation sheet state (Milestone 2.3)
  const [selectedConfirmationEntry, setSelectedConfirmationEntry] = useState<EntryItem | null>(null);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  // Direct card delete confirmation dialog state
  const [entryToDelete, setEntryToDelete] = useState<EntryItem | null>(null);
  const [isDeletingDirect, setIsDeletingDirect] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
  };

  // Load offline queue
  const loadQueued = useCallback(async () => {
    if (!user) return;
    try {
      const q = await getQueue();
      setQueuedEntries(q.filter((e) => e.user_id === user.id));
    } catch (err) {
      console.error('Failed to load queued entries in History:', err);
    }
  }, [user]);

  // Milestone 3.7: Load offline queued ratings
  const loadQueuedRatings = useCallback(async () => {
    if (!user) return;
    try {
      const q = await getRatingsQueue();
      setQueuedRatings(q.filter((r) => r.user_id === user.id));
    } catch (err) {
      console.error('Failed to load queued ratings in History:', err);
    }
  }, [user]);

  // Milestone 3.7: Fetch pain ratings from Supabase
  const fetchRatings = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('pain_ratings')
        .select('id, entry_id, rating, rated_at, created_at')
        .eq('user_id', user.id)
        .order('rated_at', { ascending: false });

      if (error) {
        console.warn('Could not load pain ratings (table may not exist yet):', error.message);
        return;
      }
      if (data) {
        setRatings(data);
      }
    } catch (err) {
      console.error('Failed to load pain ratings in History:', err);
    }
  }, [user]);

  // Fetch entries from Supabase
  const fetchEntries = useCallback(
    async (fromOffset = 0, isInitial = false) => {
      if (!user) return;
      if (isInitial) setLoading(true);

      try {
        const { data, error } = await supabase
          .from('entries')
          .select(`
            id,
            raw_text,
            window_start,
            window_end,
            parse_status,
            clarification_question,
            follow_ups,
            on_vacation,
            created_at,
            segments (
              id,
              entry_id,
              start_time,
              end_time,
              activity_label,
              category,
              company,
              confirmed,
              model,
              prompt_version
            )
          `)
          .eq('user_id', user.id)
          .order('window_end', { ascending: false })
          .range(fromOffset, fromOffset + PAGE_SIZE - 1);

        if (error) {
          console.error('Error loading history entries:', error.message);
          return;
        }

        const newRows = (data || []).map((e: any) => ({
          ...e,
          segments: Array.isArray(e.segments)
            ? e.segments.sort(
                (a: any, b: any) =>
                  new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
              )
            : [],
        })) as EntryItem[];
        console.log('History entries loaded from Supabase:', newRows);
        setHasMore(newRows.length === PAGE_SIZE);

        if (fromOffset === 0) {
          setEntries(newRows);
        } else {
          setEntries((prev) => [...prev, ...newRows]);
        }
        setOffset(fromOffset + newRows.length);
      } catch (err) {
        console.error('Failed to load history entries:', err);
      } finally {
        if (isInitial) setLoading(false);
        setLoadingEarlier(false);
      }
    },
    [user]
  );

  useEffect(() => {
    fetchEntries(0, true);
    fetchRatings();
    loadQueued();
    loadQueuedRatings();

    // Subscribe to entries queue changes so UI refreshes as soon as items sync or are queued
    const unsubscribeQueue = subscribeToQueue(async (updatedQueue) => {
      if (user) {
        setQueuedEntries(updatedQueue.filter((e) => e.user_id === user.id));
        // Refresh server entries to show recently synced items
        fetchEntries(0, false);
      }
    });

    // Subscribe to ratings queue changes
    const unsubscribeRatings = subscribeToRatingsQueue(async (updatedRatingsQueue) => {
      if (user) {
        setQueuedRatings(updatedRatingsQueue.filter((r) => r.user_id === user.id));
        fetchRatings();
      }
    });

    return () => {
      unsubscribeQueue();
      unsubscribeRatings();
    };
  }, [fetchEntries, fetchRatings, loadQueued, loadQueuedRatings, user]);

  // Poll for background AI parsing updates whenever any entry has parse_status === 'pending'
  useEffect(() => {
    const hasPending = entries.some((e) => e.parse_status === 'pending');
    if (!hasPending || !user) return;

    const timer = setInterval(async () => {
      const pendingIds = entries.filter((e) => e.parse_status === 'pending').map((e) => e.id);
      if (pendingIds.length === 0) return;

      const { data, error } = await supabase
        .from('entries')
        .select(`
          id,
          parse_status,
          clarification_question,
          follow_ups,
          on_vacation,
          segments (
            id,
            entry_id,
            start_time,
            end_time,
            activity_label,
            category,
            company,
            confirmed,
            model,
            prompt_version
          )
        `)
        .in('id', pendingIds);

      if (error || !data) return;

      setEntries((prev) =>
        prev.map((item) => {
          const updated = data.find((d: any) => d.id === item.id);
          if (updated && updated.parse_status !== item.parse_status) {
            return {
              ...item,
              parse_status: updated.parse_status,
              clarification_question: updated.clarification_question,
              follow_ups: updated.follow_ups || item.follow_ups || [],
              segments: Array.isArray(updated.segments)
                ? (updated.segments as any[]).sort(
                    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
                  )
                : [],
            };
          }
          return item;
        })
      );
    }, 2500);

    return () => clearInterval(timer);
  }, [entries, user]);

  const handleRetryParse = async (entryId: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, parse_status: 'pending' } : e))
    );
    showToast('Reading your entry...');
    await retryParseEntry(entryId);
  };

  // Load next page
  const handleLoadEarlier = async () => {
    setLoadingEarlier(true);
    await fetchEntries(offset, false);
  };

  // Handle entry edit save (supports both queued offline and synced entries)
  const handleSaveEntry = async (
    id: string,
    updated: { raw_text: string; window_start: string; window_end: string; on_vacation?: boolean }
  ) => {
    const isQueued = queuedEntries.some((e) => e.id === id);

    if (isQueued) {
      await enqueueEntry({
        id,
        user_id: user!.id,
        raw_text: updated.raw_text,
        window_start: updated.window_start,
        window_end: updated.window_end,
        on_vacation: Boolean(updated.on_vacation),
        parse_status: 'pending',
        follow_ups: [],
        created_at: new Date().toISOString(),
      });
      await loadQueued();
      showToast('Changes saved');
      return;
    }

    const { error } = await supabase
      .from('entries')
      .update({
        raw_text: updated.raw_text,
        window_start: updated.window_start,
        window_end: updated.window_end,
        on_vacation: Boolean(updated.on_vacation),
        parse_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    setEntries((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...updated, parse_status: 'pending' } : item
      )
    );
    showToast('Changes saved. Re-reading entry...');
    parseEntryInBackground(id);
  };

  // Handle entry delete (supports both queued offline and synced entries)
  const handleDeleteEntry = async (id: string) => {
    const isQueued = queuedEntries.some((e) => e.id === id);

    if (isQueued) {
      await dequeueEntry(id);
      await loadQueued();
      // Milestone 3.7: Deleting an entry leaves its rating in place as a standalone rating card
      setQueuedRatings((prev) =>
        prev.map((r) => (r.entry_id === id ? { ...r, entry_id: null } : r))
      );
      showToast('Entry deleted');
      return;
    }

    const { error } = await supabase.from('entries').delete().eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    // Milestone 3.7: Postgres foreign key 'on delete set null' keeps the rating.
    // Update local state immediately so it displays as standalone rating card.
    setRatings((prev) =>
      prev.map((r) => (r.entry_id === id ? { ...r, entry_id: null } : r))
    );
    setEntries((prev) => prev.filter((item) => item.id !== id));
    showToast('Entry deleted');
  };

  // Milestone 3.7: Handle standalone rating edit save
  const handleSaveStandaloneRating = async (id: string, newRating: number, newRatedAt: string) => {
    const isQueued = queuedRatings.some((r) => r.id === id);

    if (isQueued) {
      const q = await getRatingsQueue();
      const updatedQ = q.map((r) =>
        r.id === id ? { ...r, rating: newRating, rated_at: newRatedAt } : r
      );
      setQueuedRatings(updatedQ.filter((r) => r.user_id === user?.id));
      showToast('Rating updated');
      return;
    }

    const { error } = await supabase
      .from('pain_ratings')
      .update({
        rating: newRating,
        rated_at: newRatedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    setRatings((prev) =>
      prev.map((r) => (r.id === id ? { ...r, rating: newRating, rated_at: newRatedAt } : r))
    );
    showToast('Rating updated');
  };

  // Milestone 3.7: Handle rating delete
  const handleDeleteRating = async (id: string) => {
    const isQueued = queuedRatings.some((r) => r.id === id);

    if (isQueued) {
      await dequeueRating(id);
      await loadQueuedRatings();
      showToast('Rating deleted');
      return;
    }

    const { error } = await supabase.from('pain_ratings').delete().eq('id', id);
    if (error) {
      throw new Error(error.message);
    }

    setRatings((prev) => prev.filter((r) => r.id !== id));
    showToast('Rating deleted');
  };

  // Milestone 3.7: Save rating from EntryEditSheet
  const handleSaveRatingForEntry = async (
    entryId: string,
    ratingId: string | undefined,
    newRating: number | null
  ) => {
    if (newRating === null) {
      if (ratingId) {
        await handleDeleteRating(ratingId);
      }
      return;
    }

    if (ratingId) {
      const { error } = await supabase
        .from('pain_ratings')
        .update({
          rating: newRating,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ratingId);

      if (error) {
        throw new Error(error.message);
      }

      setRatings((prev) =>
        prev.map((r) => (r.id === ratingId ? { ...r, rating: newRating } : r))
      );
      showToast('Rating updated');
    } else {
      const entry = entries.find((e) => e.id === entryId);
      const ratedAt = entry?.window_end || new Date().toISOString();
      const newId = crypto.randomUUID();
      const payload: RatingItem = {
        id: newId,
        entry_id: entryId,
        rating: newRating,
        rated_at: ratedAt,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('pain_ratings').insert({
        ...payload,
        user_id: user!.id,
      });

      if (error) {
        throw new Error(error.message);
      }

      setRatings((prev) => [payload, ...prev]);
      showToast('Rating saved');
    }
  };

  // Open edit sheet or confirmation sheet
  const handleCardClick = (entry: EntryItem) => {
    if (entry.segments && entry.segments.length > 0) {
      setSelectedConfirmationEntry(entry);
      setIsConfirmationOpen(true);
      return;
    }
    setSelectedEntry(entry);
    setIsEditOpen(true);
  };

  // Milestone 2.5: Gather all existing segments from other entries to check for overlaps
  const allExistingSegments = useMemo(() => {
    const list: SegmentItem[] = [];
    for (const e of entries) {
      if (Array.isArray(e.segments)) {
        list.push(...e.segments);
      }
    }
    return list;
  }, [entries]);

  // Milestone 3.7: Combine queued ratings and server ratings
  const allRatings = useMemo(() => {
    return [
      ...queuedRatings.map((r) => ({ ...r, isQueued: true })),
      ...ratings,
    ];
  }, [queuedRatings, ratings]);

  const standaloneRatings = useMemo(() => {
    const allEntryIds = new Set([
      ...entries.map((e) => e.id),
      ...queuedEntries.map((e) => e.id),
    ]);
    return allRatings.filter((r) => !r.entry_id || !allEntryIds.has(r.entry_id));
  }, [allRatings, entries, queuedEntries]);


  const handleConfirmSegments = async (
    updatedSegments: SegmentItem[],
    overlapPayload?: OverlapAdjustmentsPayload
  ) => {
    if (!selectedConfirmationEntry || !user) return;

    const entryId = selectedConfirmationEntry.id;
    const firstCat = settings?.categories?.[0];
    const defaultCat = (typeof firstCat === 'object' ? (firstCat as any).name : firstCat) || 'work';

    const newSegmentsPayload = updatedSegments.map((s) => ({
      id: s.id || crypto.randomUUID(),
      entry_id: entryId,
      activity_label: (s.activity_label || 'unlabeled').trim().toLowerCase(),
      category: s.category || defaultCat,
      company: Array.isArray(s.company) ? s.company : [],
      start_time: s.start_time,
      end_time: s.end_time,
      confirmed: true,
      model: s.model || 'manual',
      prompt_version: s.prompt_version || 'v2',
    }));

    // Milestone 2.5: Apply new segments and adjustments in one database transaction via Postgres RPC
    const { error: rpcErr } = await supabase.rpc('apply_segments_with_adjustments', {
      p_entry_id: entryId,
      p_new_segments: newSegmentsPayload,
      p_adjustments: overlapPayload || {},
    });

    if (rpcErr) {
      console.error('Error applying segments with adjustments:', rpcErr);
      showToast(`Error saving segments: ${rpcErr.message}`);
      return;
    }

    // Refresh history entries from database to reflect all updated segments
    await fetchEntries(0, false);
    showToast('Segments confirmed');
  };

  const handleSaveUnconfirmedSegments = async (updatedSegments: SegmentItem[]) => {
    if (!selectedConfirmationEntry || !user) return;

    const entryId = selectedConfirmationEntry.id;
    const firstCat = settings?.categories?.[0];
    const defaultCat = (typeof firstCat === 'object' ? (firstCat as any).name : firstCat) || 'work';

    await supabase.from('segments').delete().eq('entry_id', entryId);
    const toInsert = updatedSegments.map((s) => ({
      id: s.id || crypto.randomUUID(),
      entry_id: entryId,
      user_id: user.id,
      activity_label: (s.activity_label || 'unlabeled').trim().toLowerCase(),
      category: s.category || defaultCat,
      company: Array.isArray(s.company) ? s.company : [],
      start_time: s.start_time,
      end_time: s.end_time,
      confirmed: false,
      model: s.model || 'manual',
      prompt_version: s.prompt_version || 'v2',
    }));

    await supabase.from('segments').insert(toInsert);

    await supabase
      .from('entries')
      .update({
        parse_status: 'parsed',
        clarification_question: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId);

    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, parse_status: 'parsed', clarification_question: null, segments: toInsert }
          : e
      )
    );
  };

  // Milestone 2.4: Save follow-up answer (never touches raw_text) and re-evaluates
  const handleAnswerFollowUp = async (entryId: string, question: string, answer: string) => {
    if (!user) return;
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;

    const newFollowUp: FollowUpItem = {
      question,
      answer,
      answered_at: new Date().toISOString(),
    };
    const updatedFollowUps = [...(entry.follow_ups || []), newFollowUp];

    // Important: Save answer in entries.follow_ups. Do not touch raw_text!
    const { error } = await supabase
      .from('entries')
      .update({
        follow_ups: updatedFollowUps,
        parse_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId);

    if (error) {
      showToast(`Error saving answer: ${error.message}`);
      return;
    }

    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, follow_ups: updatedFollowUps, parse_status: 'pending' }
          : e
      )
    );

    showToast('Answer saved. Re-evaluating with AI...');
    parseEntryInBackground(entryId);
  };

  // Milestone 2.4: "Fix it by hand" opens segment editor with one empty row covering the window
  const handleFixByHand = (entry: EntryItem) => {
    const firstCat = settings?.categories?.[0];
    const defaultCat = (typeof firstCat === 'object' ? (firstCat as any).name : firstCat) || 'work';
    const emptyRow: SegmentItem = {
      id: crypto.randomUUID(),
      entry_id: entry.id,
      start_time: entry.window_start,
      end_time: entry.window_end,
      activity_label: '',
      category: defaultCat,
      confirmed: false,
    };

    setSelectedConfirmationEntry({
      ...entry,
      segments: [emptyRow],
    });
    setIsConfirmationOpen(true);
  };

  if (loading) {
    return (
      <div className="page-container screen-fade-in" style={{ textAlign: 'center', paddingTop: 60 }}>
        <RotatingSparkle size={32} color="var(--gold)" />
        <p style={{ marginTop: 12, color: 'var(--mauve)', fontStyle: 'italic', fontFamily: 'var(--font-display)', fontSize: 18 }}>
          Reading your history...
        </p>
      </div>
    );
  }


  // Empty state with Deer illustration (only if neither entries nor ratings exist)
  if (entries.length === 0 && queuedEntries.length === 0 && allRatings.length === 0) {
    return (
      <div className="page-container screen-fade-in">
        <div className="empty-history-state">
          <Deer size={110} />
          <p className="empty-history-text">
            Nothing logged yet. Your first entry will appear here.
          </p>
        </div>
      </div>
    );
  }

  // Milestone 3.7: Group entries and standalone ratings by day in user's timezone
  type DayGroupItem =
    | { kind: 'entry'; entry: EntryItem; indexInAll: number; timestamp: number }
    | { kind: 'rating'; rating: RatingItem; timestamp: number };

  interface DayGroup {
    heading: string;
    items: DayGroupItem[];
    ratingCount: number;
  }

  const dayGroups: DayGroup[] = [];
  const dayGroupMap = new Map<string, DayGroup>();

  // 1. Add entries to day groups
  entries.forEach((entry, idx) => {
    const endDate = new Date(entry.window_end);
    const key = getDayKey(endDate, timeZone);

    if (!dayGroupMap.has(key)) {
      const newGroup: DayGroup = {
        heading: formatDayHeading(endDate, timeZone),
        items: [],
        ratingCount: 0,
      };
      dayGroupMap.set(key, newGroup);
      dayGroups.push(newGroup);
    }

    dayGroupMap.get(key)!.items.push({
      kind: 'entry',
      entry,
      indexInAll: idx,
      timestamp: endDate.getTime(),
    });
  });

  // 2. Add standalone ratings (synced ones appear in day lists; queued standalone appear in Waiting to sync)
  standaloneRatings
    .filter((r) => !r.isQueued)
    .forEach((rating) => {
      const ratedAtDate = new Date(rating.rated_at);
      const key = getDayKey(ratedAtDate, timeZone);

      if (!dayGroupMap.has(key)) {
        const newGroup: DayGroup = {
          heading: formatDayHeading(ratedAtDate, timeZone),
          items: [],
          ratingCount: 0,
        };
        dayGroupMap.set(key, newGroup);
        dayGroups.push(newGroup);
      }

      dayGroupMap.get(key)!.items.push({
        kind: 'rating',
        rating,
        timestamp: ratedAtDate.getTime(),
      });
    });

  // Sort day groups chronologically (most recent day first)
  dayGroups.sort((a, b) => {
    const maxA = Math.max(...a.items.map((i) => i.timestamp), 0);
    const maxB = Math.max(...b.items.map((i) => i.timestamp), 0);
    return maxB - maxA;
  });

  // For each day group, sort items newest first and compute ratingCount for the day
  dayGroups.forEach((group) => {
    group.items.sort((a, b) => b.timestamp - a.timestamp);

    // Compute ratingCount: total ratings whose rated_at falls on this day
    let count = 0;
    allRatings.forEach((r) => {
      const rDay = formatDayHeading(new Date(r.rated_at), timeZone);
      if (rDay === group.heading) {
        count++;
      }
    });
    group.ratingCount = count;
  });

  return (
    <>
      <div className="page-container screen-fade-in history-page">
      <Toast visible={toastVisible} message={toastMessage} onClose={() => setToastVisible(false)} />

      {/* 1. Queued offline entries and ratings shown at the very top with "Waiting to sync" badge */}
      {(queuedEntries.length > 0 || queuedRatings.filter((r) => !r.entry_id).length > 0) && (
        <section className="history-day-section history-queued-section">
          <h2 className="history-day-heading" style={{ color: 'var(--mauve)' }}>
            Waiting to sync ({queuedEntries.length + queuedRatings.filter((r) => !r.entry_id).length})
          </h2>

          <div className="history-entries-list">
            {/* Queued entries */}
            {queuedEntries.map((entry) => {
              const start = new Date(entry.window_start);
              const end = new Date(entry.window_end);
              const rangeStr = formatTimeRange(start, end, timeZone);
              const durationStr = formatDuration(start, end);
              const linkedQueuedRating = allRatings.find((r) => r.entry_id === entry.id);

              return (
                <Card
                  key={entry.id}
                  ornamental={true}
                  className="history-entry-card history-queued-card"
                  onClick={() => handleCardClick(entry)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCardClick(entry);
                    }
                  }}
                  aria-label={`Entry from ${rangeStr}, waiting to sync. Click to edit.`}
                >
                  <div className="history-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="history-time-range">{rangeStr}</span>
                      {linkedQueuedRating && (
                        <button
                          type="button"
                          className="entry-pain-pill"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRating(linkedQueuedRating);
                            setIsRatingEditOpen(true);
                          }}
                          title="Click to edit rating"
                          aria-label={`Pain ${linkedQueuedRating.rating}. Click to edit.`}
                        >
                          Pain {linkedQueuedRating.rating}
                        </button>
                      )}
                    </div>

                    <div className="history-card-header-actions">
                      <span className="history-duration-badge">{durationStr}</span>
                      <span className="history-waiting-badge">
                        <span className="waiting-pulse-dot" />
                        Waiting to sync
                      </span>
                      <button
                        type="button"
                        className="history-card-trash-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEntryToDelete(entry);
                        }}
                        aria-label="Delete this queued entry"
                        title="Delete this entry"
                      >
                        <TrashIcon size={15} color="var(--danger)" />
                      </button>
                    </div>
                  </div>

                  <p className="history-card-text">{entry.raw_text}</p>
                </Card>
              );
            })}

            {/* Queued standalone ratings */}
            {queuedRatings
              .filter((r) => !r.entry_id || !queuedEntries.some((e) => e.id === r.entry_id))
              .map((r) => {
                const ratedDate = new Date(r.rated_at);
                const hourStartDate = new Date(ratedDate.getTime() - 60 * 60 * 1000);
                const coverage = `${formatTime(hourStartDate, timeZone)} to ${formatTime(ratedDate, timeZone)}`;
                const word = getPainWord(r.rating);

                return (
                  <Card
                    key={r.id}
                    ornamental={true}
                    className="history-rating-card history-queued-card"
                    onClick={() => {
                      setSelectedRating(r);
                      setIsRatingEditOpen(true);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedRating(r);
                        setIsRatingEditOpen(true);
                      }
                    }}
                    aria-label={`Pain rating ${r.rating}, ${word} for ${coverage}, waiting to sync. Click to edit.`}
                  >
                    <div className="history-rating-card-row">
                      <span className="history-rating-card-time">{coverage}</span>
                      <div className="history-rating-card-badges">
                        <span className="entry-pain-pill">Pain {r.rating}</span>
                        {word && <span className="history-rating-word">{word}</span>}
                        <span className="history-waiting-badge">
                          <span className="waiting-pulse-dot" />
                          Waiting to sync
                        </span>
                        <button
                          type="button"
                          className="history-card-trash-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRating(r.id);
                          }}
                          aria-label="Delete this queued rating"
                          title="Delete this rating"
                        >
                          <TrashIcon size={15} color="var(--danger)" />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
          </div>
        </section>
      )}

      {/* 2. Synced history entries & standalone ratings grouped by day */}
      {dayGroups.map((group) => (
        <section key={group.heading} className="history-day-section">
          <h2 className="history-day-heading">
            <span>{group.heading}</span>
            {group.ratingCount > 0 && (
              <span className="history-day-ratings-count">
                {group.ratingCount} {group.ratingCount === 1 ? 'rating' : 'ratings'}
              </span>
            )}
          </h2>

          <div className="history-entries-list">
            {group.items.map((item) => {
              if (item.kind === 'rating') {
                const r = item.rating;
                const ratedDate = new Date(r.rated_at);
                const hourStartDate = new Date(ratedDate.getTime() - 60 * 60 * 1000);
                const coverage = `${formatTime(hourStartDate, timeZone)} to ${formatTime(ratedDate, timeZone)}`;
                const word = getPainWord(r.rating);

                return (
                  <Card
                    key={r.id}
                    ornamental={true}
                    className="history-rating-card"
                    onClick={() => {
                      setSelectedRating(r);
                      setIsRatingEditOpen(true);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedRating(r);
                        setIsRatingEditOpen(true);
                      }
                    }}
                    aria-label={`Pain rating ${r.rating}, ${word} for ${coverage}. Click to edit.`}
                  >
                    <div className="history-rating-card-row">
                      <span className="history-rating-card-time">{coverage}</span>
                      <div className="history-rating-card-badges">
                        <span className="entry-pain-pill">Pain {r.rating}</span>
                        {word && <span className="history-rating-word">{word}</span>}
                      </div>
                    </div>
                  </Card>
                );
              }

              // item.kind === 'entry'
              const entry = item.entry;
              const indexInAll = item.indexInAll;
              const start = new Date(entry.window_start);
              const end = new Date(entry.window_end);
              const rangeStr = formatTimeRange(start, end, timeZone);
              const durationStr = formatDuration(start, end);
              const linkedRating = allRatings.find((r) => r.entry_id === entry.id);

              // Check gap or overlap with the chronologically earlier entry (indexInAll + 1)
              const nextEntry = entries[indexInAll + 1];
              let gapDurationStr: string | null = null;
              let isOverlap = false;

              if (nextEntry) {
                const nextEndMs = new Date(nextEntry.window_end).getTime();
                const currentStartMs = start.getTime();
                const diffMs = currentStartMs - nextEndMs;

                if (diffMs > 60 * 1000) {
                  // Unlogged gap (> 1 minute)
                  gapDurationStr = formatDurationMs(diffMs);
                } else if (diffMs < -60 * 1000) {
                  // Overlap (> 1 minute)
                  isOverlap = true;
                }
              }

              return (
                <React.Fragment key={entry.id}>
                  <Card
                    ornamental={true}
                    className="history-entry-card"
                    onClick={() => handleCardClick(entry)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCardClick(entry);
                      }
                    }}
                    aria-label={`Entry from ${rangeStr}, ${durationStr}. Click to edit.`}
                  >
                    <div className="history-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="history-time-range">{rangeStr}</span>
                        {linkedRating && (
                          <button
                            type="button"
                            className="entry-pain-pill"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRating(linkedRating);
                              setIsRatingEditOpen(true);
                            }}
                            title="Click to edit rating"
                            aria-label={`Pain ${linkedRating.rating}. Click to edit.`}
                          >
                            Pain {linkedRating.rating}
                          </button>
                        )}
                      </div>

                      <div className="history-card-header-actions">
                        <span className="history-duration-badge">{durationStr}</span>
                        {entry.segments &&
                          entry.segments.length > 0 &&
                          entry.segments.some((s) => !s.confirmed) && (
                            <span
                              className="history-unchecked-badge"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedConfirmationEntry(entry);
                                setIsConfirmationOpen(true);
                              }}
                              title="Unconfirmed segments: click to review"
                            >
                              Unchecked
                            </span>
                          )}
                        <button
                          type="button"
                          className="history-card-trash-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEntryToDelete(entry);
                          }}
                          aria-label="Delete this entry"
                          title="Delete this entry"
                        >
                          <TrashIcon size={15} color="var(--danger)" />
                        </button>
                      </div>
                    </div>

                    <p className="history-card-text">{entry.raw_text}</p>

                    {/* 1. Pending parsing state: rotating sparkle + "Reading your entry" */}
                    {entry.parse_status === 'pending' && (
                      <div className="history-card-parsing" aria-label="Reading your entry">
                        <RotatingSparkle size={15} color="var(--mauve)" />
                        <span className="history-parsing-text">Reading your entry</span>
                      </div>
                    )}

                    {/* 2. Failed parsing state: "I couldn't read that one" + Try again button */}
                    {entry.parse_status === 'failed' && (
                      <div className="history-card-failed" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                          <span className="history-failed-text">I couldn't read that one</span>
                          {entry.clarification_question && (
                            <span style={{ fontSize: 11, color: 'var(--mauve)', fontStyle: 'normal', opacity: 0.85, wordBreak: 'break-word' }}>
                              {entry.clarification_question.slice(0, 90)}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="history-retry-btn"
                          onClick={() => handleRetryParse(entry.id)}
                        >
                          Try again
                        </button>
                      </div>
                    )}

                    {/* 3. Parsed segments: time range, label, company chips, category chip */}
                    {entry.segments && entry.segments.length > 0 && (
                      <div className="history-card-segments">
                        {entry.segments.map((seg) => {
                          const segStart = new Date(seg.start_time);
                          const segEnd = new Date(seg.end_time);
                          const segRange = formatTimeRange(segStart, segEnd, timeZone);
                          const isVacation = seg.category === 'vacation' || entry.on_vacation;
                          return (
                            <div key={seg.id} className="history-segment-item">
                              <div className="history-segment-left">
                                <span className="history-segment-time">{segRange}</span>
                                <span className="history-segment-label">{seg.activity_label}</span>
                              </div>
                              <div className="history-segment-chips">
                                {Array.isArray(seg.company) &&
                                  seg.company.map((person) => (
                                    <span key={person} className="company-chip">
                                      {person}
                                    </span>
                                  ))}
                                <Chip label={seg.category} size="sm" />
                                {isVacation && seg.category !== 'vacation' && (
                                  <Chip label="vacation" size="sm" tint="sage" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>

                  {/* 2.5 Clarification question state: Milestone 2.4 FollowUpCard under the entry */}
                  {entry.parse_status === 'needs_clarification' && (
                    <FollowUpCard
                      entry={entry}
                      onAnswer={handleAnswerFollowUp}
                      onFixByHand={handleFixByHand}
                    />
                  )}

                  {/* Overlap note */}
                  {isOverlap && (
                    <div className="history-overlap-note" aria-label="Overlaps the entry above">
                      <span className="history-overlap-bullet">✦</span>
                      <span>Overlaps the entry above</span>
                    </div>
                  )}

                  {/* Dotted unlogged gap line */}
                  {gapDurationStr && (
                    <div className="history-gap-indicator" aria-label={`Not logged: ${gapDurationStr}`}>
                      <div className="history-gap-line" />
                      <span className="history-gap-label">Not logged: {gapDurationStr}</span>
                      <div className="history-gap-line" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </section>
      ))}

      {/* Show earlier button (pagination) */}
      {hasMore && (
        <div className="history-load-more">
          <Button
            variant="secondary"
            fullWidth
            onClick={handleLoadEarlier}
            disabled={loadingEarlier}
          >
            {loadingEarlier ? 'Loading earlier entries...' : 'Show earlier'}
          </Button>
        </div>
      )}
      </div>

      {/* Direct Card Delete Confirmation Dialog */}
      {entryToDelete && (
        <ModalPortal>
          <div
            className="sheet-backdrop"
            onClick={() => setEntryToDelete(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="sheet-surface"
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 360, textAlign: 'center', borderRadius: 24, padding: '24px 20px' }}
            >
              <div className="entry-delete-confirm-box" style={{ margin: 0 }}>
                <p className="entry-delete-confirm-text">Delete this entry?</p>
                <p className="entry-delete-confirm-sub">This action cannot be undone.</p>
                <div className="sheet-button-row">
                  <Button
                    variant="secondary"
                    disabled={isDeletingDirect}
                    onClick={() => setEntryToDelete(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={isDeletingDirect}
                    onClick={async () => {
                      setIsDeletingDirect(true);
                      await handleDeleteEntry(entryToDelete.id);
                      setIsDeletingDirect(false);
                      setEntryToDelete(null);
                    }}
                  >
                    {isDeletingDirect ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Confirmation sheet for segments (Milestone 2.3) */}
      <ConfirmationSheet
        isOpen={isConfirmationOpen}
        entryId={selectedConfirmationEntry?.id || ''}
        rawText={selectedConfirmationEntry?.raw_text}
        initialSegments={selectedConfirmationEntry?.segments || []}
        categories={
          settings?.categories || [
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
          ]
        }
        timeZone={timeZone}
        existingSegments={allExistingSegments}
        onClose={() => {
          setIsConfirmationOpen(false);
          setSelectedConfirmationEntry(null);
        }}
        onConfirm={handleConfirmSegments}
        onSaveUnconfirmed={handleSaveUnconfirmedSegments}
        onEditEntry={() => {
          if (selectedConfirmationEntry) {
            setSelectedEntry(selectedConfirmationEntry);
            setIsConfirmationOpen(false);
            setSelectedConfirmationEntry(null);
            setIsEditOpen(true);
          }
        }}
      />

      {/* Edit & Delete sheet for entries */}
      <EntryEditSheet
        entry={selectedEntry}
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedEntry(null);
        }}
        onSave={handleSaveEntry}
        onDelete={handleDeleteEntry}
        currentRating={
          selectedEntry
            ? allRatings.find((r) => r.entry_id === selectedEntry.id) || null
            : null
        }
        onSaveRating={handleSaveRatingForEntry}
      />

      {/* Standalone Rating Edit & Delete sheet (Milestone 3.7) */}
      <RatingEditSheet
        isOpen={isRatingEditOpen}
        rating={selectedRating}
        onClose={() => {
          setIsRatingEditOpen(false);
          setSelectedRating(null);
        }}
        onSave={handleSaveStandaloneRating}
        onDelete={handleDeleteRating}
        timeZone={timeZone}
      />
    </>
  );
};
