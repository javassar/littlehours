/**
 * Week in Review Pure Calculation Module
 * SPEC-3.9 Milestone 4.1
 *
 * Deterministic math for weekly hours, breakdown, comparison, people, and gaps.
 * Contains NO network calls and NO React dependencies.
 */

export type CategoryTint = 'sage' | 'slate' | 'lavender' | 'rose' | 'mauve';

export const CATEGORY_TINTS: Record<string, CategoryTint> = {
  // Slate (career, planning, logistics)
  'work': 'slate',
  'job search': 'slate',
  'networking': 'slate',
  'professional development': 'slate',
  'admin': 'slate',

  // Lavender (digital, media, events)
  'doomscrolling': 'lavender',
  'social media': 'lavender',
  'entertainment': 'lavender',
  'events': 'lavender',
  'texting': 'lavender',

  // Mauve (connection, rest, music)
  'social time': 'mauve',
  'sleep': 'mauve',
  'functional meals': 'mauve',
  'social meals': 'mauve',
  'piano': 'mauve',

  // Sage (wellness, care, health, vacation)
  'exercise': 'sage',
  'hygiene': 'sage',
  'personal care': 'sage',
  'healthcare': 'sage',
  'vacation': 'sage',

  // Rose (home, crafts, books, everyday tasks)
  'chores': 'rose',
  'errands': 'rose',
  'shopping': 'rose',
  'reading': 'rose',
  'hobbies': 'rose',

  // Legacy mappings for backward compatibility
  'digital media time': 'lavender',
  'misc hobby': 'rose',
  'meals': 'mauve',
  'rest': 'sage',
  'travel': 'sage',
  'phone and social media': 'lavender',
};

export const MIN_GAP_MINUTES = 15;
export const MIN_COMPARISON_HOURS = 24;

export const PALETTE_TOKENS = ['#8C9BB5', '#C9BBD6', '#8E6B7A', '#A9B29B', '#D9A5AE'];
export const TINT_COLORS: Record<CategoryTint, string> = {
  slate: '#8C9BB5',
  lavender: '#C9BBD6',
  mauve: '#8E6B7A',
  sage: '#A9B29B',
  rose: '#D9A5AE',
};

// ==========================================
// Timezone and Week Boundary Helpers
// ==========================================

export interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string; // 'Mon', 'Tue', etc.
}

/**
 * Returns date components in the specified IANA timezone.
 */
export function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    hour: parseInt(map.hour, 10) % 24,
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
    weekday: map.weekday,
  };
}

/**
 * Creates a UTC Date corresponding to the exact wall-clock year, month, day, hour, minute in timeZone.
 */
export function createZonedDate(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const approx = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const getOffset = (d: Date) => {
    const parts = getZonedDateParts(d, timeZone);
    const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return asUTC - d.getTime();
  };
  const o1 = getOffset(approx);
  let res = new Date(approx.getTime() - o1);
  const o2 = getOffset(res);
  if (o2 !== o1) {
    res = new Date(approx.getTime() - o2);
  }
  return res;
}

/**
 * Returns Monday 00:00:00 in timeZone for the calendar week containing refDate.
 */
export function getWeekStartForDate(refDate: Date, timeZone: string): Date {
  const parts = getZonedDateParts(refDate, timeZone);
  const weekdayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const dayIndex = weekdayMap[parts.weekday] ?? 0;
  const calDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - dayIndex));
  return createZonedDate(
    calDate.getUTCFullYear(),
    calDate.getUTCMonth() + 1,
    calDate.getUTCDate(),
    0,
    0,
    timeZone
  );
}

/**
 * Returns next Monday 00:00:00 in timeZone.
 */
export function getNextWeekStart(weekStart: Date, timeZone: string): Date {
  const parts = getZonedDateParts(weekStart, timeZone);
  const nextCal = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 7));
  return createZonedDate(
    nextCal.getUTCFullYear(),
    nextCal.getUTCMonth() + 1,
    nextCal.getUTCDate(),
    0,
    0,
    timeZone
  );
}

