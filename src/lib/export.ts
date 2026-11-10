/**
 * Export helpers for Little Hours (CSV & JSON)
 */

export interface ExportEntry {
  id: string;
  window_start: string;
  window_end: string;
  raw_text: string;
  created_at: string;
}

export interface FormattedExportRow {
  id: string;
  window_start: string;
  window_end: string;
  local_start: string;
  local_end: string;
  raw_text: string;
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
 * Transform raw entries into exportable rows with local times.
 */
export function prepareExportRows(
  entries: ExportEntry[],
  timeZone: string = 'America/Phoenix'
): FormattedExportRow[] {
  return entries.map((entry) => {
    const start = new Date(entry.window_start);
    const end = new Date(entry.window_end);

    return {
      id: entry.id,
      window_start: entry.window_start,
      window_end: entry.window_end,
      local_start: formatLocalTime(start, timeZone),
      local_end: formatLocalTime(end, timeZone),
      raw_text: entry.raw_text,
      created_at: entry.created_at,
    };
  });
}

/**
 * Generate CSV string from export rows.
 */
export function generateCSV(rows: FormattedExportRow[]): string {
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
