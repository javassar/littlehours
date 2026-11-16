/**
 * Export helpers for Little Hours (CSV & JSON)
 */

export interface ExportSegment {
  id?: string;
  start_time: string;
  end_time: string;
  activity_label: string;
  category: string;
  company?: string[];
  confirmed?: boolean;
}

export interface ExportEntry {
  id: string;
  window_start: string;
  window_end: string;
  raw_text: string;
  created_at: string;
  on_vacation?: boolean;
  follow_ups?: any[];
  segments?: ExportSegment[];
}

export interface FormattedExportRow {
  id: string;
  entry_id: string;
  segment_id?: string;
  start_time?: string;
  end_time?: string;
  window_start: string;
  window_end: string;
  local_start: string;
  local_end: string;
  activity_label?: string;
  category?: string;
  company: string[];
  on_vacation: boolean;
  confirmed?: string;
  raw_text: string;
  follow_ups?: string;
  created_at: string;
}

/**
 * Escape a CSV value according to RFC 4180:
 * - If value contains commas, quotes, or newlines, enclose in quotes
 * - Double any inner double-quotes ("" instead of ")
 */
export function escapeCSVCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format a Date object to local date-time string in user's time zone:
 * e.g. "2026-11-09 14:30:00"
 */
export function formatLocalTime(date: Date, timeZone: string = 'America/Phoenix'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

    const y = getPart('year');
    const m = getPart('month');
    const d = getPart('day');
    let h = getPart('hour');
    if (h === '24') h = '00';
    const min = getPart('minute');
    const sec = getPart('second');

    return `${y}-${m}-${d} ${h}:${min}:${sec}`;
  } catch {
    return date.toLocaleString();
  }
}

/**
 * Transform raw entries into exportable rows with local times and segment details (Milestone 2.6).
 * Produces one row per segment when segments exist.
 */
export function prepareExportRows(
  entries: ExportEntry[],
  timeZone: string = 'America/Phoenix'
): FormattedExportRow[] {
  const rows: FormattedExportRow[] = [];

  for (const entry of entries) {
    const followUpsStr =
      entry.follow_ups && entry.follow_ups.length > 0
        ? JSON.stringify(entry.follow_ups)
        : '';

    if (entry.segments && entry.segments.length > 0) {
      for (const seg of entry.segments) {
        const segStart = new Date(seg.start_time);
        const segEnd = new Date(seg.end_time);

        rows.push({
          id: entry.id,
          entry_id: entry.id,
          segment_id: seg.id || '',
          start_time: seg.start_time,
          end_time: seg.end_time,
          window_start: entry.window_start,
          window_end: entry.window_end,
          local_start: formatLocalTime(segStart, timeZone),
          local_end: formatLocalTime(segEnd, timeZone),
          activity_label: seg.activity_label,
          category: seg.category,
          company: Array.isArray(seg.company) ? seg.company : [],
          on_vacation: Boolean(entry.on_vacation),
          confirmed: seg.confirmed ? 'true' : 'false',
          raw_text: entry.raw_text,
          follow_ups: followUpsStr,
          created_at: entry.created_at,
        });
      }
    } else {
      const winStart = new Date(entry.window_start);
      const winEnd = new Date(entry.window_end);

      rows.push({
        id: entry.id,
        entry_id: entry.id,
        segment_id: '',
        start_time: entry.window_start,
        end_time: entry.window_end,
        window_start: entry.window_start,
        window_end: entry.window_end,
        local_start: formatLocalTime(winStart, timeZone),
        local_end: formatLocalTime(winEnd, timeZone),
        activity_label: '',
        category: '',
        company: [],
        on_vacation: Boolean(entry.on_vacation),
        confirmed: 'false',
        raw_text: entry.raw_text,
        follow_ups: followUpsStr,
        created_at: entry.created_at,
      });
    }
  }

  return rows;
}

/**
 * Generate CSV string from export rows.
 * Supports both updated segment-level export (Milestone 2.6 & 3.7) and entry-level format.
 */