/**
 * Returns previous Monday 00:00:00 in timeZone.
 */
export function getPreviousWeekStart(weekStart: Date, timeZone: string): Date {
  const parts = getZonedDateParts(weekStart, timeZone);
  const prevCal = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - 7));
  return createZonedDate(
    prevCal.getUTCFullYear(),
    prevCal.getUTCMonth() + 1,
    prevCal.getUTCDate(),
    0,
    0,
    timeZone
  );
}

/**
 * The screen opens on the current week, except on Mondays, when it opens on the week that just ended.
 */
export function getDefaultSelectedWeekStart(now: Date, timeZone: string): Date {
  const parts = getZonedDateParts(now, timeZone);
  const currentWeekStart = getWeekStartForDate(now, timeZone);
  if (parts.weekday === 'Mon') {
    return getPreviousWeekStart(currentWeekStart, timeZone);
  }
  return currentWeekStart;
}

/**
 * Get week boundaries { weekStart, weekEnd }
 */
export function getWeekBoundaries(refDate: Date, timeZone: string): { weekStart: Date; weekEnd: Date } {
  const weekStart = getWeekStartForDate(refDate, timeZone);
  const weekEnd = getNextWeekStart(weekStart, timeZone);
  return { weekStart, weekEnd };
}

// ==========================================
// Formatting Helpers
// ==========================================

export function formatHoursMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0h 0m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function formatDecimalHours(totalMinutes: number): string {
  const val = (totalMinutes / 60).toFixed(2);
  // Strip trailing zeros if clean, e.g. 37.00 -> 37, 37.50 -> 37.5
  const clean = val.replace(/\.?0+$/, '');
  return `${clean} hours`;
}

/**
 * Format the week selector date range label, e.g. "Nov 16 to Nov 22" or "Oct 26 to Nov 1".
 */
export function formatWeekDateRange(weekStart: Date, timeZone: string): string {
  const partsStart = getZonedDateParts(weekStart, timeZone);
  const sunCal = new Date(Date.UTC(partsStart.year, partsStart.month - 1, partsStart.day + 6));
  const sunParts = getZonedDateParts(
    createZonedDate(sunCal.getUTCFullYear(), sunCal.getUTCMonth() + 1, sunCal.getUTCDate(), 0, 0, timeZone),
    timeZone
  );

  const monthShorts = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startMonth = monthShorts[partsStart.month - 1];
  const endMonth = monthShorts[sunParts.month - 1];

  return `${startMonth} ${partsStart.day} to ${endMonth} ${sunParts.day}`;
}

/**
 * Generates the plain text block for "Copy for my report" (Section 6.2).
 */
export function generateReportText(
  summary: WeekSummaryResult,
  timeZone: string,
  hoursFormat: 'hours_minutes' | 'decimal' = 'hours_minutes'
): string {
  const rangeStr = formatWeekDateRange(summary.weekStart, timeZone);
  const totalStr =
    hoursFormat === 'decimal'
      ? formatDecimalHours(summary.work.totalMinutes)
      : formatHoursMinutes(summary.work.totalMinutes);

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayLines = summary.work.perDay.map((min, idx) => {
    const formatted =
      hoursFormat === 'decimal'
        ? formatDecimalHours(min)
        : formatHoursMinutes(min);
    return `${dayNames[idx]} ${formatted}`;
  });

  return [
    `Week of ${rangeStr}`,
    `Hours worked: ${totalStr}`,
    ...dayLines,
  ].join('\n');
}

/**
 * Resolves a category color using stored color, Chip CATEGORY_TINTS, or palette cycling.
 */
export function resolveCategoryColor(
  categoryName: string,
  settings?: { categories?: Array<{ name: string; color?: string }> }
): string {
  const clean = categoryName.trim().toLowerCase();

  // 1. Stored color in settings
  if (settings?.categories) {
    const found = settings.categories.find((c) => c.name.trim().toLowerCase() === clean);
    if (found?.color) return found.color;
  }

  // 2. Chip CATEGORY_TINTS mapping
  const tint = CATEGORY_TINTS[clean];
  if (tint && TINT_COLORS[tint]) {
    return TINT_COLORS[tint];
  }

  // 3. Stable palette hash fallback
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % PALETTE_TOKENS.length;
  return PALETTE_TOKENS[idx];
}

