/**
 * Milestone 2.1 & 3.7: In-code validation for Gemini parse-entry responses
 */

export interface RawSegment {
  start_time: string;
  end_time: string;
  activity_label: string;
  category: string;
  company?: string[];
}

export interface ParseResponse {
  status: 'parsed' | 'needs_clarification';
  question?: string | null;
  segments?: RawSegment[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedSegments?: RawSegment[];
}

const ONE_MINUTE_MS = 60 * 1000;

export function validateParseResult(
  result: unknown,
  windowStartStr: string,
  windowEndStr: string,
  allowedCategories: string[] | Array<{ name: string; description?: string }>,
  options?: {
    onVacation?: boolean;
    companyUsed?: string[];
  }
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

  // Normalize allowed categories list (handles both string[] and CategoryItem[])
  const categoryNames = allowedCategories.map((c) =>
    typeof c === 'string' ? c.trim().toLowerCase() : c.name.trim().toLowerCase()
  );
  const normalizedCategories = new Set(categoryNames);

  const companyUsed = options?.companyUsed || [];
  const onVacation = Boolean(options?.onVacation);

  const sanitizedSegments: RawSegment[] = [];

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

    let finalCategory = s.category.trim().toLowerCase();

    // Milestone 3.7: If on_vacation is true, set every segment's category to "vacation" in code
    if (onVacation) {
      finalCategory = 'vacation';
    } else if (!normalizedCategories.has(finalCategory)) {
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

    // Milestone 3.7: Validate and sanitize company array
    // - Trim each name, drop empty ones
    // - Allow at most 8 names and at most 40 characters per name
    // - Remove duplicates ignoring case
    // - When a returned name matches a name in company_used ignoring case, replace with stored spelling
    const rawCompany = Array.isArray(s.company) ? s.company : [];
    const sanitizedCompany: string[] = [];
    const seenLower = new Set<string>();

    for (const rawName of rawCompany) {
      if (typeof rawName !== 'string') continue;
      const trimmed = rawName.trim();
      if (!trimmed || trimmed.length > 40) continue;

      const lower = trimmed.toLowerCase();
      if (seenLower.has(lower)) continue;
      seenLower.add(lower);

      // Match against company_used ignoring case
      const matchedCanonical = companyUsed.find((c) => c.trim().toLowerCase() === lower);
      sanitizedCompany.push(matchedCanonical ? matchedCanonical.trim() : trimmed);

      if (sanitizedCompany.length >= 8) break;
    }

    sanitizedSegments.push({
      start_time: s.start_time,
      end_time: s.end_time,
      activity_label: s.activity_label.trim().toLowerCase(),
      category: finalCategory,
      company: sanitizedCompany,
    });
  }

  // Check chronological sorting and contiguity
  for (let i = 0; i < sanitizedSegments.length; i++) {
    const segStart = new Date(sanitizedSegments[i].start_time).getTime();
    const segEnd = new Date(sanitizedSegments[i].end_time).getTime();

    if (i > 0) {
      const prevEnd = new Date(sanitizedSegments[i - 1].end_time).getTime();
      const prevStart = new Date(sanitizedSegments[i - 1].start_time).getTime();

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
          error: `Segments are not contiguous: Segment #${i} ends at ${sanitizedSegments[i - 1].end_time} but Segment #${i + 1} starts at ${sanitizedSegments[i].start_time} (difference of ${Math.round(diff / 1000)}s exceeds 1 minute).`,
        };
      }
    }
  }

  // Check window coverage within 1 minute
  const firstStart = new Date(sanitizedSegments[0].start_time).getTime();
  const lastEnd = new Date(sanitizedSegments[sanitizedSegments.length - 1].end_time).getTime();

  if (Math.abs(firstStart - windowStart) > ONE_MINUTE_MS) {
    return {
      valid: false,
      error: `First segment start (${sanitizedSegments[0].start_time}) does not match window_start (${windowStartStr}) within 1 minute.`,
    };
  }

  if (Math.abs(lastEnd - windowEnd) > ONE_MINUTE_MS) {
    return {
      valid: false,
      error: `Last segment end (${sanitizedSegments[sanitizedSegments.length - 1].end_time}) does not match window_end (${windowEndStr}) within 1 minute.`,
    };
  }

  const totalSegmentMs = sanitizedSegments.reduce((acc, s) => {
    return acc + (new Date(s.end_time).getTime() - new Date(s.start_time).getTime());
  }, 0);
  const totalWindowMs = windowEnd - windowStart;

  if (Math.abs(totalSegmentMs - totalWindowMs) > ONE_MINUTE_MS) {
    return {
      valid: false,
      error: `Total segment duration (${Math.round(totalSegmentMs / 60000)}m) does not match total window duration (${Math.round(totalWindowMs / 60000)}m) within 1 minute.`,
    };
  }

  return { valid: true, sanitizedSegments };
}
