import assert from 'node:assert';
import {
  escapeCSVCell,
  prepareExportRows,
  generateCSV,
  generateJSON,
  getExportFileName,
} from '../src/lib/export.ts';

console.log('--- Testing Milestone 1.6 Export ---');

// 1. Filename format test
const csvFilename = getExportFileName('csv', 'America/Phoenix');
const jsonFilename = getExportFileName('json', 'America/Phoenix');

assert.match(csvFilename, /^time-log-\d{4}-\d{2}-\d{2}\.csv$/, 'CSV filename matches time-log-YYYY-MM-DD.csv');
assert.match(jsonFilename, /^time-log-\d{4}-\d{2}-\d{2}\.json$/, 'JSON filename matches time-log-YYYY-MM-DD.json');
console.log('✓ Filenames verified:', csvFilename, jsonFilename);

// 2. CSV Escaping test for commas, double quotes, and line breaks
const complexText = `Worked on "Milestone 1.6", drafted spec,\nthen relaxed in garden.`;
const escaped = escapeCSVCell(complexText);

// Must be wrapped in double quotes
assert.strictEqual(escaped.startsWith('"') && escaped.endsWith('"'), true, 'Cell must be enclosed in quotes');
// Inner quotes must be doubled
assert.strictEqual(escaped.includes('""Milestone 1.6""'), true, 'Inner quotes must be doubled');
// Commas and newlines preserved inside the cell
assert.strictEqual(escaped.includes(', drafted spec,\nthen relaxed'), true, 'Commas and line breaks preserved inside quotes');

console.log('✓ RFC 4180 CSV escaping verified for commas, quotes, and line breaks');

// 3. Multi-row dataset matching History count and columns
const mockEntries = [
  {
    id: 'entry-1',
    window_start: '2026-11-09T17:00:00.000Z',
    window_end: '2026-11-09T18:30:00.000Z',
    raw_text: complexText,
    created_at: '2026-11-09T18:30:05.000Z',
  },
  {
    id: 'entry-2',
    window_start: '2026-11-09T18:30:00.000Z',
    window_end: '2026-11-09T20:00:00.000Z',
    raw_text: 'Reviewed emails, planned dinner',
    created_at: '2026-11-09T20:00:02.000Z',
  },
  {
    id: 'entry-3',
    window_start: '2026-11-09T20:00:00.000Z',
    window_end: '2026-11-09T21:15:00.000Z',
    raw_text: 'Cooked soup, listened to music',
    created_at: '2026-11-09T21:15:01.000Z',
  },
];

const rows = prepareExportRows(mockEntries, 'America/Phoenix');
assert.strictEqual(rows.length, 3, 'Prepared 3 export rows');

// Verify columns
const r1 = rows[0];
assert.ok(r1.id);
assert.ok(r1.window_start);
assert.ok(r1.window_end);
assert.ok(r1.local_start);
assert.ok(r1.local_end);
assert.ok(r1.raw_text);
assert.ok(r1.created_at);

// 17:00 UTC = 10:00 AM MST in America/Phoenix
assert.strictEqual(r1.local_start, '2026-11-09 10:00:00', 'Local start time formatted in America/Phoenix');
assert.strictEqual(r1.local_end, '2026-11-09 11:30:00', 'Local end time formatted in America/Phoenix');

// 4. Generate CSV string and test parsing
const csvString = generateCSV(rows);

// Simple RFC 4180 CSV parser to verify Google Sheets parsing behavior
function parseCSV(text) {
  const lines = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"') {
        if (next === '"') {
          cell += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(cell);
        cell = '';
      } else if (c === '\r' && next === '\n') {
        row.push(cell);
        lines.push(row);
        row = [];
        cell = '';
        i++;
      } else if (c === '\n' || c === '\r') {
        row.push(cell);
        lines.push(row);
        row = [];
        cell = '';
      } else {
        cell += c;
      }
    }
  }
  if (cell || row.length > 0) {
    row.push(cell);
    lines.push(row);
  }
  return lines;
}

const parsedCSV = parseCSV(csvString);
const headerLine = parsedCSV[0];
const dataLines = parsedCSV.slice(1);

assert.strictEqual(dataLines.length, 3, 'CSV has exactly the same number of data rows as History');
assert.strictEqual(headerLine.length, 7, 'Headers have 7 columns');

// Check that entry 1 with comma, double quote, and line break parsed into a single cell!
const parsedTextCell = dataLines[0][5];
assert.strictEqual(parsedTextCell, complexText, 'Multiline text with comma and quotes was preserved in a single cell');

console.log('✓ CSV parser verified: multiline cell with comma parsed as 1 single cell');

// 5. JSON export test
const jsonString = generateJSON(rows);
const parsedJSON = JSON.parse(jsonString);
assert.strictEqual(parsedJSON.length, 3, 'JSON has exactly 3 entries');
assert.strictEqual(parsedJSON[0].raw_text, complexText);
assert.strictEqual(parsedJSON[0].local_start, '2026-11-09 10:00:00');

console.log('✓ JSON export structure verified');
console.log('All Milestone 1.6 logic tests passed successfully!');
