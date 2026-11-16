import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './Button';
import { Chip } from './Chip';
import { Sparkle } from './illustrations/Sparkle';
import { SegmentItem } from './EntryEditSheet';
import {
  formatDuration,
  toDateTimeLocalValue,
  fromDateTimeLocalValue,
} from '../lib/time';
import {
  computeOverlapAdjustments,
  OverlapAdjustmentsPayload,
} from '../lib/overlap';
import { CategoryItem } from '../lib/settings';
import './ConfirmationSheet.css';

export interface ConfirmationSheetProps {
  isOpen: boolean;
  entryId: string;
  rawText?: string;
  initialSegments: SegmentItem[];
  categories: CategoryItem[] | string[];
  timeZone?: string;
  existingSegments?: SegmentItem[];
  onClose: () => void;
  onConfirm: (
    segments: SegmentItem[],
    overlapPayload?: OverlapAdjustmentsPayload
  ) => Promise<void>;
  onSaveUnconfirmed?: (segments: SegmentItem[]) => Promise<void>;
  onEditEntry?: () => void;
}

export const ConfirmationSheet: React.FC<ConfirmationSheetProps> = ({
  isOpen,
  entryId,
  rawText,
  initialSegments,
  categories,
  timeZone = 'America/Phoenix',
  existingSegments = [],
  onClose,
  onConfirm,
  onSaveUnconfirmed,
  onEditEntry,
}) => {
  const [segments, setSegments] = useState<SegmentItem[]>([]);
  const [companyInputs, setCompanyInputs] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const categoryNames = useMemo(() => {
    return categories.map((c) => (typeof c === 'string' ? c : c.name));
  }, [categories]);

  const companySuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const s of existingSegments) {
      if (Array.isArray(s.company)) {
        s.company.forEach((n) => n && set.add(n.trim()));
      }
    }
    for (const s of initialSegments) {
      if (Array.isArray(s.company)) {
        s.company.forEach((n) => n && set.add(n.trim()));
      }
    }
    return Array.from(set);
  }, [existingSegments, initialSegments]);

  useEffect(() => {
    if (isOpen) {
      setSegments(
        [...initialSegments].sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
      );
    }
  }, [isOpen, initialSegments]);

  // Milestone 2.5: Compute overlap adjustments to earlier entries
  const windowStartIso = segments[0]?.start_time;
  const windowEndIso = segments[segments.length - 1]?.end_time;

  const overlapResult = useMemo(() => {
    if (!windowStartIso || !windowEndIso || !existingSegments || existingSegments.length === 0) {
      return {
        hasOverlaps: false,
        displayAdjustments: [],
        payload: { to_delete: [], to_update: [], to_insert: [] },
      };
    }
    return computeOverlapAdjustments(
      windowStartIso,
      windowEndIso,
      entryId,
      existingSegments,
      timeZone
    );
  }, [windowStartIso, windowEndIso, entryId, existingSegments, timeZone]);

  if (!isOpen) return null;

  // 1. Edit activity label
  const handleLabelChange = (index: number, newLabel: string) => {
    setSegments((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], activity_label: newLabel };
      return copy;
    });
  };

  // 2. Edit category
  const handleCategoryChange = (index: number, newCategory: string) => {
    setSegments((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], category: newCategory };
      return copy;
    });
  };

  // 2b. Add / Remove Company (Milestone 3.7)
  const handleAddCompany = (segIdx: number, name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setSegments((prev) => {
      const copy = [...prev];
      const curComp = Array.isArray(copy[segIdx].company) ? [...copy[segIdx].company!] : [];
      if (!curComp.some((n) => n.toLowerCase() === clean.toLowerCase())) {
        curComp.push(clean);
        copy[segIdx] = { ...copy[segIdx], company: curComp };
      }
      return copy;
    });
  };

  const handleCompanyInputChange = (segIdx: number, val: string) => {
    if (val.includes(',')) {
      const parts = val.split(',');
      const toAdd = parts[0].trim();
      const rest = parts.slice(1).join(',');
      if (toAdd) {
        handleAddCompany(segIdx, toAdd);
      }
      setCompanyInputs((prev) => ({ ...prev, [segIdx]: rest }));
      return;
    }
    setCompanyInputs((prev) => ({ ...prev, [segIdx]: val }));
  };

  const handleCompanyInputKeyDown = (
    segIdx: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = (companyInputs[segIdx] || '').trim();
      if (val) {
        handleAddCompany(segIdx, val);
        setCompanyInputs((prev) => ({ ...prev, [segIdx]: '' }));
      }
    }
  };

  const handleRemoveCompany = (segIdx: number, personIdx: number) => {
    setSegments((prev) => {
      const copy = [...prev];
      const curComp = Array.isArray(copy[segIdx].company) ? [...copy[segIdx].company!] : [];
      curComp.splice(personIdx, 1);
      copy[segIdx] = { ...copy[segIdx], company: curComp };
      return copy;
    });
  };

  // 3. Edit start time of row i:
  // If i > 0, also adjusts the previous row's end_time so the window stays fully covered without lost or doubled minutes.
  const handleStartChange = (index: number, newLocalDtStr: string) => {
    const newDate = fromDateTimeLocalValue(newLocalDtStr);
    if (isNaN(newDate.getTime())) return;

    const newIso = newDate.toISOString();
    const newMs = newDate.getTime();

    setSegments((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const currentEndMs = new Date(prev[index].end_time).getTime();

      // Start must be before this segment's end
      if (newMs >= currentEndMs) return prev;

      const copy = [...prev];

      if (index > 0) {
        // If there's a previous row, new boundary must be after previous start
        const prevStartMs = new Date(prev[index - 1].start_time).getTime();
        if (newMs <= prevStartMs) return prev;

        // Neighbor's end moves to match this row's start
        copy[index - 1] = { ...copy[index - 1], end_time: newIso };
      }

      copy[index] = { ...copy[index], start_time: newIso };
      return copy;
    });
  };

  // 4. Edit end time of row i:
  // If i < length - 1, also adjusts the next row's start_time so the window stays fully covered without lost or doubled minutes.
  const handleEndChange = (index: number, newLocalDtStr: string) => {
    const newDate = fromDateTimeLocalValue(newLocalDtStr);
    if (isNaN(newDate.getTime())) return;

    const newIso = newDate.toISOString();
    const newMs = newDate.getTime();

    setSegments((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const currentStartMs = new Date(prev[index].start_time).getTime();

      // End must be after this segment's start
      if (newMs <= currentStartMs) return prev;

      const copy = [...prev];

      if (index < prev.length - 1) {
        // If there's a next row, new boundary must be before next row's end
        const nextEndMs = new Date(prev[index + 1].end_time).getTime();
        if (newMs >= nextEndMs) return prev;

        // Neighbor's start moves to match this row's end
        copy[index + 1] = { ...copy[index + 1], start_time: newIso };
      }

      copy[index] = { ...copy[index], end_time: newIso };
      return copy;
    });
  };

  // 5. Shared boundary divider change between segment i and i + 1
  const handleBoundaryChange = (boundaryIndex: number, newLocalDtStr: string) => {
    handleEndChange(boundaryIndex, newLocalDtStr);
  };

  // 5.5 Split segment into two halves
  const handleSplitSegment = (index: number) => {
    setSegments((prev) => {
      const seg = prev[index];
      const startMs = new Date(seg.start_time).getTime();
      const endMs = new Date(seg.end_time).getTime();
      const diffMs = endMs - startMs;
      if (diffMs < 2 * 60 * 1000) return prev; // At least 2 minutes to split

      const midMs = Math.floor(startMs + diffMs / 2);
      const midIso = new Date(midMs).toISOString();

      const first = { ...seg, end_time: midIso };
      const second: SegmentItem = {
        id: crypto.randomUUID(),
        entry_id: seg.entry_id,
        start_time: midIso,
        end_time: seg.end_time,
        activity_label: '',
        category: (typeof categories[0] === 'object' ? categories[0].name : categories[0]) || 'work',
        confirmed: false,
      };

      const copy = [...prev];
      copy.splice(index, 1, first, second);
      return copy;
    });
  };

  // 5.6 Merge segment with next row
  const handleMergeWithNext = (index: number) => {
    setSegments((prev) => {
      if (index >= prev.length - 1) return prev;
      const copy = [...prev];
      copy[index] = { ...copy[index], end_time: copy[index + 1].end_time };
      copy.splice(index + 1, 1);
      return copy;
    });
  };

  // 6. "Looks right" sets confirmed = true and saves
  const handleLooksRight = async () => {
    setIsSaving(true);
    try {
      const confirmedSegments = segments.map((s) => ({ ...s, confirmed: true }));
      await onConfirm(confirmedSegments, overlapResult.payload);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  // 7. Closing another way leaves segments saved but unconfirmed (confirmed = false)
  const handleDismissUnconfirmed = async () => {
    setIsSaving(true);
    try {
      if (onSaveUnconfirmed) {
        const unconfirmedSegments = segments.map((s) => ({ ...s, confirmed: false }));
        await onSaveUnconfirmed(unconfirmedSegments);
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="confirmation-sheet-backdrop"
      onClick={handleDismissUnconfirmed}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm time segments"
    >
      <div
        className="confirmation-sheet-surface"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="confirmation-sheet-header">
          <div className="confirmation-sheet-handle" />
          <button
            type="button"
            className="confirmation-sheet-close"
            onClick={handleDismissUnconfirmed}
            aria-label="Close without confirming"
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
          <h2 className="confirmation-sheet-title">Review Segments</h2>
          <p className="confirmation-sheet-subtitle">Double-check how your time was split</p>
        </div>

        {/* Scrollable list of rows */}
        <div className="confirmation-sheet-body">
          {rawText && (
            <div className="confirmation-raw-text">
              &ldquo;{rawText}&rdquo;
            </div>
          )}

          {/* Overlap adjustments note (Milestone 2.5) */}
          {overlapResult.hasOverlaps && (
            <div
              className="confirmation-overlap-section"
              role="region"
              aria-label="This changes earlier entries"
            >
              <div className="confirmation-overlap-header">
                <Sparkle size={13} color="var(--rose-deep)" />
                <span className="confirmation-overlap-title">This changes earlier entries</span>
              </div>
              <div className="confirmation-overlap-list">
                {overlapResult.displayAdjustments.map((adj) => (
                  <div key={adj.id} className="confirmation-overlap-item">
                    <div className="confirmation-overlap-item-top">
                      <span className="confirmation-overlap-label">{adj.activity_label}</span>
                      <Chip label={adj.category} size="sm" />
                    </div>
                    <div className="confirmation-overlap-times">
                      <span className="confirmation-overlap-before">{adj.beforeTimes}</span>
                      <span className="confirmation-overlap-arrow">→</span>
                      <span className="confirmation-overlap-after">{adj.afterTimes}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {segments.map((seg, idx) => {
            const start = new Date(seg.start_time);
            const end = new Date(seg.end_time);
            const durationStr = formatDuration(start, end);

            return (
              <React.Fragment key={seg.id || idx}>
                <div className="confirmation-segment-card">
                  {/* Row Time Range & Duration */}
                  <div className="confirmation-time-row">
                    <div className="confirmation-time-field">
                      <label className="confirmation-field-label" htmlFor={`seg-start-${idx}`}>
                        Start
                      </label>
                      <input
                        id={`seg-start-${idx}`}
                        name={`seg-start-${idx}`}
                        type="datetime-local"
                        className="confirmation-time-input"
                        value={toDateTimeLocalValue(start)}
                        onChange={(e) => handleStartChange(idx, e.target.value)}
                        aria-label={`Start time for ${seg.activity_label}`}
                      />
                    </div>

                    <span className="confirmation-time-arrow" aria-hidden="true">&rarr;</span>

                    <div className="confirmation-time-field">
                      <label className="confirmation-field-label" htmlFor={`seg-end-${idx}`}>
                        End
                      </label>
                      <input
                        id={`seg-end-${idx}`}
                        name={`seg-end-${idx}`}
                        type="datetime-local"
                        className="confirmation-time-input"
                        value={toDateTimeLocalValue(end)}
                        onChange={(e) => handleEndChange(idx, e.target.value)}
                        aria-label={`End time for ${seg.activity_label}`}
                      />
                    </div>

                    <span className="confirmation-segment-duration">{durationStr}</span>
                  </div>

                  {/* Activity Label input */}
                  <div className="confirmation-label-field">
                    <label className="confirmation-field-label" htmlFor={`seg-label-${idx}`}>
                      Activity
                    </label>
                    <input
                      id={`seg-label-${idx}`}
                      name={`seg-label-${idx}`}
                      type="text"
                      className="confirmation-label-input"
                      value={seg.activity_label}
                      onChange={(e) => handleLabelChange(idx, e.target.value)}
                      placeholder="e.g. reading, lunch, emails"
                    />
                  </div>

                  {/* Category Picker Row & Company Chips */}
                  <div className="confirmation-category-row">
                    <Chip label={seg.category} size="sm" />
                    <select
                      id={`seg-cat-${idx}`}
                      name={`seg-cat-${idx}`}
                      className="confirmation-category-select"
                      value={seg.category}
                      onChange={(e) => handleCategoryChange(idx, e.target.value)}
                      aria-label={`Select category for ${seg.activity_label}`}
                    >
                      {categoryNames.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>

                    {/* Company chips on the segment */}
                    {Array.isArray(seg.company) && seg.company.length > 0 && (
                      <div className="confirmation-company-chips">
                        {seg.company.map((person, pIdx) => (
                          <span key={person} className="company-chip">
                            <span>{person}</span>
                            <button
                              type="button"
                              className="company-chip-remove"
                              onClick={() => handleRemoveCompany(idx, pIdx)}
                              aria-label={`Remove ${person}`}
                              title="Remove person"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Edit company for this segment (Milestone 3.7) */}
                  <div className="confirmation-company-field">
                    <label className="confirmation-field-label" htmlFor={`seg-company-${idx}`}>
                      With (people)
                    </label>
                    <div className="confirmation-company-input-wrap">
                      <input
                        id={`seg-company-${idx}`}
                        type="text"
                        className="confirmation-company-input"
                        placeholder="Add person (press Enter or comma)..."
                        value={companyInputs[idx] || ''}
                        onChange={(e) => handleCompanyInputChange(idx, e.target.value)}
                        onKeyDown={(e) => handleCompanyInputKeyDown(idx, e)}
                        list={`company-suggestions-${idx}`}
                      />
                      {companySuggestions.length > 0 && (
                        <datalist id={`company-suggestions-${idx}`}>
                          {companySuggestions.map((name) => (
                            <option key={name} value={name} />
                          ))}
                        </datalist>
                      )}
                    </div>
                  </div>

                  {/* Row actions: Split row / Merge with next */}
                  <div className="confirmation-row-actions">
                    <button
                      type="button"
                      className="confirmation-row-action-btn"
                      onClick={() => handleSplitSegment(idx)}
                      title="Split this row into two halves"
                    >
                      + Split into 2
                    </button>
                    {segments.length > 1 && idx < segments.length - 1 && (
                      <button
                        type="button"
                        className="confirmation-row-action-btn"
                        onClick={() => handleMergeWithNext(idx)}
                        title="Merge this row with the next row"
                      >
                        Merge with next
                      </button>
                    )}
                  </div>
                </div>

                {/* Boundary connector between this row and the next row */}
                {idx < segments.length - 1 && (
                  <div className="confirmation-boundary-control">
                    <div className="confirmation-boundary-line" />
                    <div
                      className="confirmation-boundary-badge"
                      title="Boundary between activities: moving this adjusts both rows"
                    >
                      <span>Boundary:</span>
                      <input
                        id={`seg-boundary-${idx}`}
                        name={`seg-boundary-${idx}`}
                        type="datetime-local"
                        className="confirmation-boundary-input"
                        value={toDateTimeLocalValue(end)}
                        onChange={(e) => handleBoundaryChange(idx, e.target.value)}
                        aria-label={`Boundary between ${seg.activity_label} and ${segments[idx + 1]?.activity_label || 'next activity'}`}
                      />
                    </div>
                    <div className="confirmation-boundary-line" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="confirmation-sheet-footer">
          <Button
            variant="primary"
            fullWidth
            onClick={handleLooksRight}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Looks right'}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={handleDismissUnconfirmed}
            disabled={isSaving}
          >
            Keep unchecked for now
          </Button>
          {onEditEntry && (
            <button
              type="button"
              className="window-reset-link"
              onClick={onEditEntry}
              style={{ margin: '6px auto 0 auto', display: 'block', fontSize: 13, background: 'none', border: 'none', color: 'var(--mauve)', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Edit original entry text or window
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
