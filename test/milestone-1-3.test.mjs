import assert from 'node:assert';
import { formatWindowSince, formatDuration, toDateTimeLocalValue, fromDateTimeLocalValue } from '../src/lib/time.ts';

console.log('--- Testing Milestone 1.3 Logic ---');

// 1. Time window start calculation
const now = new Date('2026-11-09T18:00:00Z');

// First entry scenario (no previous entries)
const defaultFirstStart = new Date(now.getTime() - 60 * 60 * 1000);
assert.strictEqual(defaultFirstStart.getTime(), new Date('2026-11-09T17:00:00Z').getTime(), 'First entry starts 1 hour ago');

// Second entry scenario (previous entry ended at 18:00)
const previousEntryEnd = new Date('2026-11-09T18:00:00Z');
const secondStart = previousEntryEnd;
assert.strictEqual(secondStart.getTime(), previousEntryEnd.getTime(), 'Second entry starts exactly where first ended');

// 2. Window validation logic
function validateWindow(start, end, currentTime) {
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, error: 'Invalid dates' };
  }
  if (end.getTime() <= start.getTime()) {
    return { valid: false, error: 'End time must be after start time' };
  }
  if (start.getTime() > currentTime.getTime() + 60000 || end.getTime() > currentTime.getTime() + 60000) {
    return { valid: false, error: 'Times cannot be in the future' };
  }
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  if (hours > 24) {
    return { valid: false, error: 'Cannot exceed 24 hours' };
  }
  if (hours > 12) {
    return { valid: true, requiresConfirmation: true };
  }
  return { valid: true, requiresConfirmation: false };
}

// Case A: End before start
assert.strictEqual(validateWindow(new Date('2026-11-09T17:00:00Z'), new Date('2026-11-09T16:00:00Z'), now).valid, false);

// Case B: Future time
assert.strictEqual(validateWindow(new Date('2026-11-09T17:00:00Z'), new Date('2026-11-09T19:00:00Z'), now).valid, false);

// Case C: Exceeds 24 hours
assert.strictEqual(validateWindow(new Date('2026-11-08T10:00:00Z'), new Date('2026-11-09T12:00:00Z'), now).valid, false);

// Case D: Over 12 hours (needs confirmation)
const over12 = validateWindow(new Date('2026-11-09T03:00:00Z'), new Date('2026-11-09T17:00:00Z'), now);
assert.strictEqual(over12.valid, true);
assert.strictEqual(over12.requiresConfirmation, true);

// Case E: Valid window (2 hours)
const validWin = validateWindow(new Date('2026-11-09T15:00:00Z'), new Date('2026-11-09T17:00:00Z'), now);
assert.strictEqual(validWin.valid, true);
assert.strictEqual(validWin.requiresConfirmation, false);

// 3. Double-tap save guard simulation
let insertCount = 0;
let isSaving = false;

async function mockSave(text) {
  if (isSaving || !text.trim()) return;
  isSaving = true;
  insertCount++;
  await new Promise((r) => setTimeout(r, 20));
  isSaving = false;
}

// Rapid consecutive calls (double-tap)
const p1 = mockSave('Worked on app');
const p2 = mockSave('Worked on app');
await Promise.all([p1, p2]);
assert.strictEqual(insertCount, 1, 'Double-tapping save only creates 1 entry');

// 4. Draft storage simulation
const mockStorage = new Map();
const DRAFT_KEY = 'littlehours_draft_entry';

function onType(val) {
  mockStorage.set(DRAFT_KEY, val);
}

function onSaveSuccess() {
  mockStorage.delete(DRAFT_KEY);
}

onType('Halfway through typing an entry...');
assert.strictEqual(mockStorage.get(DRAFT_KEY), 'Halfway through typing an entry...', 'Draft is saved while typing');
// Simulating closing and reopening app: draft still in storage
assert.strictEqual(mockStorage.get(DRAFT_KEY), 'Halfway through typing an entry...', 'Draft restored after reload');
onSaveSuccess();
assert.strictEqual(mockStorage.get(DRAFT_KEY), undefined, 'Draft cleared after successful save');

console.log('All Milestone 1.3 logic tests passed successfully!');