export function generateCSV(rows: FormattedExportRow[]): string {
  const isSegmentExport =
    rows.length > 0 &&
    rows.some((r) => r.segment_id !== undefined && r.activity_label !== undefined && (r.segment_id !== '' || r.activity_label !== ''));

  if (!isSegmentExport) {
    const headers = [
      'id',
      'window_start',
      'window_end',
      'local_start',
      'local_end',
      'on_vacation',
      'raw_text',
      'created_at',
    ];

    const headerLine = headers.map(escapeCSVCell).join(',');
    const rowLines = rows.map((row) =>
      [
        escapeCSVCell(row.id),
        escapeCSVCell(row.window_start),
        escapeCSVCell(row.window_end),
        escapeCSVCell(row.local_start),
        escapeCSVCell(row.local_end),
        escapeCSVCell(row.on_vacation ? 'true' : 'false'),
        escapeCSVCell(row.raw_text),
        escapeCSVCell(row.created_at),
      ].join(',')
    );

    return [headerLine, ...rowLines].join('\r\n');
  }

  // Milestone 2.6 & 3.7 segment-level headers
  const headers = [
    'entry_id',
    'segment_id',
    'start_time',
    'end_time',
    'local_start',
    'local_end',
    'activity_label',
    'category',
    'company',
    'on_vacation',
    'confirmed',
    'raw_text',
    'follow_ups',
    'created_at',
  ];

  const headerLine = headers.map(escapeCSVCell).join(',');
  const rowLines = rows.map((row) =>
    [
      escapeCSVCell(row.entry_id),
      escapeCSVCell(row.segment_id || ''),
      escapeCSVCell(row.start_time || row.window_start),
      escapeCSVCell(row.end_time || row.window_end),
      escapeCSVCell(row.local_start),
      escapeCSVCell(row.local_end),
      escapeCSVCell(row.activity_label || ''),
      escapeCSVCell(row.category || ''),
      escapeCSVCell((row.company || []).join('; ')),
      escapeCSVCell(row.on_vacation ? 'true' : 'false'),
      escapeCSVCell(row.confirmed || 'false'),
      escapeCSVCell(row.raw_text),
      escapeCSVCell(row.follow_ups || ''),
      escapeCSVCell(row.created_at),
    ].join(',')
  );

  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * Generate formatted JSON string from export rows.
 */
export function generateJSON(rows: FormattedExportRow[]): string {
  return JSON.stringify(rows, null, 2);
}

/**
 * Generate default file name: time-log-YYYY-MM-DD.ext in user's timezone.
 */
export function getExportFileName(extension: 'csv' | 'json', timeZone: string = 'America/Phoenix'): string {
  const today = new Date();
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(today);

  return `time-log-${dateStr}.${extension}`;
}

/**
 * Milestone 3.7: Generate default file name for pain ratings: pain-ratings-YYYY-MM-DD.ext
 */
export function getPainRatingsExportFileName(extension: 'csv' | 'json', timeZone: string = 'America/Phoenix'): string {
  const today = new Date();
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(today);

  return `pain-ratings-${dateStr}.${extension}`;
}

export interface PainRatingRaw {
  id: string;
  rating: number;
  rated_at: string;
  entry_id?: string | null;
  created_at: string;
}

export interface SegmentForLookback {
  id?: string;
  entry_id: string;
  start_time: string;
  end_time: string;
  activity_label: string;
  category: string;
  company?: string[];
  parse_status?: string;
}

export interface PainRatingExportRow {
  id: string;
  rated_at: string;
  local_rated_at: string;
  hour_start: string;
  rating: number;
  entered_at: string;
  minutes_since_previous_rating: number | '' | null;
  entry_id: string;
  segment_category: string;
  segment_label: string;
  segment_company: string[] | string;
  on_vacation: boolean;
  prior_60_min_by_category: Record<string, number> | string;
  prior_180_min_by_category: Record<string, number> | string;
  prior_1440_min_by_category: Record<string, number> | string;
  prior_60_unlogged_min: number;
  prior_180_unlogged_min: number;
  prior_1440_unlogged_min: number;
}

export interface LookbackResult {
  byCategory: Record<string, number>;
  unloggedMinutes: number;
}

/**
 * Milestone 3.7: Calculate lookback window minutes per category and unlogged minutes.
 * Overlapping minutes across all segments are summed, clipping segments at window edges.
 * Unlogged minutes are lookbackMinutes minus total covered minutes.
 * Only segments from parsed entries count (pending or failed entries count as unlogged).
 */
export function calculateLookbackWindow(
  segments: SegmentForLookback[],
  ratedAt: Date,
  lookbackMinutes: number
): LookbackResult {
  const windowEndMs = ratedAt.getTime();
  const windowStartMs = windowEndMs - lookbackMinutes * 60 * 1000;
  const byCategory: Record<string, number> = {};
  let totalCoveredMinutes = 0;

  for (const seg of segments) {
    // Only segments from parsed entries count
    if (seg.parse_status && seg.parse_status !== 'parsed') {
      continue;
    }

    const segStartMs = new Date(seg.start_time).getTime();
    const segEndMs = new Date(seg.end_time).getTime();

    if (isNaN(segStartMs) || isNaN(segEndMs) || segEndMs <= segStartMs) {
      continue;
    }

    // Clip segment to window [windowStartMs, windowEndMs]
    const overlapStartMs = Math.max(segStartMs, windowStartMs);
    const overlapEndMs = Math.min(segEndMs, windowEndMs);

    if (overlapEndMs > overlapStartMs) {
      const overlapMinutes = Math.round((overlapEndMs - overlapStartMs) / 60000);
      if (overlapMinutes > 0) {
        const cat = seg.category || 'unlabeled';
        byCategory[cat] = (byCategory[cat] || 0) + overlapMinutes;
        totalCoveredMinutes += overlapMinutes;
      }
    }
  }

  const unloggedMinutes = Math.max(0, lookbackMinutes - totalCoveredMinutes);

  return {
    byCategory,
    unloggedMinutes,
  };
}

/**
 * Milestone 3.7: Join pain ratings with segments and entries in TypeScript (described in README).
 */
export function preparePainRatingExportRows(
  ratings: PainRatingRaw[],
  entries: ExportEntry[],
  segments: SegmentForLookback[],
  timeZone: string = 'America/Phoenix'
): PainRatingExportRow[] {
  // Sort ratings chronologically ascending so minutes_since_previous_rating is correctly computed
  const sortedRatings = [...ratings].sort(
    (a, b) => new Date(a.rated_at).getTime() - new Date(b.rated_at).getTime()
  );

  const entryMap = new Map<string, ExportEntry>();
  for (const e of entries) {
    entryMap.set(e.id, e);
  }

  // Pre-filter segments to those from parsed entries
  const parsedSegments = segments.filter((s) => {
    if (s.parse_status) return s.parse_status === 'parsed';
    const entry = entryMap.get(s.entry_id);
    return !entry || (entry as any).parse_status === 'parsed' || (entry as any).parse_status === undefined;
  });

  const rows: PainRatingExportRow[] = [];

  for (let i = 0; i < sortedRatings.length; i++) {
    const r = sortedRatings[i];
    const ratedAtDate = new Date(r.rated_at);
    const ratedAtMs = ratedAtDate.getTime();
    const hourStartDate = new Date(ratedAtMs - 60 * 60 * 1000);

    // Compute minutes_since_previous_rating: empty for first
    let minutesSincePrev: number | null = null;
    if (i > 0) {
      const prevRatedAtMs = new Date(sortedRatings[i - 1].rated_at).getTime();
      minutesSincePrev = Math.round((ratedAtMs - prevRatedAtMs) / 60000);
    }

    // A segment contains rated_at when start_time <= rated_at < end_time (Rule 3)
    const containingSeg = parsedSegments.find((s) => {
      const sStartMs = new Date(s.start_time).getTime();
      const sEndMs = new Date(s.end_time).getTime();
      return sStartMs <= ratedAtMs && ratedAtMs < sEndMs;
    });

    const containingEntry = containingSeg ? entryMap.get(containingSeg.entry_id) : undefined;
    const onVacation = Boolean(
      (containingEntry && containingEntry.on_vacation) ||
      (containingSeg && containingSeg.category === 'vacation')
    );

    // Lookback windows: 60, 180, 1440 minutes
    const lookback60 = calculateLookbackWindow(parsedSegments, ratedAtDate, 60);
    const lookback180 = calculateLookbackWindow(parsedSegments, ratedAtDate, 180);
    const lookback1440 = calculateLookbackWindow(parsedSegments, ratedAtDate, 1440);

    rows.push({
      id: r.id,
      rated_at: r.rated_at,
      local_rated_at: formatLocalTime(ratedAtDate, timeZone),
      hour_start: hourStartDate.toISOString(),
      rating: r.rating,
      entered_at: r.created_at,
      minutes_since_previous_rating: minutesSincePrev,
      entry_id: r.entry_id || '',
      segment_category: containingSeg ? containingSeg.category : '',
      segment_label: containingSeg ? containingSeg.activity_label : '',
      segment_company: containingSeg && Array.isArray(containingSeg.company) ? containingSeg.company : [],
      on_vacation: onVacation,
      prior_60_min_by_category: lookback60.byCategory,
      prior_180_min_by_category: lookback180.byCategory,
      prior_1440_min_by_category: lookback1440.byCategory,
      prior_60_unlogged_min: lookback60.unloggedMinutes,
      prior_180_unlogged_min: lookback180.unloggedMinutes,
      prior_1440_unlogged_min: lookback1440.unloggedMinutes,
    });
  }

  return rows;
}

export const PAIN_RATINGS_CSV_HEADERS = [
  'id',
  'rated_at',
  'local_rated_at',
  'hour_start',
  'rating',
  'entered_at',
  'minutes_since_previous_rating',
  'entry_id',
  'segment_category',
  'segment_label',
  'segment_company',
  'on_vacation',
  'prior_60_min_by_category',
  'prior_180_min_by_category',
  'prior_1440_min_by_category',
  'prior_60_unlogged_min',
  'prior_180_unlogged_min',
  'prior_1440_unlogged_min',
];

/**
 * Milestone 3.7: Generate CSV string from pain rating export rows.
 */
export function generatePainRatingsCSV(rows: PainRatingExportRow[]): string {
  const headerLine = PAIN_RATINGS_CSV_HEADERS.map(escapeCSVCell).join(',');
  const rowLines = rows.map((r) =>
    [
      escapeCSVCell(r.id),
      escapeCSVCell(r.rated_at),
      escapeCSVCell(r.local_rated_at),
      escapeCSVCell(r.hour_start),
      escapeCSVCell(r.rating),
      escapeCSVCell(r.entered_at),
      escapeCSVCell(r.minutes_since_previous_rating !== null && r.minutes_since_previous_rating !== undefined ? r.minutes_since_previous_rating : ''),
      escapeCSVCell(r.entry_id || ''),
      escapeCSVCell(r.segment_category || ''),
      escapeCSVCell(r.segment_label || ''),
      escapeCSVCell(Array.isArray(r.segment_company) ? r.segment_company.join('; ') : r.segment_company || ''),
      escapeCSVCell(r.on_vacation ? 'true' : 'false'),
      escapeCSVCell(typeof r.prior_60_min_by_category === 'object' ? JSON.stringify(r.prior_60_min_by_category) : r.prior_60_min_by_category),
      escapeCSVCell(typeof r.prior_180_min_by_category === 'object' ? JSON.stringify(r.prior_180_min_by_category) : r.prior_180_min_by_category),
      escapeCSVCell(typeof r.prior_1440_min_by_category === 'object' ? JSON.stringify(r.prior_1440_min_by_category) : r.prior_1440_min_by_category),
      escapeCSVCell(r.prior_60_unlogged_min),
      escapeCSVCell(r.prior_180_unlogged_min),
      escapeCSVCell(r.prior_1440_unlogged_min),
    ].join(',')
  );

  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * Milestone 3.7: Generate formatted JSON string from pain rating export rows.
 */
export function generatePainRatingsJSON(rows: PainRatingExportRow[]): string {
  return JSON.stringify(rows, null, 2);
}

/**
 * Trigger a browser file download from string content.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
