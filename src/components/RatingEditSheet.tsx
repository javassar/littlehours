import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { PainRating } from './PainRating';
import { TrashIcon } from './EntryEditSheet';
import {
  toDateTimeLocalValue,
  fromDateTimeLocalValue,
  formatTime,
} from '../lib/time';
import './RatingEditSheet.css';

export interface RatingItem {
  id: string;
  rating: number;
  rated_at: string;
  entry_id?: string | null;
  created_at?: string;
  isQueued?: boolean;
}

export interface RatingEditSheetProps {
  isOpen: boolean;
  rating: RatingItem | null;
  onClose: () => void;
  onSave: (id: string, newRating: number, newRatedAt: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  timeZone?: string;
}

export const RatingEditSheet: React.FC<RatingEditSheetProps> = ({
  isOpen,
  rating,
  onClose,
  onSave,
  onDelete,
  timeZone = 'America/Phoenix',
}) => {
  const [currentRating, setCurrentRating] = useState<number | null>(null);
  const [ratedAtVal, setRatedAtVal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (rating && isOpen) {
      setCurrentRating(rating.rating);
      setRatedAtVal(toDateTimeLocalValue(new Date(rating.rated_at)));
      setError(null);
      setShowDeleteConfirm(false);
    }
  }, [rating, isOpen]);

  if (!isOpen || !rating) return null;

  const handleValidateAndSave = async () => {
    setError(null);

    if (currentRating === null) {
      setError('Please select a pain rating between 1 and 5.');
      return;
    }

    const d = fromDateTimeLocalValue(ratedAtVal);
    const now = new Date();

    if (isNaN(d.getTime())) {
      setError('Please provide a valid hour end time.');
      return;
    }

    if (d.getTime() > now.getTime() + 60000) {
      setError('Hour ends at cannot be set in the future.');
      return;
    }

    if (now.getTime() - d.getTime() > 24 * 60 * 60 * 1000) {
      setError('Hour ends at cannot be more than 24 hours in the past.');
      return;
    }

    setSaving(true);
    try {
      await onSave(rating.id, currentRating, d.toISOString());
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to save rating: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(rating.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to delete rating: ${msg}`);
    } finally {
      setDeleting(false);
    }
  };

  const currentRatedAtDate = ratedAtVal ? fromDateTimeLocalValue(ratedAtVal) : null;
  const hourCoverageText =
    currentRatedAtDate && !isNaN(currentRatedAtDate.getTime())
      ? `Rates ${formatTime(
          new Date(currentRatedAtDate.getTime() - 60 * 60 * 1000),
          timeZone
        )} to ${formatTime(currentRatedAtDate, timeZone)}`
      : null;

  return (
    <div
      className="sheet-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rating-edit-title"
    >
      <div className="sheet-surface rating-edit-surface" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />

        <div className="entry-sheet-header-row">
          <div>
            <h3 id="rating-edit-title" className="sheet-title" style={{ textAlign: 'left', marginBottom: 2 }}>
              Edit Pain Rating
            </h3>
            <p className="sheet-subtitle" style={{ textAlign: 'left', marginBottom: 16 }}>
              Update the rating score or hour covered
            </p>
          </div>

          {!showDeleteConfirm && (
            <button
              type="button"
              className="entry-sheet-header-trash"
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete this rating"
              aria-label="Delete this rating"
            >
              <TrashIcon size={18} color="var(--danger)" />
              <span className="trash-label">Delete</span>
            </button>
          )}
        </div>

        {error && (
          <div className="sheet-error" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        {showDeleteConfirm ? (
          <div className="entry-delete-confirm-box">
            <p className="entry-delete-confirm-text">Delete this rating?</p>
            <p className="entry-delete-confirm-sub">This action cannot be undone.</p>
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
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleValidateAndSave();
            }}
          >
            {/* Rating selector */}
            <div style={{ margin: '8px 0 16px 0' }}>
              <PainRating
                value={currentRating}
                onChange={setCurrentRating}
                disabled={saving}
              />
            </div>

            {/* Hour ends at input */}
            <div className="sheet-field" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="sheet-label" htmlFor="rating-hour-ends-at">
                  Hour ends at
                </label>
                <button
                  type="button"
                  className="sheet-inline-link"
                  onClick={() => setRatedAtVal(toDateTimeLocalValue(new Date()))}
                >
                  Set to now
                </button>
              </div>
              <input
                id="rating-hour-ends-at"
                type="datetime-local"
                className="sheet-datetime-input"
                value={ratedAtVal}
                onChange={(e) => {
                  setRatedAtVal(e.target.value);
                  setError(null);
                }}
                max={toDateTimeLocalValue(new Date())}
                required
                disabled={saving}
              />
              {hourCoverageText && (
                <span style={{ fontSize: 12, color: 'var(--mauve)', display: 'block', marginTop: 4 }}>
                  {hourCoverageText}
                </span>
              )}
            </div>

            <div className="sheet-actions" style={{ marginTop: 22 }}>
              <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || currentRating === null}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>

            <div style={{ marginTop: 16 }}>
              <Button
                type="button"
                variant="destructive"
                fullWidth
                disabled={saving}
                onClick={() => setShowDeleteConfirm(true)}
              >
                <TrashIcon size={16} color="var(--danger)" />
                <span>Delete this rating</span>
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