// ==========================================
// Types
// ==========================================

export interface WeekSummaryInputSegment {
  id?: string;
  entry_id?: string;
  start_time: string | Date;
  end_time: string | Date;
  category: string;
  activity_label?: string;
  company?: string[];
  confirmed?: boolean;
  on_vacation?: boolean;
}

export interface WeekSummaryInputEntry {
  id: string;
  window_start?: string | Date;
  window_end?: string | Date;
  parse_status?: string;
  on_vacation?: boolean;
  clarification_question?: string | null;
}

export interface WeekSummaryInputSettings {
  timezone?: string;
  work_report_categories?: string[];
  categories?: Array<{ name: string; description?: string; color?: string }>;
  unsyncedChanges?: number;
}

export interface ComputeWeekSummaryParams {
  segments: WeekSummaryInputSegment[];
  entries?: WeekSummaryInputEntry[];
  settings?: WeekSummaryInputSettings;
  weekStart: Date;
  now?: Date;
  previousSegments?: WeekSummaryInputSegment[];
}

export interface CategorySummary {
  category: string;
  color: string;
  minutes: number;
  shareOfCounted: number;
}

export interface DaySummary {
  date: string; // "YYYY-MM-DD"
  dayInitial: string; // "M", "T", "W", "T", "F", "S", "S"
  dayOfWeek: string; // "Mon", "Tue", etc.
  dayLabel: string; // e.g. "Mon 16"
  fullHeading: string; // e.g. "Monday, November 16"
  loggedMinutes: number;
  workMinutes: number;
  byCategory: Array<{ category: string; color: string; minutes: number }>;
  isFuture: boolean;
}

export interface PersonSummary {
  name: string;
  minutes: number;
}

export interface GapSummary {
  start: Date;
  end: Date;
  minutes: number;
}

export interface CategoryDelta {
  category: string;
  deltaMinutes: number;
}

export interface ComparisonSummary {
  available: boolean;
  deltas: CategoryDelta[];
  workDeltaMinutes: number;
  reason?: string;
}

export interface QualitySummary {
  unconfirmedSegments: number;
  entriesNeedingAttention: number;
  unsyncedChanges: number;
}

export interface CoverageSummary {
  loggedMs: number;
  availableMs: number;
  loggedMinutes: number;
  availableMinutes: number;
  percentage: number;
  text: string;
}

export interface WorkSummary {
  totalMinutes: number;
  perDay: [number, number, number, number, number, number, number];
  categoriesUsed: string[];
  missingCategories: string[];
}

export interface WeekSummaryResult {
  weekStart: Date;
  weekEnd: Date;
  isCurrentWeek: boolean;
  isAllVacation: boolean;
  loggedMs: number;
  vacationMs: number;
  countedMs: number;
  coverage: CoverageSummary;
  work: WorkSummary;
  byCategory: CategorySummary[];
  byDay: DaySummary[];
  people: PersonSummary[];
  aloneMinutes: number;
  gaps: GapSummary[];
  comparison: ComparisonSummary;
  quality: QualitySummary;
}

// ==========================================
// Overlap & Slice Reconciliation
// ==========================================

interface ReconciledSlice {
  startMs: number;
  endMs: number;
  category: string;
  company: string[];
  isVacation: boolean;
  confirmed: boolean;
  activity_label?: string;
}

/**
 * Reconciles overlapping segments by slicing the timeline so each minute is counted once.
 * Later segments win for overlapping intervals, matching Little Hours apply_segments_with_adjustments.
 * Emits a console warning if an overlap is detected.
 */
