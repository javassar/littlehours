import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { toDateTimeLocalValue, fromDateTimeLocalValue, formatDuration, formatTime } from '../lib/time';
import './WindowEditSheet.css';

export interface WindowEditSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentStart: Date;
  currentEnd: Date;
  onApply: (newStart: Date, newEnd: Date, newRatedAt?: Date) => void;
  hasSelectedRating?: boolean;
  currentRatedAt?: Date;
  timeZone?: string;
}

export const WindowEditSheet: React.FC<WindowEditSheetProps> = ({
  isOpen,
  onClose,
  currentStart,
  currentEnd,
  onApply,
  hasSelectedRating = false,
  currentRatedAt,
  timeZone = 'America/Phoenix',
}) => {
  const [startVal, setStartVal] = useState('');
  const [endVal, setEndVal] = useState('');
  const [ratedAtVal, setRatedAtVal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [pendingDuration, setPendingDuration] = useState('');

  // Reset values when sheet opens
  useEffect(() => {
    if (isOpen) {
      setStartVal(toDateTimeLocalValue(currentStart));
      setEndVal(toDateTimeLocalValue(currentEnd));
      setRatedAtVal(toDateTimeLocalValue(currentRatedAt || new Date()));
      setError(null);
      setNeedsConfirmation(false);
      setPendingDuration('');
    }
  }, [isOpen, currentStart, currentEnd, currentRatedAt]);

  if (!isOpen) return null;

  const handleValidateAndSave = (bypassConfirm = false) => {
    setError(null);

    const s = fromDateTimeLocalValue(startVal);
    const e = fromDateTimeLocalValue(endVal);
    const now = new Date();

    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      setError('Please provide valid start and end dates and times.');
      return;
    }

    if (e.getTime() <= s.getTime()) {
      setError('The end time must be after the start time.');
      return;
    }

    // Check future times (allow 1 minute grace for second ticks)
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

    let parsedRatedAt: Date | undefined;
    if (hasSelectedRating && ratedAtVal) {
      parsedRatedAt = fromDateTimeLocalValue(ratedAtVal);
      if (isNaN(parsedRatedAt.getTime())) {
        setError('Please provide a valid hour end time for your rating.');
        return;
      }
      if (parsedRatedAt.getTime() > now.getTime() + 60000) {
        setError('Hour ends at cannot be set in the future.');
        return;
      }
      if (now.getTime() - parsedRatedAt.getTime() > 24 * 60 * 60 * 1000) {
        setError('Hour ends at cannot be more than 24 hours in the past.');
        return;
      }
    }

    // Rule: if longer than 12 hours, ask for confirmation
    if (durationHours > 12 && !bypassConfirm) {
      setPendingDuration(formatDuration(s, e));
      setNeedsConfirmation(true);
      return;
    }

    onApply(s, e, parsedRatedAt);
    onClose();
  };

  const handleResetToCurrentTime = () => {
    setEndVal(toDateTimeLocalValue(new Date()));
  };

  const handleResetRatedAtToNow = () => {
    setRatedAtVal(toDateTimeLocalValue(new Date()));
  };

  // Compute description of hour covered
  const currentRatedAtDate = ratedAtVal ? fromDateTimeLocalValue(ratedAtVal) : null;
  const hourCoverageText = currentRatedAtDate && !isNaN(currentRatedAtDate.getTime())
    ? `Rates ${formatTime(new Date(currentRatedAtDate.getTime() - 60 * 60 * 1000), timeZone)} to ${formatTime(currentRatedAtDate, timeZone)}`
    : null;

  return (
    <div className="sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div className="sheet-surface" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        
        <h3 id="sheet-title" className="sheet-title">
          Edit Time Window
        </h3>
        <p className="sheet-subtitle">
          Adjust the start and end of this entry
        </p>

        {error && (
          <div className="sheet-error" role="alert">
            {error}
          </div>
        )}

        {needsConfirmation ? (
          <div className="sheet-confirm-box">
            <p className="sheet-confirm-text">
              This window is <strong>{pendingDuration}</strong> long. Would you like to keep this time range?
            </p>
            <div className="sheet-button-row">
              <Button variant="secondary" onClick={() => setNeedsConfirmation(false)}>
                Go Back
              </Button>
              <Button onClick={() => handleValidateAndSave(true)}>
                Yes, Keep It
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
            <div className="sheet-field">
              <label className="sheet-label" htmlFor="window-start-input">
                Started
              </label>
              <input
                id="window-start-input"
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
              />
            </div>

            <div className="sheet-field" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="sheet-label" htmlFor="window-end-input">
                  Ended
                </label>
                <button
                  type="button"
                  className="sheet-inline-link"
                  onClick={handleResetToCurrentTime}
                >
                  Set to now
                </button>
              </div>
              <input
                id="window-end-input"
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
              />
            </div>

            {/* Extra Hour ends at field when a rating is selected (Milestone 3.7) */}
            {hasSelectedRating && (
              <div
                className="sheet-field"
                style={{
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: '1px solid rgba(184, 114, 127, 0.2)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="sheet-label" htmlFor="hour-ends-at-input">
                    Hour ends at (for pain rating)
                  </label>
                  <button
                    type="button"
                    className="sheet-inline-link"
                    onClick={handleResetRatedAtToNow}
                  >
                    Set to now
                  </button>
                </div>
                <input
                  id="hour-ends-at-input"
                  name="rated_at"
                  type="datetime-local"
                  className="sheet-datetime-input"
                  value={ratedAtVal}
                  onChange={(e) => {
                    setRatedAtVal(e.target.value);
                    setError(null);
                  }}
                  max={toDateTimeLocalValue(new Date())}
                  required
                />
                {hourCoverageText && (
                  <span style={{ fontSize: 12, color: 'var(--mauve)', display: 'block', marginTop: 4 }}>
                    {hourCoverageText}
                  </span>
                )}
              </div>
            )}

            <div className="sheet-actions">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                Apply Window
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
