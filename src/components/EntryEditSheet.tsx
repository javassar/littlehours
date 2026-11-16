import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { PainRating } from './PainRating';
import { toDateTimeLocalValue, fromDateTimeLocalValue, formatDuration } from '../lib/time';
import './EntryEditSheet.css';

export interface SegmentItem {
  id: string;
  entry_id: string;
  start_time: string;
  end_time: string;
  activity_label: string;
  category: string;
  confirmed: boolean;
  model?: string;
  prompt_version?: string;
  company?: string[];
}

export interface FollowUpItem {
  question: string;
  answer: string;
  answered_at: string;
}

export interface EntryItem {
  id: string;
  raw_text: string;
  window_start: string;
  window_end: string;
  parse_status?: 'pending' | 'parsed' | 'needs_clarification' | 'failed';
  clarification_question?: string | null;
  follow_ups?: FollowUpItem[];
  segments?: SegmentItem[];
  on_vacation?: boolean;
  created_at: string;
}

export const TrashIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 16,
  color = 'var(--danger)',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

export interface EntryEditSheetProps {
  entry: EntryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    id: string,
    updated: {
      raw_text: string;
      window_start: string;
      window_end: string;
      on_vacation?: boolean;
    }
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  currentRating?: { id: string; rating: number; rated_at: string } | null;
  onSaveRating?: (entryId: string, ratingId: string | undefined, newRating: number | null) => Promise<void>;
}