function reconcileSlices(
  rawClipped: Array<{
    startMs: number;
    endMs: number;
    category: string;
    company: string[];
    isVacation: boolean;
    confirmed: boolean;
    activity_label?: string;
  }>
): ReconciledSlice[] {
  // Sort by startMs, then by endMs
  const sorted = [...rawClipped].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  let slices: ReconciledSlice[] = [];
  let warned = false;

  for (const seg of sorted) {
    const newSlices: ReconciledSlice[] = [];
    for (const prev of slices) {
      if (seg.startMs >= prev.endMs || seg.endMs <= prev.startMs) {
        // No overlap
        newSlices.push(prev);
      } else {
        if (!warned) {
          console.warn('Overlapping segments detected in week; counting overlapping minutes once');
          warned = true;
        }
        // prev overlaps seg. Later segment takes the overlap.
        if (prev.startMs < seg.startMs) {
          newSlices.push({ ...prev, endMs: seg.startMs });
        }
        if (prev.endMs > seg.endMs) {
          newSlices.push({ ...prev, startMs: seg.endMs });
        }
      }
    }
    newSlices.push({ ...seg });
    slices = newSlices.sort((a, b) => a.startMs - b.startMs);
  }

  // Filter out any zero or negative slices
  return slices.filter((s) => s.endMs > s.startMs);
}

// ==========================================
// Main Calculation Function
// ==========================================

