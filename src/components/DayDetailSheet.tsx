import React from 'react';
import { ModalPortal } from './ModalPortal';
import { DaySummary, formatHoursMinutes } from '../lib/weekSummary';
import './DayDetailSheet.css';

export interface DayDetailSheetProps {
  isOpen: boolean;
  day: DaySummary | null;
  onClose: () => void;
}

export const DayDetailSheet: React.FC<DayDetailSheetProps> = ({
  isOpen,
  day,
  onClose,
}) => {
  if (!isOpen || !day) return null;

  return (
    <ModalPortal>
      <div
        className="day-sheet-backdrop"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={day.fullHeading}
      >
        <div className="day-sheet-surface" onClick={(e) => e.stopPropagation()}>
          <div className="day-sheet-header">
            <div className="day-sheet-handle" aria-hidden="true" />
            <button
              type="button"
              className="day-sheet-close"
              onClick={onClose}
              aria-label="Close day details"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <h3 className="day-sheet-title">{day.fullHeading}</h3>
            <p className="day-sheet-subtitle">
              Total logged: {formatHoursMinutes(day.loggedMinutes)}
            </p>
          </div>

          <div className="day-sheet-body">
            {day.byCategory.length === 0 ? (
              <p className="day-sheet-empty">Nothing logged on this day.</p>
            ) : (
              <div className="day-sheet-list" role="list">
                {day.byCategory.map((cat) => (
                  <div key={cat.category} className="day-sheet-row" role="listitem">
                    <div className="day-sheet-row-left">
                      <span
                        className="day-sheet-indicator"
                        style={{ backgroundColor: cat.color }}
                        aria-hidden="true"
                      />
                      <span className="day-sheet-cat-name">{cat.category}</span>
                    </div>
                    <span className="day-sheet-cat-time">
                      {formatHoursMinutes(cat.minutes)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default DayDetailSheet;
