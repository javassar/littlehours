import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, SparkleBurst, Toast, WindowEditSheet } from '../components';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatWindowSince, formatTime, formatDuration } from '../lib/time';

const DRAFT_STORAGE_KEY = 'littlehours_draft_entry';

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
  const { user } = useAuth();

  // Draft text in localStorage
  const [text, setText] = useState<string>(() => {
    return localStorage.getItem(DRAFT_STORAGE_KEY) || '';
  });

  // Time window states
  // Default window start is 1 hour before now until latest entry is loaded
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // 2. Fetch latest entry to determine window_start and last log line
  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    async function fetchLatestEntry() {
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
          setDefaultStart(new Date(data.window_end));
          setLastEntry(data);
        } else if (isMounted) {
          // If no entries yet, default to one hour before now
          setDefaultStart(new Date(Date.now() - 60 * 60 * 1000));
        }
      } catch (err) {
        console.error('Failed to load latest entry:', err);
      }
    }

    fetchLatestEntry();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Handle textarea text change and draft persistence
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
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

  // Apply custom window from edit sheet
  const handleApplyWindow = (newStart: Date, newEnd: Date) => {
    setCustomWindow({ start: newStart, end: newEnd });
  };

  // Save entry
  const handleSave = async () => {
    if (isSaving || !text.trim() || !user) return;

    setIsSaving(true);
    setSaveError(null);

    const startToSave = customWindow ? customWindow.start : defaultStart;
    const endToSave = customWindow ? customWindow.end : new Date();

    const entryId = crypto.randomUUID();

    try {
      const { error } = await supabase.from('entries').insert({
        id: entryId,
        user_id: user.id,
        raw_text: text.trim(),
        window_start: startToSave.toISOString(),
        window_end: endToSave.toISOString(),
        parse_status: 'pending',
        follow_ups: [],
      });

      if (error) {
        setSaveError('We could not save your entry right now. Please check your connection and try again.');
        setIsSaving(false);
        return;
      }

      // 1. Clear text and draft
      setText('');
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      if (textareaRef.current) {
        textareaRef.current.style.height = '120px';
      }

      // 2. Advance default window start to this entry's end
      setDefaultStart(endToSave);
      setCustomWindow(null);

      // 3. Update last log line
      setLastEntry({
        window_start: startToSave.toISOString(),
        window_end: endToSave.toISOString(),
        raw_text: text.trim(),
      });

      // 4. Trigger animations (sparkle burst and toast)
      setSparkleActive(true);
      setToastVisible(true);

      setTimeout(() => {
        setSparkleActive(false);
      }, 700);

      // Re-focus textarea for seamless next entry
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSaveError(`We could not save your entry (${message}). Please try again.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container screen-fade-in log-page">
      <Toast visible={toastVisible} onClose={() => setToastVisible(false)} />

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
            onClick={() => setCustomWindow(null)}
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
        <textarea
          ref={textareaRef}
          className="time-log-textarea main-log-textarea"
          placeholder="How did you spend that time?"
          value={text}
          onChange={handleTextChange}
          disabled={isSaving}
          rows={3}
          aria-label="How did you spend that time?"
        />

        <div className="log-button-wrap">
          <div style={{ position: 'relative', width: '100%' }}>
            <Button
              fullWidth
              onClick={handleSave}
              disabled={!text.trim() || isSaving}
              aria-label={isSaving ? 'Saving entry...' : 'Save Entry'}
            >
              {isSaving ? 'Saving...' : 'Save'}
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
      />
    </div>
  );
};
