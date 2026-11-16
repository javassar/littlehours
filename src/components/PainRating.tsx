import React, { useState } from 'react';
import { PAIN_SCALE, getPainWord } from '../lib/painScale';
import { PainGuideSheet } from './PainGuideSheet';
import './PainRating.css';

export interface PainRatingProps {
  value: number | null;
  onChange: (newValue: number | null) => void;
  disabled?: boolean;
}

export const PainRating: React.FC<PainRatingProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [guideOpen, setGuideOpen] = useState(false);

  const handleClick = (rating: number) => {
    if (disabled) return;
    if (value === rating) {
      onChange(null); // Tapping selected button again clears rating
    } else {
      onChange(rating);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const current = value || 0;
      const next = current >= 5 ? 1 : current + 1;
      onChange(next);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const current = value || 6;
      const prev = current <= 1 ? 5 : current - 1;
      onChange(prev);
    } else if (e.key === ' ' || e.key === 'Enter') {
      // Toggle
    }
  };

  const selectedWord = getPainWord(value);

  return (
    <div className="pain-rating-container">
      {/* Label line with "?" guide icon button */}
      <div className="pain-rating-header">
        <span id="pain-rating-label" className="pain-rating-label">
          Average pain, past hour
        </span>
        <button
          type="button"
          className="pain-rating-guide-btn"
          onClick={() => setGuideOpen(true)}
          aria-label="Explain pain rating scale"
          title="Explain pain scale anchors"
        >
          ?
        </button>
      </div>

      {/* Radiogroup of 5 round buttons */}
      <div
        className="pain-rating-buttons"
        role="radiogroup"
        aria-labelledby="pain-rating-label"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {PAIN_SCALE.map((item) => {
          const isSelected = value === item.rating;

          return (
            <button
              key={item.rating}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${item.rating}, ${item.word}`}
              className={`pain-rating-btn ${isSelected ? 'selected' : ''}`}
              onClick={() => handleClick(item.rating)}
              disabled={disabled}
            >
              {item.rating}
            </button>
          );
        })}
      </div>

      {/* Selected word in small Lora italic */}
      <div className="pain-rating-word-container" aria-live="polite">
        {selectedWord ? (
          <span className="pain-rating-word">{selectedWord}</span>
        ) : (
          <span className="pain-rating-word-placeholder" aria-hidden="true">
            &nbsp;
          </span>
        )}
      </div>

      {/* Scale guide sheet */}
      <PainGuideSheet isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
};
