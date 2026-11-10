/**
 * Milestone 2.1: In-code validation for Gemini parse-entry responses
 */

export interface RawSegment {
  start_time: string;
  end_time: string;
  activity_label: string;
  category: string;
}

export interface ParseResponse {
  status: 'parsed' | 'needs_clarification';
  question?: string | null;
  segments?: RawSegment[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const ONE_MINUTE_MS = 60 * 1000;

export function validateParseResult(
  result: unknown,
  windowStartStr: string,
  windowEndStr: string,
  allowedCategories: string[]
): ValidationResult {
  if (!result || typeof result !== 'object') {
    return { valid: false, error: 'Model reply is not a valid JSON object.' };
  }

  const res = result as Partial<ParseResponse>;

  if (res.status !== 'parsed' && res.status !== 'needs_clarification') {
    return {
      valid: false,
      error: `Invalid status: '${res.status}'. Expected 'parsed' or 'needs_clarification'.`,
    };
  }

  // 1. Clarification flow
  if (res.status === 'needs_clarification') {
    if (!res.question || typeof res.question !== 'string' || res.question.trim().length === 0) {
      return {
        valid: false,
        error: "Status is 'needs_clarification' but no question was provided.",
      };
    }
    return { valid: true };
  }

  // 2. Parsed flow: segments validation
  const segments = res.segments;
  if (!Array.isArray(segments) || segments.length === 0) {
    return {
      valid: false,
      error: "Status is 'parsed' but segments array is empty or missing.",
    };
  }

  const windowStart = new Date(windowStartStr).getTime();
  const windowEnd = new Date(windowEndStr).getTime();

  if (isNaN(windowStart) || isNaN(windowEnd) || windowEnd <= windowStart) {
    return { valid: false, error: 'Invalid window start/end timestamps provided.' };
  }

  const normalizedCategories = new Set(allowedCategories.map((c) => c.trim().toLowerCase()));

  // Validate each segment
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (!s || typeof s !== 'object') {
      return { valid: false, error: `Segment #${i + 1} is not an object.` };
    }

    if (!s.activity_label || typeof s.activity_label !== 'string' || s.activity_label.trim().length === 0) {
      return { valid: false, error: `Segment #${i + 1} is missing an activity_label.` };
    }

    if (!s.category || typeof s.category !== 'string') {
      return { valid: false, error: `Segment #${i + 1} is missing a category.` };
    }

    if (!normalizedCategories.has(s.category.trim().toLowerCase())) {
      return {
        valid: false,
        error: `Segment #${i + 1} has category '${s.category}' which is not in the allowed category list.`,
      };
    }

    const segStart = new Date(s.start_time).getTime();
    const segEnd = new Date(s.end_time).getTime();

    if (isNaN(segStart) || isNaN(segEnd)) {
      return {
        valid: false,
        error: `Segment #${i + 1} has invalid start_time or end_time timestamps.`,
      };
    }

    if (segEnd <= segStart) {
      return {
        valid: false,
        error: `Segment #${i + 1} end_time (${s.end_time}) is not after start_time (${s.start_time}).`,
      };
    }
  }

  // Check chronological sorting and contiguity
  for (let i = 0; i < segments.length; i++) {
    const segStart = new Date(segments[i].start_time).getTime();
    const segEnd = new Date(segments[i].end_time).getTime();

    if (i > 0) {
      const prevEnd = new Date(segments[i - 1].end_time).getTime();
      const prevStart = new Date(segments[i - 1].start_time).getTime();

      if (segStart < prevStart) {
        return {
          valid: false,
          error: `Segments are not sorted: Segment #${i + 1} starts before Segment #${i}.`,
        };
      }

      // Check contiguous (gap or overlap between consecutive segments <= 1 minute)
      const diff = Math.abs(segStart - prevEnd);
      if (diff > ONE_MINUTE_MS) {
        return {
          valid: false,
          error: `Segments are not contiguous: Segment #${i} ends at ${segments[i - 1].end_time} but Segment #${i + 1} starts at ${segments[i].start_time} (difference of ${Math.round(diff / 1000)}s exceeds 1 minute).`,
        };
      }
    }
  }

  // Check window coverage within 1 minute
  const firstStart = new Date(segments[0].start_time).getTime();
  const lastEnd = new Date(segments[segments.length - 1].end_time).getTime();

  if (Math.abs(firstStart - windowStart) > ONE_MINUTE_MS) {
    return {
      valid: false,
      error: `First segment start (${segments[0].start_time}) does not match window_start (${windowStartStr}) within 1 minute.`,
    };
  }

  if (Math.abs(lastEnd - windowEnd) > ONE_MINUTE_MS) {
    return {
      valid: false,
      error: `Last segment end (${segments[segments.length - 1].end_time}) does not match window_end (${windowEndStr}) within 1 minute.`,
    };
  }

  const totalSegmentMs = segments.reduce((acc, s) => {
    return acc + (new Date(s.end_time).getTime() - new Date(s.start_time).getTime());
  }, 0);
  const totalWindowMs = windowEnd - windowStart;

  if (Math.abs(totalSegmentMs - totalWindowMs) > ONE_MINUTE_MS) {
    return {
      valid: false,
      error: `Total segment duration (${Math.round(totalSegmentMs / 60000)}m) does not match total window duration (${Math.round(totalWindowMs / 60000)}m) within 1 minute.`,
    };
  }

  return { valid: true };
}