export function computeWeekSummary(params: ComputeWeekSummaryParams): WeekSummaryResult {
  const {
    segments = [],
    entries = [],
    settings = {},
    weekStart,
    now = new Date(),
    previousSegments = [],
  } = params;

  const timeZone = settings.timezone || 'America/Phoenix';
  const weekEnd = getNextWeekStart(weekStart, timeZone);
  const prevWeekStart = getPreviousWeekStart(weekStart, timeZone);

  const isCurrentWeek = now.getTime() >= weekStart.getTime() && now.getTime() < weekEnd.getTime();

  // 1. Build entry lookup maps
  const entryVacationMap = new Map<string, boolean>();
  for (const entry of entries) {
    if (entry.id && entry.on_vacation) {
      entryVacationMap.set(entry.id, true);
    }
  }

  // 2. Filter & clip segments to [weekStart, weekEnd]
  const weekStartMs = weekStart.getTime();
  const weekEndMs = weekEnd.getTime();

  const clippedSegments = segments
    .map((s) => {
      const sStart = new Date(s.start_time).getTime();
      const sEnd = new Date(s.end_time).getTime();
      const startMs = Math.max(sStart, weekStartMs);
      const endMs = Math.min(sEnd, weekEndMs);
      const cleanCategory = (s.category || '').trim().toLowerCase();
      const isVacation =
        cleanCategory === 'vacation' ||
        s.on_vacation === true ||
        (Boolean(s.entry_id) && entryVacationMap.get(s.entry_id!) === true);

      const rawCompany: string[] = Array.isArray(s.company) ? s.company : [];
      return {
        startMs,
        endMs,
        category: cleanCategory,
        company: rawCompany,
        isVacation,
        confirmed: s.confirmed !== false,
        activity_label: s.activity_label,
      };
    })
    .filter((s) => s.endMs > s.startMs);

  // 3. Reconcile overlapping slices
  const slices = reconcileSlices(clippedSegments);

  // 4. Time Totals
  let loggedMs = 0;
  let vacationMs = 0;
  for (const sl of slices) {
    const dur = sl.endMs - sl.startMs;
    loggedMs += dur;
    if (sl.isVacation) {
      vacationMs += dur;
    }
  }
  const countedMs = Math.max(0, loggedMs - vacationMs);
  const isAllVacation = loggedMs > 0 && vacationMs === loggedMs;

  // 5. Build 7 day boundaries (Monday 00:00 to next Monday 00:00)
  const daysParts = getZonedDateParts(weekStart, timeZone);
  const dayBounds: Array<{
    dateStr: string;
    dayInitial: string;
    dayOfWeek: string;
    dayLabel: string;
    fullHeading: string;
    startMs: number;
    endMs: number;
    isFuture: boolean;
  }> = [];

  const dayInitials = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  for (let i = 0; i < 7; i++) {
    const dStart = createZonedDate(daysParts.year, daysParts.month, daysParts.day + i, 0, 0, timeZone);
    const dEnd = createZonedDate(daysParts.year, daysParts.month, daysParts.day + i + 1, 0, 0, timeZone);
    const zParts = getZonedDateParts(dStart, timeZone);
    const dateStr = `${zParts.year}-${String(zParts.month).padStart(2, '0')}-${String(zParts.day).padStart(2, '0')}`;
    const dayLabel = `${dayNames[i]} ${zParts.day}`;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const fullHeading = `${dStart.toLocaleDateString('en-US', { weekday: 'long', timeZone })}, ${monthNames[zParts.month - 1]} ${zParts.day}`;

    const isFuture = isCurrentWeek && dStart.getTime() >= now.getTime();

    dayBounds.push({
      dateStr,
      dayInitial: dayInitials[i],
      dayOfWeek: dayNames[i],
      dayLabel,
      fullHeading,
      startMs: dStart.getTime(),
      endMs: dEnd.getTime(),
      isFuture,
    });
  }

  // 6. Work Categories & Work Totals
  const rawWorkCats = settings.work_report_categories && settings.work_report_categories.length > 0
    ? settings.work_report_categories
    : ['work'];
  const workCategories = rawWorkCats.map((c) => c.trim().toLowerCase());

  // Check missing categories
  const existingCategoryNames = new Set(
    (settings.categories || []).map((c) => c.name.trim().toLowerCase())
  );
  const missingCategories = settings.categories && settings.categories.length > 0
    ? workCategories.filter((c) => !existingCategoryNames.has(c))
    : [];
  const categoriesUsed = workCategories.filter((c) => !missingCategories.includes(c));

  // Compute day work minutes with day-level rounding
  const perDay: [number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0];
  const byDay: DaySummary[] = [];

  for (let i = 0; i < 7; i++) {
    const b = dayBounds[i];
    let dayWorkMs = 0;
    let dayLoggedMs = 0;
    const catMsMap = new Map<string, number>();

    for (const sl of slices) {
      const overlapStart = Math.max(sl.startMs, b.startMs);
      const overlapEnd = Math.min(sl.endMs, b.endMs);
      if (overlapEnd > overlapStart) {
        const dur = overlapEnd - overlapStart;
        dayLoggedMs += dur;
        if (!sl.isVacation && categoriesUsed.includes(sl.category)) {
          dayWorkMs += dur;
        }
        if (!sl.isVacation) {
          catMsMap.set(sl.category, (catMsMap.get(sl.category) || 0) + dur);
        }
      }
    }

    const roundedWork = Math.round(dayWorkMs / 60000);
    perDay[i] = roundedWork;

    const dayByCat: Array<{ category: string; color: string; minutes: number }> = [];
    for (const [cat, ms] of catMsMap.entries()) {
      dayByCat.push({
        category: cat,
        color: resolveCategoryColor(cat, settings),
        minutes: Math.round(ms / 60000),
      });
    }
    dayByCat.sort((a, b) => b.minutes - a.minutes);

    byDay.push({
      date: b.dateStr,
      dayInitial: b.dayInitial,
      dayOfWeek: b.dayOfWeek,
      dayLabel: b.dayLabel,
      fullHeading: b.fullHeading,
      loggedMinutes: Math.round(dayLoggedMs / 60000),
      workMinutes: roundedWork,
      byCategory: dayByCat,
      isFuture: b.isFuture,
    });
  }

  // Work total minutes is sum of rounded per-day minutes
  const totalWorkMinutes = perDay.reduce((sum, m) => sum + m, 0);

  // 7. Category Breakdown (Non-vacation only)
  const categoryMsMap = new Map<string, number>();
  for (const sl of slices) {
    if (!sl.isVacation) {
      categoryMsMap.set(sl.category, (categoryMsMap.get(sl.category) || 0) + (sl.endMs - sl.startMs));
    }
  }

  const byCategory: CategorySummary[] = [];
  for (const [cat, ms] of categoryMsMap.entries()) {
    const minutes = Math.round(ms / 60000);
    const shareOfCounted = countedMs > 0 ? Math.round((ms / countedMs) * 100) : 0;
    byCategory.push({
      category: cat,
      color: resolveCategoryColor(cat, settings),
      minutes,
      shareOfCounted,
    });
  }
  byCategory.sort((a, b) => b.minutes - a.minutes);

  // 8. People & Alone (Excludes vacation)
  const personMsMap = new Map<string, { ms: number; canonical: string }>();
  let aloneMs = 0;

  for (const sl of slices) {
    if (sl.isVacation) continue;

    const dur = sl.endMs - sl.startMs;
    const cleanCompany = (sl.company || []).map((n) => n.trim()).filter(Boolean);

    if (cleanCompany.length === 0) {
      aloneMs += dur;
    } else {
      // Deduplicate people in slice case-insensitively
      const seen = new Set<string>();
      for (const rawName of cleanCompany) {
        const lower = rawName.toLowerCase();
        if (seen.has(lower)) continue;
        seen.add(lower);

        const existing = personMsMap.get(lower);
        if (existing) {
          existing.ms += dur;
        } else {
          personMsMap.set(lower, { ms: dur, canonical: rawName });
        }
      }
    }
  }

  const peopleList: PersonSummary[] = [];
  for (const [, item] of personMsMap.entries()) {
    peopleList.push({
      name: item.canonical,
      minutes: Math.round(item.ms / 60000),
    });
  }
  peopleList.sort((a, b) => b.minutes - a.minutes);
  const people = peopleList.slice(0, 5);
  const aloneMinutes = Math.round(aloneMs / 60000);

  // 9. Gap Detection
  const gapEndLimitMs = isCurrentWeek
    ? Math.min(weekEndMs, now.getTime())
    : weekEndMs;

  const gaps: GapSummary[] = [];
  if (gapEndLimitMs > weekStartMs) {
    // Sort covered slices
    let cursor = weekStartMs;
    for (const sl of slices) {
      if (sl.startMs > cursor) {
        const gapStart = cursor;
        const gapEnd = Math.min(sl.startMs, gapEndLimitMs);
        if (gapEnd > gapStart) {
          const gapMin = Math.round((gapEnd - gapStart) / 60000);
          if (gapMin >= MIN_GAP_MINUTES) {
            gaps.push({
              start: new Date(gapStart),
              end: new Date(gapEnd),
              minutes: gapMin,
            });
          }
        }
      }
      cursor = Math.max(cursor, sl.endMs);
      if (cursor >= gapEndLimitMs) break;
    }

    if (cursor < gapEndLimitMs) {
      const gapMin = Math.round((gapEndLimitMs - cursor) / 60000);
      if (gapMin >= MIN_GAP_MINUTES) {
        gaps.push({
          start: new Date(cursor),
          end: new Date(gapEndLimitMs),
          minutes: gapMin,
        });
      }
    }
  }

  // 10. Coverage
  const availableMs = isCurrentWeek
    ? Math.max(0, Math.min(weekEndMs, now.getTime()) - weekStartMs)
    : weekEndMs - weekStartMs;

  const loggedMinutes = Math.round(loggedMs / 60000);
  const availableMinutes = Math.round(availableMs / 60000);
  const coveragePercentage = availableMs > 0 ? Math.round((loggedMs / availableMs) * 100) : 0;
  const coverageText = isCurrentWeek
    ? `Logged ${formatHoursMinutes(loggedMinutes)} of ${formatHoursMinutes(availableMinutes)} so far.`
    : `Logged ${formatHoursMinutes(loggedMinutes)} of ${formatHoursMinutes(availableMinutes)}.`;

  const coverage: CoverageSummary = {
    loggedMs,
    availableMs,
    loggedMinutes,
    availableMinutes,
    percentage: coveragePercentage,
    text: coverageText,
  };

  // 11. Comparison Against Last Week
  let comparison: ComparisonSummary = {
    available: false,
    deltas: [],
    workDeltaMinutes: 0,
  };

  if (!isAllVacation && previousSegments && previousSegments.length > 0) {
    const prevClipped = previousSegments
      .map((s) => {
        const sStart = new Date(s.start_time).getTime();
        const sEnd = new Date(s.end_time).getTime();
        const startMs = Math.max(sStart, prevWeekStart.getTime());
        const endMs = Math.min(sEnd, weekStartMs);
        const cleanCat = (s.category || '').trim().toLowerCase();
        const isVac =
          cleanCat === 'vacation' ||
          s.on_vacation === true ||
          (Boolean(s.entry_id) && entryVacationMap.get(s.entry_id!) === true);

        return {
          startMs,
          endMs,
          category: cleanCat,
          company: Array.isArray(s.company) ? s.company : [],
          isVacation: isVac,
          confirmed: s.confirmed !== false,
        };
      })
      .filter((s) => s.endMs > s.startMs);

    const prevSlices = reconcileSlices(prevClipped);
    let prevLoggedMs = 0;
    let prevWorkMs = 0;
    const prevCatMsMap = new Map<string, number>();

    for (const sl of prevSlices) {
      const dur = sl.endMs - sl.startMs;
      prevLoggedMs += dur;
      if (!sl.isVacation && categoriesUsed.includes(sl.category)) {
        prevWorkMs += dur;
      }
      if (!sl.isVacation) {
        prevCatMsMap.set(sl.category, (prevCatMsMap.get(sl.category) || 0) + dur);
      }
    }

    const prevLoggedHours = prevLoggedMs / (3600 * 1000);
    if (prevLoggedHours >= MIN_COMPARISON_HOURS) {
      const prevWorkMin = Math.round(prevWorkMs / 60000);
      const workDeltaMinutes = totalWorkMinutes - prevWorkMin;

      // Collect all categories across both weeks
      const allCategories = new Set([...categoryMsMap.keys(), ...prevCatMsMap.keys()]);
      const deltas: CategoryDelta[] = [];

      for (const cat of allCategories) {
        const thisMin = Math.round((categoryMsMap.get(cat) || 0) / 60000);
        const prevMin = Math.round((prevCatMsMap.get(cat) || 0) / 60000);
        const delta = thisMin - prevMin;
        if (delta !== 0) {
          deltas.push({ category: cat, deltaMinutes: delta });
        }
      }

      // Sort by largest absolute change descending
      deltas.sort((a, b) => Math.abs(b.deltaMinutes) - Math.abs(a.deltaMinutes));

      comparison = {
        available: true,
        deltas: deltas.slice(0, 5),
        workDeltaMinutes,
      };
    } else {
      comparison = {
        available: false,
        deltas: [],
        workDeltaMinutes: 0,
        reason: 'Last week has too little data to compare.',
      };
    }
  }

  // 12. Quality Notice Counts
  let unconfirmedSegments = 0;
  for (const s of clippedSegments) {
    if (!s.confirmed) unconfirmedSegments++;
  }

  let entriesNeedingAttention = 0;
  for (const e of entries) {
    const eStart = e.window_start ? new Date(e.window_start).getTime() : 0;
    const eEnd = e.window_end ? new Date(e.window_end).getTime() : 0;
    // Overlaps selected week
    if (eStart < weekEndMs && eEnd > weekStartMs) {
      if (e.parse_status && ['pending', 'needs_clarification', 'failed'].includes(e.parse_status)) {
        entriesNeedingAttention++;
      }
    }
  }

  const quality: QualitySummary = {
    unconfirmedSegments,
    entriesNeedingAttention,
    unsyncedChanges: settings.unsyncedChanges || 0,
  };

  return {
    weekStart,
    weekEnd,
    isCurrentWeek,
    isAllVacation,
    loggedMs,
    vacationMs,
    countedMs,
    coverage,
    work: {
      totalMinutes: totalWorkMinutes,
      perDay,
      categoriesUsed,
      missingCategories,
    },
    byCategory,
    byDay,
    people,
    aloneMinutes,
    gaps,
    comparison,
    quality,
  };
}
