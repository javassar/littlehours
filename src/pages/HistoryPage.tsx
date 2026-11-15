import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Deer,
  Toast,
  EntryEditSheet,
  ConfirmationSheet,
  RotatingSparkle,
  EntryItem,
  SegmentItem,
  TrashIcon,
  Chip,
} from '../components';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { retryParseEntry, parseEntryInBackground } from '../lib/parse';
import {
  formatTimeRange,
  formatDuration,
  formatDayHeading,
  getDayKey,
  formatDurationMs,
} from '../lib/time';
import {
  getQueue,
  subscribeToQueue,
  enqueueEntry,
  dequeueEntry,
  QueuedEntry,
} from '../lib/offlineQueue';

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
            created_at,
            segments (
              id,
              entry_id,
              start_time,
              end_time,
              activity_label,
              category,
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
    loadQueued();

    // Subscribe to queue changes so UI refreshes as soon as items sync or are queued
    const unsubscribe = subscribeToQueue(async (updatedQueue) => {
      if (user) {
        setQueuedEntries(updatedQueue.filter((e) => e.user_id === user.id));
        // Refresh server entries to show recently synced items
        fetchEntries(0, false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [fetchEntries, loadQueued, user]);

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
          segments (
            id,
            entry_id,
            start_time,
            end_time,
            activity_label,
            category,
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
    updated: { raw_text: string; window_start: string; window_end: string }
  ) => {
    const isQueued = queuedEntries.some((e) => e.id === id);

    if (isQueued) {
      await enqueueEntry({
        id,
        user_id: user!.id,
        raw_text: updated.raw_text,
        window_start: updated.window_start,
        window_end: updated.window_end,
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
      showToast('Entry deleted');
      return;
    }

    const { error } = await supabase.from('entries').delete().eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    setEntries((prev) => prev.filter((item) => item.id !== id));
    showToast('Entry deleted');
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

  const handleConfirmSegments = async (updatedSegments: SegmentItem[]) => {
    if (!selectedConfirmationEntry) return;

    for (const s of updatedSegments) {
      await supabase
        .from('segments')
        .update({
          activity_label: s.activity_label,
          category: s.category,
          start_time: s.start_time,
          end_time: s.end_time,
          confirmed: true,
        })
        .eq('id', s.id);
    }

    setEntries((prev) =>
      prev.map((e) =>
        e.id === selectedConfirmationEntry.id ? { ...e, segments: updatedSegments } : e
      )
    );
    showToast('Segments confirmed');
  };

  const handleSaveUnconfirmedSegments = async (updatedSegments: SegmentItem[]) => {
    if (!selectedConfirmationEntry) return;

    for (const s of updatedSegments) {
      await supabase
        .from('segments')
        .update({
          activity_label: s.activity_label,
          category: s.category,
          start_time: s.start_time,
          end_time: s.end_time,
          confirmed: false,
        })
        .eq('id', s.id);
    }

    setEntries((prev) =>
      prev.map((e) =>
        e.id === selectedConfirmationEntry.id ? { ...e, segments: updatedSegments } : e
      )
    );
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

  // Empty state with Deer illustration (only if neither server entries nor queued entries exist)
  if (entries.length === 0 && queuedEntries.length === 0) {
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

  // Group synced entries by day in user's timezone
  interface DayGroup {
    heading: string;
    entries: {
      entry: EntryItem;
      indexInAll: number;
    }[];
  }

  const dayGroups: DayGroup[] = [];
  const dayGroupMap = new Map<string, DayGroup>();

  entries.forEach((entry, idx) => {
    const endDate = new Date(entry.window_end);
    const key = getDayKey(endDate, timeZone);

    if (!dayGroupMap.has(key)) {
      const newGroup: DayGroup = {
        heading: formatDayHeading(endDate, timeZone),
        entries: [],
      };
      dayGroupMap.set(key, newGroup);
      dayGroups.push(newGroup);
    }

    dayGroupMap.get(key)!.entries.push({ entry, indexInAll: idx });
  });

  return (
    <div className="page-container screen-fade-in history-page">
      <Toast visible={toastVisible} message={toastMessage} onClose={() => setToastVisible(false)} />

      {/* 1. Queued offline entries shown at the very top with "Waiting to sync" badge */}
      {queuedEntries.length > 0 && (
        <section className="history-day-section history-queued-section">
          <h2 className="history-day-heading" style={{ color: 'var(--mauve)' }}>
            Waiting to sync ({queuedEntries.length})
          </h2>

          <div className="history-entries-list">
            {queuedEntries.map((entry) => {
              const start = new Date(entry.window_start);
              const end = new Date(entry.window_end);
              const rangeStr = formatTimeRange(start, end, timeZone);
              const durationStr = formatDuration(start, end);

              return (
                <Card
                  key={entry.id}
                  ornamental={true}
                  className="history-entry-card history-queued-card"
                  onClick={() => handleCardClick(entry)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCardClick(entry);
                    }
                  }}
                  aria-label={`Entry from ${rangeStr}, waiting to sync. Click to edit.`}
                >
                  <div className="history-card-header">
                    <span className="history-time-range">{rangeStr}</span>

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
          </div>
        </section>
      )}

      {/* 2. Synced history entries grouped by day */}
      {dayGroups.map((group) => (
        <section key={group.heading} className="history-day-section">
          <h2 className="history-day-heading">{group.heading}</h2>

          <div className="history-entries-list">
            {group.entries.map(({ entry, indexInAll }) => {
              const start = new Date(entry.window_start);
              const end = new Date(entry.window_end);
              const rangeStr = formatTimeRange(start, end, timeZone);
              const durationStr = formatDuration(start, end);

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
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCardClick(entry);
                      }
                    }}
                    aria-label={`Entry from ${rangeStr}, ${durationStr}. Click to edit.`}
                  >
                    <div className="history-card-header">
                      <span className="history-time-range">{rangeStr}</span>

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

                    {/* 2.5 Clarification question state */}
                    {entry.parse_status === 'needs_clarification' && entry.clarification_question && (
                      <div
                        className="history-card-clarification"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          marginTop: 6,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span style={{ fontStyle: 'italic', color: 'var(--mauve)', fontSize: 13, flex: 1 }}>
                          {entry.clarification_question}
                        </span>
                        <button
                          type="button"
                          className="history-retry-btn"
                          onClick={() => handleRetryParse(entry.id)}
                          aria-label="Re-evaluate entry with AI"
                        >
                          Re-read
                        </button>
                      </div>
                    )}

                    {/* 3. Parsed segments: time range, label, category chip */}
                    {entry.segments && entry.segments.length > 0 && (
                      <div className="history-card-segments">
                        {entry.segments.map((seg) => {
                          const segStart = new Date(seg.start_time);
                          const segEnd = new Date(seg.end_time);
                          const segRange = formatTimeRange(segStart, segEnd, timeZone);
                          return (
                            <div key={seg.id} className="history-segment-item">
                              <div className="history-segment-left">
                                <span className="history-segment-time">{segRange}</span>
                                <span className="history-segment-label">{seg.activity_label}</span>
                              </div>
                              <Chip label={seg.category} size="sm" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>

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

      {/* Direct Card Delete Confirmation Dialog */}
      {entryToDelete && (
        <div
          className="sheet-backdrop"
          onClick={() => setEntryToDelete(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="sheet-surface"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 360, textAlign: 'center', borderRadius: 24, padding: '24px 20px' }}
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
        onClose={() => {
          setIsConfirmationOpen(false);
          setSelectedConfirmationEntry(null);
        }}
        onConfirm={handleConfirmSegments}
        onSaveUnconfirmed={handleSaveUnconfirmedSegments}
      />

      {/* Edit & Delete sheet */}
      <EntryEditSheet
        entry={selectedEntry}
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedEntry(null);
        }}
        onSave={handleSaveEntry}
        onDelete={handleDeleteEntry}
      />
    </div>
  );
};
