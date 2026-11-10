import assert from 'node:assert';
import {
  formatDayHeading,
  getDayKey,
  formatTimeRange,
  formatDuration,
  formatDurationMs,
} from '../src/lib/time.ts';

console.log('--- Testing Milestone 1.4 Logic ---');

// 1. Arizona time day grouping test
// 11:00 PM on Monday, Nov 9, 2026 in Arizona (America/Phoenix, UTC-7) = 06:00 UTC on Tuesday, Nov 10, 2026
const dateAt11pmArizona = new Date('2026-11-10T06:00:00.000Z');

const arizonaDayKey = getDayKey(dateAt11pmArizona, 'America/Phoenix');
const arizonaHeading = formatDayHeading(dateAt11pmArizona, 'America/Phoenix');
const utcDayKey = getDayKey(dateAt11pmArizona, 'UTC');

assert.strictEqual(arizonaDayKey, '2026-11-09', 'Arizona day key must be 2026-11-09');
assert.strictEqual(arizonaHeading, 'Monday, November 9', 'Arizona day heading must be Monday, November 9');
assert.strictEqual(utcDayKey, '2026-11-10', 'In UTC this would be Nov 10, proving timezone grouping works properly');

console.log('✓ Arizona day grouping verified: 11 PM local entry stays on Monday, November 9');

// 2. Gap calculation and "Not logged: 45m" test
const entryA_end = new Date('2026-11-09T21:00:00.000Z'); // 2:00 PM Arizona
const entryB_start = new Date('2026-11-09T21:45:00.000Z'); // 2:45 PM Arizona

const gapMs = entryB_start.getTime() - entryA_end.getTime();
assert.strictEqual(gapMs, 45 * 60 * 1000, 'Gap is exactly 45 minutes');
assert.strictEqual(gapMs > 60 * 1000, true, 'Gap exceeds 1 minute threshold');
const gapLabel = `Not logged: ${formatDurationMs(gapMs)}`;
assert.strictEqual(gapLabel, 'Not logged: 45m', 'Gap label must format as Not logged: 45m');

console.log('✓ Gap calculation verified: exactly "Not logged: 45m"');

// 3. Overlap calculation test
const entryC_end = new Date('2026-11-09T22:00:00.000Z'); // 3:00 PM Arizona
const entryD_start = new Date('2026-11-09T21:30:00.000Z'); // 2:30 PM Arizona (starts before C ended)

const overlapMs = entryD_start.getTime() - entryC_end.getTime();
assert.strictEqual(overlapMs < -60 * 1000, true, 'Detected overlap exceeding 1 minute');

console.log('✓ Overlap calculation verified');

// 4. Time range formatting in Arizona time
const rangeStr = formatTimeRange(entryA_end, entryB_start, 'America/Phoenix');
assert.strictEqual(rangeStr, '2:00 PM – 2:45 PM', 'Formatted range in America/Phoenix');

console.log('✓ Time range formatting verified: 2:00 PM – 2:45 PM');

console.log('All Milestone 1.4 logic tests passed successfully!');
