import React from 'react';
import { PAIN_SCALE } from '../lib/painScale';
import './PainGuideSheet.css';

export interface PainGuideSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PainGuideSheet: React.FC<PainGuideSheetProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="pain-guide-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Average pain over the past hour guide"
    >
      <div className="pain-guide-surface" onClick={(e) => e.stopPropagation()}>
        <div className="pain-guide-header">
          <div className="pain-guide-handle" aria-hidden="true" />
          <button
            type="button"
            className="pain-guide-close"
            onClick={onClose}
            aria-label="Close pain guide"
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
          <h3 className="pain-guide-title">Average pain over the past hour</h3>
          <p className="pain-guide-subtitle">A guide to the 1 to 5 scale anchors</p>
        </div>

        <div className="pain-guide-body">
          <div className="pain-guide-list">
            {PAIN_SCALE.map((anchor) => (
              <div key={anchor.rating} className="pain-guide-item">
                <div className="pain-guide-badge" aria-hidden="true">
                  {anchor.rating}
                </div>
                <div className="pain-guide-text">
                  <div className="pain-guide-word">{anchor.word}</div>
                  <div className="pain-guide-meaning">{anchor.meaning}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
