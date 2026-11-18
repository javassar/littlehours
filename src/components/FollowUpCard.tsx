import React, { useState } from 'react';
import { EntryItem } from './EntryEditSheet';
import { Sparkle } from './illustrations/Sparkle';
import { useAuth } from '../lib/auth';
import { DEMO_MAX_FOLLOWUP_CHARS } from '../lib/demoConfig';
import './FollowUpCard.css';

export interface FollowUpCardProps {
  entry: EntryItem;
  onAnswer: (entryId: string, question: string, answer: string) => Promise<void>;
  onFixByHand: (entry: EntryItem) => void;
  isSubmitting?: boolean;
}

export const FollowUpCard: React.FC<FollowUpCardProps> = ({
  entry,
  onAnswer,
  onFixByHand,
  isSubmitting = false,
}) => {
  const { user } = useAuth();
  const isAnonymous = Boolean(user?.is_anonymous);
  const [answer, setAnswer] = useState('');
  const [localSubmitting, setLocalSubmitting] = useState(false);

  const followUps = entry.follow_ups || [];
  const roundsCount = followUps.length;
  const maxRoundsReached = roundsCount >= 3;
  const currentQuestion = entry.clarification_question || 'What happened during this time?';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || localSubmitting || isSubmitting) return;

    setLocalSubmitting(true);
    try {
      await onAnswer(entry.id, currentQuestion, answer.trim());
      setAnswer('');
    } finally {
      setLocalSubmitting(false);
    }
  };

  const busy = localSubmitting || isSubmitting;

  return (
    <div
      className="followup-card-container"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="region"
      aria-label="Clarification question from AI"
    >
      <div className="followup-header">
        <span className="followup-badge">
          <Sparkle size={13} color="var(--rose-deep)" />
          Clarification needed
        </span>
        <span className="followup-rounds-tag">
          {roundsCount > 0 ? `Round ${roundsCount + 1} of 3` : 'Round 1 of 3'}
        </span>
      </div>

      {/* Previous answered rounds history */}
      {followUps.length > 0 && (
        <div className="followup-history">
          {followUps.map((f, i) => (
            <div key={i} className="followup-history-item">
              <span className="followup-history-q">Q: {f.question}</span>
              <br />
              <span className="followup-history-a">↳ Answer: {f.answer}</span>
            </div>
          ))}
        </div>
      )}

      {/* Current AI Question */}
      <div className="followup-question-box">
        <p className="followup-question-text">{currentQuestion}</p>
      </div>

      {/* Max rounds reached: offer "Fix it by hand" prominently */}
      {maxRoundsReached ? (
        <div className="followup-form">
          <p className="followup-max-rounds-message">
            We've reached 3 rounds of questions. Let's set the segments directly by hand.
          </p>
          <div className="followup-actions">
            <button
              type="button"
              className="followup-submit-btn"
              onClick={() => onFixByHand(entry)}
            >
              Fix it by hand
            </button>
          </div>
        </div>
      ) : (
        /* Less than 3 rounds: answer input form + Fix it by hand option */
        <form onSubmit={handleSubmit} className="followup-form">
          <label htmlFor={`followup-answer-${entry.id}`} className="visually-hidden">
            Answer clarification question
          </label>
          <textarea
            id={`followup-answer-${entry.id}`}
            name={`followup-answer-${entry.id}`}
            className="followup-input"
            rows={2}
            placeholder="Tell me what you did during the rest of the time..."
            value={answer}
            onChange={(e) => {
              let val = e.target.value;
              if (isAnonymous && val.length > DEMO_MAX_FOLLOWUP_CHARS) {
                val = val.slice(0, DEMO_MAX_FOLLOWUP_CHARS);
              }
              setAnswer(val);
            }}
            maxLength={isAnonymous ? DEMO_MAX_FOLLOWUP_CHARS : undefined}
            disabled={busy}
            autoCapitalize="sentences"
            autoCorrect="on"
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />

          {isAnonymous && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--mauve)',
                textAlign: 'right',
                marginTop: -4,
                marginBottom: 6,
              }}
            >
              {answer.length} / {DEMO_MAX_FOLLOWUP_CHARS}
            </div>
          )}

          <div className="followup-actions">
            <button
              type="submit"
              className="followup-submit-btn"
              disabled={busy || !answer.trim()}
            >
              {busy ? 'Sending...' : 'Send answer'}
            </button>

            <button
              type="button"
              className="followup-fix-by-hand-btn"
              onClick={() => onFixByHand(entry)}
              disabled={busy}
            >
              Fix it by hand
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
