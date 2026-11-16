/**
 * Milestone 2.5: Overlapping entries computation
 * Computes adjustments to earlier segments when a new entry window overlaps them.
 * Later entry wins for overlapping minutes.
 */

import { formatTimeRange } from './time.ts';

export interface SegmentItem {
  id?: string;
  entry_id?: string;
  user_id?: string;
  start_time: string;
  end_time: string;
  activity_label: string;
  category: string;
  confirmed?: boolean;
  model?: string;
  prompt_version?: string;
}

export interface DisplayAdjustmentItem {
  id: string;
  activity_label: string;
  category: string;
  type: 'split' | 'trim' | 'delete';
  beforeTimes: string;
  afterTimes: string;
}

export interface OverlapAdjustmentsPayload {
  to_delete: string[];
  to_update: Array<{ id: string; start_time: string; end_time: string }>;
  to_insert: Array<{
    id?: string;
    entry_id: string;
    start_time: string;
    end_time: string;
    activity_label: string;
    category: string;
    confirmed: boolean;
    model?: string;
    prompt_version?: string;
  }>;
}

export interface OverlapResult {
  hasOverlaps: boolean;
  displayAdjustments: DisplayAdjustmentItem[];
  payload: OverlapAdjustmentsPayload;
}

/**
 * Computes adjustments to existing earlier segments given a new entry window.
 */
export function computeOverlapAdjustments(
  newStartIso: string,
  newEndIso: string,
  currentEntryId: string,
  existingSegments: SegmentItem[],
  timeZone: string = 'America/Phoenix'
): OverlapResult {
  const newStartMs = new Date(newStartIso).getTime();
  const newEndMs = new Date(newEndIso).getTime();

  const to_delete: string[] = [];
  const to_update: Array<{ id: string; start_time: string; end_time: string }> = [];
  const to_insert: Array<{
    id?: string;
    entry_id: string;
    start_time: string;
    end_time: string;
    activity_label: string;
    category: string;
    confirmed: boolean;
    model?: string;
    prompt_version?: string;
  }> = [];

  const displayAdjustments: DisplayAdjustmentItem[] = [];

  // Filter out segments without IDs or belonging to the current entry itself
  const candidateSegments = existingSegments.filter(
    (seg): seg is SegmentItem & { id: string; entry_id: string } =>
      Boolean(seg.id && seg.entry_id && seg.entry_id !== currentEntryId)
  );

  for (const seg of candidateSegments) {
    const segStartMs = new Date(seg.start_time).getTime();
    const segEndMs = new Date(seg.end_time).getTime();

    // Check if seg overlaps [newStartMs, newEndMs]
    // Overlap condition: segStart < newEnd && segEnd > newStart
    if (segStartMs >= newEndMs || segEndMs <= newStartMs) {
      continue; // No overlap
    }

    const beforeStr = formatTimeRange(new Date(seg.start_time), new Date(seg.end_time), timeZone);

    // Case 1: Split into two (new window sits strictly inside the existing segment)
    if (segStartMs < newStartMs && segEndMs > newEndMs) {
      // First part: [seg.start_time, newStartIso]
      to_update.push({
        id: seg.id,
        start_time: seg.start_time,
        end_time: newStartIso,
      });

      // Second part: [newEndIso, seg.end_time]
      const secondPartId = crypto.randomUUID();
      to_insert.push({
        id: secondPartId,
        entry_id: seg.entry_id,
        start_time: newEndIso,
        end_time: seg.end_time,
        activity_label: seg.activity_label,
        category: seg.category,
        confirmed: Boolean(seg.confirmed),
        model: seg.model,
        prompt_version: seg.prompt_version,
      });

      const part1Str = formatTimeRange(new Date(seg.start_time), new Date(newStartIso), timeZone);
      const part2Str = formatTimeRange(new Date(newEndIso), new Date(seg.end_time), timeZone);

      displayAdjustments.push({
        id: seg.id,
        activity_label: seg.activity_label,
        category: seg.category,
        type: 'split',
        beforeTimes: beforeStr,
        afterTimes: `${part1Str} and ${part2Str}`,
      });
    }
    // Case 2: Completely engulfed / swallowed by new window
    else if (segStartMs >= newStartMs && segEndMs <= newEndMs) {
      to_delete.push(seg.id);

      displayAdjustments.push({
        id: seg.id,
        activity_label: seg.activity_label,
        category: seg.category,
        type: 'delete',
        beforeTimes: beforeStr,
        afterTimes: 'Replaced by this entry',
      });
    }
    // Case 3: Trim from right (new entry starts inside seg and ends at or after segEnd)
    else if (segStartMs < newStartMs && segEndMs <= newEndMs) {
      to_update.push({
        id: seg.id,
        start_time: seg.start_time,
        end_time: newStartIso,
      });

      const trimmedStr = formatTimeRange(new Date(seg.start_time), new Date(newStartIso), timeZone);

      displayAdjustments.push({
        id: seg.id,
        activity_label: seg.activity_label,
        category: seg.category,
        type: 'trim',
        beforeTimes: beforeStr,
        afterTimes: trimmedStr,
      });
    }
    // Case 4: Trim from left (new entry starts at or before segStart and ends inside seg)
    else if (segStartMs >= newStartMs && segEndMs > newEndMs) {
      to_update.push({
        id: seg.id,
        start_time: newEndIso,
        end_time: seg.end_time,
      });

      const trimmedStr = formatTimeRange(new Date(newEndIso), new Date(seg.end_time), timeZone);

      displayAdjustments.push({
        id: seg.id,
        activity_label: seg.activity_label,
        category: seg.category,
        type: 'trim',
        beforeTimes: beforeStr,
        afterTimes: trimmedStr,
      });
    }
  }

  return {
    hasOverlaps: displayAdjustments.length > 0,
    displayAdjustments,
    payload: {
      to_delete,
      to_update,
      to_insert,
    },
  };
}