export const EntryEditSheet: React.FC<EntryEditSheetProps> = ({
  entry,
  isOpen,
  onClose,
  onSave,
  onDelete,
  currentRating,
  onSaveRating,
}) => {
  const [text, setText] = useState('');
  const [startVal, setStartVal] = useState('');
  const [endVal, setEndVal] = useState('');
  const [onVacation, setOnVacation] = useState(false);
  const [ratingVal, setRatingVal] = useState<number | null>(null);
  const [showRatingDeleteConfirm, setShowRatingDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirmation states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [needsLongWindowConfirm, setNeedsLongWindowConfirm] = useState(false);
  const [pendingDuration, setPendingDuration] = useState('');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (entry && isOpen) {
      setText(entry.raw_text);
      setStartVal(toDateTimeLocalValue(new Date(entry.window_start)));
      setEndVal(toDateTimeLocalValue(new Date(entry.window_end)));
      setOnVacation(Boolean(entry.on_vacation));
      setRatingVal(currentRating?.rating ?? null);
      setShowRatingDeleteConfirm(false);
      setError(null);
      setShowDeleteConfirm(false);
      setNeedsLongWindowConfirm(false);
      setPendingDuration('');
    }
  }, [entry, isOpen, currentRating]);

  if (!isOpen || !entry) return null;

  const handleValidateAndSave = async (bypassConfirm = false) => {
    setError(null);

    if (!text.trim()) {
      setError('Entry text cannot be empty.');
      return;
    }

    const s = fromDateTimeLocalValue(startVal);
    const e = fromDateTimeLocalValue(endVal);
    const now = new Date();

    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      setError('Please provide valid start and end dates.');
      return;
    }

    if (e.getTime() <= s.getTime()) {
      setError('The end time must be after the start time.');
      return;
    }

    // Future check (with 1 min grace)
    if (s.getTime() > now.getTime() + 60000 || e.getTime() > now.getTime() + 60000) {
      setError('Logged times cannot be set in the future.');
      return;
    }

    const durationHours = (e.getTime() - s.getTime()) / (1000 * 60 * 60);

    // Rule: if longer than 24 hours, block it
    if (durationHours > 24) {
      setError('A single log window cannot exceed 24 hours.');
      return;
    }

    // Rule: if longer than 12 hours, ask for confirmation
    if (durationHours > 12 && !bypassConfirm) {
      setPendingDuration(formatDuration(s, e));
      setNeedsLongWindowConfirm(true);
      return;
    }

    setSaving(true);
    try {
      await onSave(entry.id, {
        raw_text: text.trim(),
        window_start: s.toISOString(),
        window_end: e.toISOString(),
        on_vacation: onVacation,
      });
      if (onSaveRating && ratingVal !== (currentRating?.rating ?? null)) {
        await onSaveRating(entry.id, currentRating?.id, ratingVal);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to save changes (${msg}). Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  const handleRatingChange = (newVal: number | null) => {
    if (newVal === null && currentRating) {
      setShowRatingDeleteConfirm(true);
      return;
    }
    setRatingVal(newVal);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(entry.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to delete entry (${msg}). Please try again.`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="sheet-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-edit-title"
    >
      <div className="sheet-surface entry-edit-surface" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />

        <div className="entry-sheet-header-row">
          <div>
            <h3 id="entry-edit-title" className="sheet-title" style={{ textAlign: 'left', marginBottom: 2 }}>
              Edit Entry
            </h3>
            <p className="sheet-subtitle" style={{ textAlign: 'left', marginBottom: 16 }}>
              Update your entry text or logged time
            </p>
          </div>

          {!showDeleteConfirm && !needsLongWindowConfirm && (
            <button
              type="button"
              className="entry-sheet-header-trash"
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete this entry"
              aria-label="Delete this entry"
            >
              <TrashIcon size={18} color="var(--danger)" />
              <span className="trash-label">Delete</span>
            </button>
          )}
        </div>

        {error && (
          <div className="sheet-error" role="alert">
            {error}
          </div>
        )}

        {/* Delete confirmation dialog */}
        {showDeleteConfirm ? (
          <div className="entry-delete-confirm-box">
            <p className="entry-delete-confirm-text">
              Delete this entry?
            </p>
            <p className="entry-delete-confirm-sub">
              This action cannot be undone.
            </p>
            <div className="sheet-button-row">
              <Button
                variant="secondary"
                disabled={deleting}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={handleConfirmDelete}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        ) : needsLongWindowConfirm ? (
          /* Long window (>12h) confirmation dialog */
          <div className="sheet-confirm-box">
            <p className="sheet-confirm-text">
              This window is <strong>{pendingDuration}</strong> long. Would you like to keep this time range?
            </p>
            <div className="sheet-button-row">
              <Button variant="secondary" onClick={() => setNeedsLongWindowConfirm(false)}>
                Go Back
              </Button>
              <Button onClick={() => handleValidateAndSave(true)}>
                Yes, Keep It
              </Button>
            </div>
          </div>
        ) : (
          /* Main edit form */
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleValidateAndSave();
            }}
          >
            {/* Text editor */}
            <div className="sheet-field" style={{ marginBottom: 14 }}>
              <label className="sheet-label" htmlFor="entry-edit-text">
                What you did
              </label>
              <textarea
                id="entry-edit-text"
                name="raw_text"
                className="time-log-textarea entry-edit-textarea"
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            {/* Start time */}
            <div className="sheet-field">
              <label className="sheet-label" htmlFor="entry-edit-start">
                Start Time
              </label>
              <input
                id="entry-edit-start"
                name="window_start"
                type="datetime-local"
                className="sheet-datetime-input"
                value={startVal}
                onChange={(e) => {
                  setStartVal(e.target.value);
                  setError(null);
                }}
                max={toDateTimeLocalValue(new Date())}
                required
                disabled={saving}
              />
            </div>

            {/* End time */}
            <div className="sheet-field" style={{ marginTop: 12 }}>
              <label className="sheet-label" htmlFor="entry-edit-end">
                End Time
              </label>
              <input
                id="entry-edit-end"
                name="window_end"
                type="datetime-local"
                className="sheet-datetime-input"
                value={endVal}
                onChange={(e) => {
                  setEndVal(e.target.value);
                  setError(null);
                }}
                max={toDateTimeLocalValue(new Date())}
                required
                disabled={saving}
              />
            </div>

            {/* On vacation switch (Milestone 3.7) */}
            <div
              className="sheet-field"
              style={{
                marginTop: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'var(--surface-sunk)',
                borderRadius: 'var(--radius-input)',
              }}
            >
              <div>
                <label
                  className="sheet-label"
                  htmlFor="entry-edit-vacation"
                  style={{ marginBottom: 2, cursor: 'pointer', display: 'block' }}
                >
                  On vacation
                </label>
                <span style={{ fontSize: 12, color: 'var(--mauve)', display: 'block' }}>
                  Marks entry as vacation time and re-evaluates segments
                </span>
              </div>
              <input
                id="entry-edit-vacation"
                name="on_vacation"
                type="checkbox"
                className="reminders-switch-input"
                checked={onVacation}
                onChange={(e) => setOnVacation(e.target.checked)}
                disabled={saving}
                aria-label="On vacation"
              />
            </div>

            {/* Milestone 3.7: Rating edit in entry sheet */}
            {(currentRating || ratingVal !== null) && (
              <div
                className="sheet-field"
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(184, 114, 127, 0.2)',
                }}
              >
                <PainRating
                  value={ratingVal}
                  onChange={handleRatingChange}
                  disabled={saving}
                />
              </div>
            )}

            {showRatingDeleteConfirm && (
              <div className="entry-delete-confirm-box" style={{ marginTop: 12 }}>
                <p className="entry-delete-confirm-text">Delete this rating?</p>
                <p className="entry-delete-confirm-sub">Clearing the rating will remove it.</p>
                <div className="sheet-button-row">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setShowRatingDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    type="button"
                    onClick={() => {
                      setRatingVal(null);
                      setShowRatingDeleteConfirm(false);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}

            <div className="sheet-actions" style={{ marginTop: 22 }}>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>

            {/* Explicit Destructive Delete Button */}
            <div style={{ marginTop: 16 }}>
              <Button
                type="button"
                variant="destructive"
                fullWidth
                disabled={saving}
                onClick={() => setShowDeleteConfirm(true)}
              >
                <TrashIcon size={16} color="var(--danger)" />
                <span>Delete this entry</span>
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
