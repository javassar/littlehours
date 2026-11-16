/**
 * Export helpers for Little Hours (CSV & JSON)
 */

export interface ExportSegment {
  id?: string;
  start_time: string;
  end_time: string;
  activity_label: string;
  category: string;
  confirmed?: boolean;
}

export interface ExportEntry {
  id: string;
  window_start: string;
  window_end: string;
  raw_text: string;
  created_at: string;
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
 * Supports both updated segment-level export (Milestone 2.6) and entry-level format.
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
        escapeCSVCell(row.raw_text),
        escapeCSVCell(row.created_at),
      ].join(',')
    );

    return [headerLine, ...rowLines].join('\r\n');
  }

  // Milestone 2.6 segment-level headers
  const headers = [
    'entry_id',
    'segment_id',
    'start_time',
    'end_time',
    'local_start',
    'local_end',
    'activity_label',
    'category',
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
