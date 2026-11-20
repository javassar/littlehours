import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Card,
  Button,
  SparkleBurst,
  Toast,
  WindowEditSheet,
  ConfirmationSheet,
  SegmentItem,
  PainRating,
} from '../components';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatWindowSince, formatTime, formatDuration } from '../lib/time';
import {
  enqueueEntry,
  enqueueRating,
  getLatestWindowEnd,
  getQueue,
  subscribeToQueue,
} from '../lib/offlineQueue';
import { parseEntryInBackground } from '../lib/parse';
import { STARTER_CATEGORIES } from '../lib/settings';
import { OverlapAdjustmentsPayload } from '../lib/overlap';
import { DEMO_MAX_TEXT_CHARS } from '../lib/demoConfig';

const DRAFT_STORAGE_KEY = 'littlehours_draft_entry';
const SPARKLE_BURST_DURATION_MS = 1500;

interface LastEntrySummary {
  window_start: string;
  window_end: string;
  raw_text: string;
}

const PencilIcon: React.FC = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ marginLeft: 6, flexShrink: 0 }}
  >
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

export const LogPage: React.FC = () => {
  const { user, settings } = useAuth();
  const categories = settings?.categories || STARTER_CATEGORIES;
  const timeZone = settings?.timezone || 'America/Phoenix';

  // Draft text in localStorage
  const [text, setText] = useState<string>(() => {
    return localStorage.getItem(DRAFT_STORAGE_KEY) || '';
  });

  // Time window states:
  // Default window start accounts for queued entries, using latest end time among saved and queued
  const [defaultStart, setDefaultStart] = useState<Date>(() => new Date(Date.now() - 60 * 60 * 1000));
  const [customWindow, setCustomWindow] = useState<{ start: Date; end: Date } | null>(null);

  // Last log summary
  const [lastEntry, setLastEntry] = useState<LastEntrySummary | null>(null);

  // UI interaction states
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sparkleActive, setSparkleActive] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('Saved');

  // Vacation mode state (read from settings, Milestone 3.7)
  const [vacationMode, setVacationModeState] = useState<boolean>(Boolean(settings?.vacation_mode));

  // Milestone 3.7: Hourly pain rating (1 to 5)
  const [painRating, setPainRating] = useState<number | null>(null);
  const [customRatedAt, setCustomRatedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (settings?.vacation_mode !== undefined) {
      setVacationModeState(Boolean(settings.vacation_mode));
    }
  }, [settings?.vacation_mode]);

  // Confirmation sheet state (Milestone 2.3 & 2.5)
  const [confirmationEntry, setConfirmationEntry] = useState<{
    id: string;
    raw_text: string;
    segments: SegmentItem[];
  } | null>(null);
  const [existingSegments, setExistingSegments] = useState<SegmentItem[]>([]);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Milestone 3.2: Focus textarea when opened with /?focus=1 from push notification
  useEffect(() => {
    if (searchParams.get('focus') === '1') {
      textareaRef.current?.focus();
      searchParams.delete('focus');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Milestone 3.2: Focus textarea when service worker notifies of window focus
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICK_FOCUS') {
        textareaRef.current?.focus();
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, []);

  // Auto-resize textarea to fit content
  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(120, el.scrollHeight)}px`;
    }
  };

  // 1. Focus textarea on mount and adjust height
  useEffect(() => {
    textareaRef.current?.focus();
    adjustTextareaHeight();
  }, []);

  // 2. Fetch latest window end among saved and queued entries
  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    async function loadLatest() {
      // Account for queued entries: latest end time among saved and queued
      const latestEnd = await getLatestWindowEnd(user!.id);
      if (!isMounted) return;

      if (latestEnd) {
        setDefaultStart(latestEnd);
      } else {
        setDefaultStart(new Date(Date.now() - 60 * 60 * 1000));
      }

      // Check last entry from offline queue first
      const queue = await getQueue();
      const userQueue = queue.filter((e) => e.user_id === user!.id);
      if (userQueue.length > 0) {
        const latestQ = userQueue[0];
        setLastEntry({
          window_start: latestQ.window_start,
          window_end: latestQ.window_end,
          raw_text: latestQ.raw_text,
        });
        return;
      }

      // Otherwise fetch latest saved from Supabase
      try {
        const { data, error } = await supabase
          .from('entries')
          .select('window_start, window_end, raw_text')
          .eq('user_id', user!.id)
          .order('window_end', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error fetching latest entry:', error.message);
          return;
        }

        if (isMounted && data) {
          setLastEntry(data);
        }
      } catch (err) {
        console.error('Failed to load latest entry:', err);
      }
    }

    loadLatest();

    // Subscribe to queue changes so defaultStart stays synchronized
    const unsubscribe = subscribeToQueue(async () => {
      if (!isMounted) return;
      const latestEnd = await getLatestWindowEnd(user!.id);
      if (latestEnd) {
        setDefaultStart(latestEnd);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user]);

  const isAnonymous = Boolean(user?.is_anonymous);

  // Handle textarea text change and draft persistence
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let val = e.target.value;
    if (isAnonymous && val.length > DEMO_MAX_TEXT_CHARS) {
      val = val.slice(0, DEMO_MAX_TEXT_CHARS);
    }
    setText(val);
    localStorage.setItem(DRAFT_STORAGE_KEY, val);
    adjustTextareaHeight();
  };

  // Determine current active window range
  const currentStart = customWindow ? customWindow.start : defaultStart;
  const currentEnd = customWindow ? customWindow.end : new Date();

  // Window label for pill button
  const windowLabel = customWindow
    ? `${formatTime(customWindow.start)} – ${formatTime(customWindow.end)}`
    : formatWindowSince(defaultStart);

  // Apply custom window and optional custom rated_at from edit sheet
  const handleApplyWindow = (newStart: Date, newEnd: Date, newRatedAt?: Date) => {
    setCustomWindow({ start: newStart, end: newEnd });
    if (newRatedAt) {
      setCustomRatedAt(newRatedAt);
    }
  };

  // Poll for background AI parse completion to open confirmation sheet
  const pollForParseCompletion = (id: string, entryRawText: string) => {
    let attempts = 0;
    const maxAttempts = 15; // up to ~30 seconds
    const interval = setInterval(async () => {
      attempts += 1;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        return;
      }

      try {
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
              confirmed
            )
          `)
          .eq('id', id)
          .single();

        if (error || !data) {
          console.warn(`[Poll attempt ${attempts}] error:`, error?.message);
          return;
        }

        console.log(`[Poll attempt ${attempts}] parse_status: ${data.parse_status}, segments: ${data.segments?.length || 0}`);

        if (data.parse_status === 'pending' && data.clarification_question === 'demo_limit') {
          clearInterval(interval);
          console.log('[Poll] Entry hit demo limit');
          setToastMessage('Not read: demo limit reached.');
          setToastVisible(true);
        } else if (data.parse_status === 'parsed') {
          clearInterval(interval);
          if (Array.isArray(data.segments) && data.segments.length > 0) {
            const sorted = [...data.segments].sort(
              (a: any, b: any) =>
                new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
            );

            // Fetch other segments to check for overlaps (Milestone 2.5)
            try {
              const { data: otherSegs } = await supabase
                .from('segments')
                .select('id, entry_id, start_time, end_time, activity_label, category, confirmed, model, prompt_version')
                .neq('entry_id', data.id)
                .order('start_time', { ascending: false })
                .limit(100);

              if (otherSegs) setExistingSegments(otherSegs as any[]);
            } catch (err) {
              console.warn('Could not load existing segments for overlap check:', err);
            }

            console.log('Opening Review Segments sheet with segments:', sorted);
            setConfirmationEntry({
              id: data.id,
              raw_text: entryRawText,
              segments: sorted,
            });
            setIsConfirmationOpen(true);
          }
        } else if (data.parse_status === 'needs_clarification') {
          clearInterval(interval);
          console.log('[Poll] Entry needs clarification:', data.clarification_question);
          setToastMessage(`Needs clarification: ${data.clarification_question || 'See History'}`);
          setToastVisible(true);
        } else if (data.parse_status === 'failed') {
          clearInterval(interval);
          console.log('[Poll] Entry failed to parse:', data.clarification_question);
        }
      } catch (err) {
        console.warn('[Poll] exception:', err);
      }
    }, 2000);
  };

  // Save entry and/or pain rating (handles both online save and offline queue)
  const handleSave = async () => {
    const hasText = Boolean(text.trim());
    const hasRating = painRating !== null;

    if (isSaving || (!hasText && !hasRating) || !user) return;

    setIsSaving(true);
    setSaveError(null);

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    // Case 1: Rating ONLY (no text)
    if (!hasText && hasRating) {
      const ratingId = crypto.randomUUID();
      const ratedAtDate = customRatedAt || new Date();
      const ratingPayload = {
        id: ratingId,
        user_id: user.id,
        entry_id: null,
        rating: painRating!,
        rated_at: ratedAtDate.toISOString(),
        created_at: new Date().toISOString(),
      };

      if (isOffline) {
        await enqueueRating(ratingPayload);
        setPainRating(null);
        setCustomRatedAt(null);
        setToastMessage('Saved rating (waiting to sync)');
        setSparkleActive(true);
        setToastVisible(true);
        setTimeout(() => setSparkleActive(false), SPARKLE_BURST_DURATION_MS);
        setIsSaving(false);
        return;
      }

      try {
        const { error } = await supabase.from('pain_ratings').insert(ratingPayload);
        if (error) {
          const isNetworkErr =
            error.message?.toLowerCase().includes('failed to fetch') ||
            error.message?.toLowerCase().includes('network') ||
            !navigator.onLine;

          if (isNetworkErr) {
            await enqueueRating(ratingPayload);
            setToastMessage('Saved rating (waiting to sync)');
          } else {
            setSaveError('We could not save your rating right now. Please try again.');
            setIsSaving(false);
            return;
          }
        } else {
          setToastMessage('Saved');
        }

        setPainRating(null);
        setCustomRatedAt(null);
        setSparkleActive(true);
        setToastVisible(true);
        setTimeout(() => setSparkleActive(false), SPARKLE_BURST_DURATION_MS);
      } catch {
        await enqueueRating(ratingPayload);
        setPainRating(null);
        setCustomRatedAt(null);
        setToastMessage('Saved rating (waiting to sync)');
        setSparkleActive(true);
        setToastVisible(true);
        setTimeout(() => setSparkleActive(false), SPARKLE_BURST_DURATION_MS);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Case 2: Text present (with or without rating)
    const startToSave = customWindow ? customWindow.start : defaultStart;
    const endToSave = customWindow ? customWindow.end : new Date();
    const entryId = crypto.randomUUID();
    const rawText = text.trim();

    console.log('[Save] Saving entry with window:', {
      start: startToSave.toISOString(),
      end: endToSave.toISOString(),
      durationMinutes: Math.round((endToSave.getTime() - startToSave.getTime()) / 60000),
      rawText,
      hasRating,
    });

    const entryPayload = {
      id: entryId,
      user_id: user.id,
      raw_text: rawText,
      window_start: startToSave.toISOString(),
      window_end: endToSave.toISOString(),
      parse_status: 'pending' as const,
      follow_ups: [],
      on_vacation: Boolean(vacationMode),
      created_at: new Date().toISOString(),
    };

    let ratingPayload: any = null;
    if (hasRating) {
      const ratingId = crypto.randomUUID();
      const ratedAtDate = customRatedAt || endToSave;
      ratingPayload = {
        id: ratingId,
        user_id: user.id,
        entry_id: entryId,
        rating: painRating!,
        rated_at: ratedAtDate.toISOString(),
        created_at: new Date().toISOString(),
      };
    }

    const finalizeSave = (wasOffline: boolean) => {
      setText('');
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      if (textareaRef.current) {
        textareaRef.current.style.height = '120px';
      }

      setDefaultStart(endToSave);
      setCustomWindow(null);
      setPainRating(null);
      setCustomRatedAt(null);

      setLastEntry({
        window_start: startToSave.toISOString(),
        window_end: endToSave.toISOString(),
        raw_text: rawText,
      });

      setToastMessage(wasOffline ? 'Saved (waiting to sync)' : 'Saved');
      setSparkleActive(true);
      setToastVisible(true);

      setTimeout(() => {
        setSparkleActive(false);
      }, SPARKLE_BURST_DURATION_MS);

      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    };

    if (isOffline) {
      // Store in IndexedDB (entry first, rating second)
      await enqueueEntry(entryPayload);
      if (ratingPayload) {
        await enqueueRating(ratingPayload);
      }
      finalizeSave(true);
      setIsSaving(false);
      return;
    }

    try {
      const { error } = await supabase.from('entries').insert(entryPayload);

      if (error) {
        const isNetworkErr =
          error.message?.toLowerCase().includes('failed to fetch') ||
          error.message?.toLowerCase().includes('network') ||
          !navigator.onLine;

        if (isNetworkErr) {
          await enqueueEntry(entryPayload);
          if (ratingPayload) {
            await enqueueRating(ratingPayload);
          }
          finalizeSave(true);
        } else {
          setSaveError('We could not save your entry right now. Please check your connection and try again.');
        }
        setIsSaving(false);
        return;
      }

      // If entry saved online and we have a rating, insert rating
      if (ratingPayload) {
        const { error: ratingErr } = await supabase.from('pain_ratings').insert(ratingPayload);
        if (ratingErr) {
          console.warn('Could not save rating online, enqueuing for sync:', ratingErr.message);
          await enqueueRating(ratingPayload);
        }
      }

      finalizeSave(false);
      // Background AI parsing: saving never waits for it (pain rating NEVER sent to AI)
      parseEntryInBackground(entryId);
      // Listen for parse completion to show confirmation sheet
      pollForParseCompletion(entryId, rawText);
    } catch {
      // Network exception during fetch
      await enqueueEntry(entryPayload);
      if (ratingPayload) {
        await enqueueRating(ratingPayload);
      }
      finalizeSave(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmSegments = async (
    updatedSegments: SegmentItem[],
    overlapPayload?: OverlapAdjustmentsPayload
  ) => {
    if (!confirmationEntry || !user) return;

    const entryId = confirmationEntry.id;
    const defaultCat = settings?.categories?.[0] || 'work';

    const newSegmentsPayload = updatedSegments.map((s) => ({
      id: s.id || crypto.randomUUID(),
      entry_id: entryId,
      activity_label: (s.activity_label || 'unlabeled').trim().toLowerCase(),
      category: s.category || defaultCat,
      start_time: s.start_time,
      end_time: s.end_time,
      confirmed: true,
      model: s.model || 'manual',
      prompt_version: s.prompt_version || 'v2',
      company: Array.isArray(s.company) ? s.company : [],
    }));

    // Milestone 2.5: Apply new segments and adjustments in one database transaction via Postgres RPC
    const { error: rpcErr } = await supabase.rpc('apply_segments_with_adjustments', {
      p_entry_id: entryId,
      p_new_segments: newSegmentsPayload,
      p_adjustments: overlapPayload || {},
    });

    if (rpcErr) {
      console.error('Error applying segments with adjustments:', rpcErr);
      setToastMessage(`Error confirming: ${rpcErr.message}`);
      setToastVisible(true);
      return;
    }

    setToastMessage('Segments confirmed');
    setToastVisible(true);
    setIsConfirmationOpen(false);
    setConfirmationEntry(null);
  };

  const handleSaveUnconfirmedSegments = async (updatedSegments: SegmentItem[]) => {
    if (!confirmationEntry) return;

    for (const s of updatedSegments) {
      await supabase
        .from('segments')
        .update({
          activity_label: s.activity_label,
          category: s.category,
          start_time: s.start_time,
          end_time: s.end_time,
          company: Array.isArray(s.company) ? s.company : [],
          confirmed: false,
        })
        .eq('id', s.id);
    }

    setIsConfirmationOpen(false);
    setConfirmationEntry(null);
  };

  return (
    <div className="page-container screen-fade-in log-page">
      <Toast visible={toastVisible} message={toastMessage} onClose={() => setToastVisible(false)} />

      {/* Vacation mode ribbon (Milestone 3.7) */}
      {vacationMode && (
        <div className="vacation-mode-ribbon" role="status" aria-label="Vacation mode is active">
          ✦ Vacation mode is on
        </div>
      )}

      {/* Window indicator with pencil icon */}
      <div className="log-window-header">
        <button
          type="button"
          className={`window-pill-button ${customWindow ? 'window-pill-custom' : ''}`}
          onClick={() => setIsSheetOpen(true)}
          title="Edit time window"
          aria-label={`Time window: ${windowLabel}. Click to edit.`}
        >
          <span>{windowLabel}</span>
          <PencilIcon />
        </button>

        {customWindow && (
          <button
            type="button"
            className="window-reset-link"
            onClick={() => {
              setCustomWindow(null);
              setCustomRatedAt(null);
            }}
          >
            Reset
          </button>
        )}
      </div>

      {saveError && (
        <div className="log-save-error" role="alert">
          {saveError}
        </div>
      )}

      {/* Main text box inside ornamental card */}
      <Card ornamental={true} className="log-input-card">
        <h2 id="prompt-label" className="prompt-label">
          How did you spend your time?
        </h2>
        <textarea
          ref={textareaRef}
          className="time-log-textarea main-log-textarea"
          placeholder="I was reading a fairy tale, then worked on the garden..."
          value={text}
          onChange={handleTextChange}
          disabled={isSaving}
          rows={3}
          maxLength={isAnonymous ? DEMO_MAX_TEXT_CHARS : undefined}
          aria-label="How did you spend your time?"
        />

        {isAnonymous && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--mauve)',
              textAlign: 'right',
              marginTop: 4,
              marginBottom: 4,
            }}
          >
            {text.length} / {DEMO_MAX_TEXT_CHARS}
          </div>
        )}

        {/* Milestone 3.7: PainRating directly below textarea and above Save button */}
        <div className="log-pain-rating-wrap" style={{ margin: '8px 0 14px 0' }}>
          <PainRating
            value={painRating}
            onChange={setPainRating}
            disabled={isSaving}
          />
        </div>

        <div className="log-button-wrap">
          <div style={{ position: 'relative', width: '100%' }}>
            <Button
              fullWidth
              onClick={handleSave}
              disabled={(!text.trim() && painRating === null) || isSaving}
              aria-label={
                isSaving
                  ? text.trim()
                    ? 'Saving entry...'
                    : 'Saving rating...'
                  : text.trim()
                  ? 'Save Entry'
                  : 'Save Rating'
              }
            >
              {isSaving
                ? text.trim()
                  ? 'Saving...'
                  : 'Saving rating...'
                : text.trim()
                ? 'Save'
                : 'Save rating'}
            </Button>
            <SparkleBurst active={sparkleActive} />
          </div>
        </div>
      </Card>

      {/* Last log summary line */}
      {lastEntry && (
        <div className="last-log-line">
          <span className="last-log-meta">
            Last log: {formatTime(new Date(lastEntry.window_end))} (
            {formatDuration(new Date(lastEntry.window_start), new Date(lastEntry.window_end))})
          </span>
          <span className="last-log-separator">·</span>
          <span className="last-log-text">
            "{lastEntry.raw_text.length > 40
              ? `${lastEntry.raw_text.slice(0, 40)}…`
              : lastEntry.raw_text}"
          </span>
        </div>
      )}

      {/* Window edit sheet */}
      <WindowEditSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        currentStart={currentStart}
        currentEnd={currentEnd}
        onApply={handleApplyWindow}
        hasSelectedRating={painRating !== null}
        currentRatedAt={customRatedAt || undefined}
        timeZone={timeZone}
      />

      {/* Confirmation bottom sheet for newly parsed entry (Milestone 2.3) */}
      {confirmationEntry && (
        <ConfirmationSheet
          isOpen={isConfirmationOpen}
          entryId={confirmationEntry.id}
          rawText={confirmationEntry.raw_text}
          initialSegments={confirmationEntry.segments}
          categories={categories}
          timeZone={timeZone}
          existingSegments={existingSegments}
          onClose={() => {
            setIsConfirmationOpen(false);
            setConfirmationEntry(null);
          }}
          onConfirm={handleConfirmSegments}
          onSaveUnconfirmed={handleSaveUnconfirmedSegments}
        />
      )}
    </div>
  );
};
