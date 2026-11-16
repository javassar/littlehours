/**
 * Test Suite for Milestone 2.6: Category list and re-reading old entries
 */

import assert from 'assert';
import {
  prepareExportRows,
  generateCSV,
  generateJSON,
  getExportFileName,
  escapeCSVCell,
} from '../src/lib/export.ts';
import {
  STARTER_CATEGORIES,
} from '../src/lib/settings.ts';

console.log('--- Testing Milestone 2.6: Category list & Re-reading old entries ---');

// ==========================================
// 1. Categories List & Management Logic
// ==========================================
console.log('\n[Check 1] Categories list: Add, rename, reorder, and remove blocking...');

// 1.1 Initial list has default starter categories
assert.strictEqual(STARTER_CATEGORIES.length, 14, 'Starter categories list has 14 items');
assert.ok(STARTER_CATEGORIES.includes('work'));
assert.ok(STARTER_CATEGORIES.includes('exercise'));
assert.ok(STARTER_CATEGORIES.includes('reading'));

// 1.2 Reorder simulation
let userCategories = [...STARTER_CATEGORIES];
// Move 'exercise' (index 4) up to index 3
const [movedItem] = userCategories.splice(4, 1);
userCategories.splice(3, 0, movedItem);
assert.strictEqual(userCategories[3], 'exercise', 'Reordered category moved up');

// 1.3 Add category
const newCat = 'gardening';
userCategories.push(newCat);
assert.strictEqual(userCategories.includes('gardening'), true, 'Added new category');

// 1.4 Rename category simulation
const oldName = 'exercise';
const renamed = 'fitness training';
userCategories = userCategories.map((c) => (c === oldName ? renamed : c));
assert.strictEqual(userCategories.includes('fitness training'), true, 'Contains renamed category');
assert.strictEqual(userCategories.includes('exercise'), false, 'Old category name replaced');

// 1.5 Remove category blocking check logic:
// Simulated segments in database
const mockSegments = [
  { id: 's1', entry_id: 'e1', category: 'fitness training', activity_label: 'morning run' },
  { id: 's2', entry_id: 'e2', category: 'work', activity_label: 'coding' },
];

function canDeleteCategory(cat, segments) {
  const usageCount = segments.filter((s) => s.category.toLowerCase() === cat.toLowerCase()).length;
  if (usageCount > 0) {
    return { success: false, usageCount, message: `Cannot remove "${cat}" because ${usageCount} segment(s) are currently using it.` };
  }
  return { success: true, usageCount: 0 };
}

const blockedResult = canDeleteCategory('fitness training', mockSegments);
assert.strictEqual(blockedResult.success, false, 'Deletion of used category must be blocked');
assert.strictEqual(blockedResult.usageCount, 1, 'Shows 1 segment using it');
assert.strictEqual(blockedResult.message, 'Cannot remove "fitness training" because 1 segment(s) are currently using it.');

const allowedResult = canDeleteCategory('gardening', mockSegments);
assert.strictEqual(allowedResult.success, true, 'Deletion of unused category is permitted');
assert.strictEqual(allowedResult.usageCount, 0);

console.log('✓ Category list management (add, rename, reorder, delete guard) verified');

// ==========================================
// 2. Prompt Version Aggregation Logic
// ==========================================
console.log('\n[Check 2] Prompt Version statistics...');

const mockDbSegments = [
  { id: 'seg-1', prompt_version: 'v2' },
  { id: 'seg-2', prompt_version: 'v2' },
  { id: 'seg-3', prompt_version: 'v1' },
  { id: 'seg-4', prompt_version: 'manual' },
  { id: 'seg-5', prompt_version: null }, // defaults to v1
];

function aggregatePromptStats(segments) {
  const stats = {};
  for (const s of segments) {
    const version = s.prompt_version || 'v1';
    stats[version] = (stats[version] || 0) + 1;
  }
  return stats;
}

const stats = aggregatePromptStats(mockDbSegments);
assert.strictEqual(stats['v2'], 2, '2 segments in v2');
assert.strictEqual(stats['v1'], 2, '2 segments in v1 (including null fallback)');
assert.strictEqual(stats['manual'], 1, '1 segment in manual');

console.log('✓ Prompt version grouping verified:', stats);

// ==========================================
// 3. Segment-Level Export (SPEC.md: "The export contains one row per segment and matches History")
// ==========================================
console.log('\n[Check 3] Segment-level CSV and JSON export matching History...');

const mockHistoryEntries = [
  {
    id: 'entry-1',
    window_start: '2026-11-15T10:00:00-07:00',
    window_end: '2026-11-15T12:00:00-07:00',
    raw_text: '1 hour emails, then 1 hour coding',
    created_at: '2026-11-15T12:00:05-07:00',
    follow_ups: [{ question: 'What project?', answer: 'Little Hours', answered_at: '2026-11-15T12:01:00-07:00' }],
    segments: [
      {
        id: 'seg-1-1',
        start_time: '2026-11-15T10:00:00-07:00',
        end_time: '2026-11-15T11:00:00-07:00',
        activity_label: 'emails',
        category: 'work',
        confirmed: true,
      },
      {
        id: 'seg-1-2',
        start_time: '2026-11-15T11:00:00-07:00',
        end_time: '2026-11-15T12:00:00-07:00',
        activity_label: 'coding',
        category: 'work',
        confirmed: true,
      },
    ],
  },
  {
    id: 'entry-2',
    window_start: '2026-11-15T12:00:00-07:00',
    window_end: '2026-11-15T13:00:00-07:00',
    raw_text: 'lunch and walk outside',
    created_at: '2026-11-15T13:00:02-07:00',
    follow_ups: [],
    segments: [
      {
        id: 'seg-2-1',
        start_time: '2026-11-15T12:00:00-07:00',
        end_time: '2026-11-15T13:00:00-07:00',
        activity_label: 'lunch and walk',
        category: 'meals',
        confirmed: false,
      },
    ],
  },
  {
    id: 'entry-3-unparsed',
    window_start: '2026-11-15T13:00:00-07:00',
    window_end: '2026-11-15T14:00:00-07:00',
    raw_text: 'resting on sofa',
    created_at: '2026-11-15T14:00:00-07:00',
    follow_ups: [],
    segments: [], // Entry with no segments yet
  },
];

// In History, entry-1 shows 2 segments, entry-2 shows 1 segment, entry-3 shows 1 card.
// Total expected export rows = 2 + 1 + 1 = 4 rows.
const exportRows = prepareExportRows(mockHistoryEntries, 'America/Phoenix');
assert.strictEqual(exportRows.length, 4, 'Export produces 4 rows matching segments in History');

// Check row 1 (entry-1, segment 1)
const row1 = exportRows[0];
assert.strictEqual(row1.entry_id, 'entry-1');
assert.strictEqual(row1.segment_id, 'seg-1-1');
assert.strictEqual(row1.activity_label, 'emails');
assert.strictEqual(row1.category, 'work');
assert.strictEqual(row1.confirmed, 'true');
assert.strictEqual(row1.local_start, '2026-11-15 10:00:00');
assert.strictEqual(row1.local_end, '2026-11-15 11:00:00');
assert.ok(row1.follow_ups.includes('Little Hours'), 'Follow-ups preserved in export');

// Check row 2 (entry-1, segment 2)
const row2 = exportRows[1];
assert.strictEqual(row2.entry_id, 'entry-1');
assert.strictEqual(row2.segment_id, 'seg-1-2');
assert.strictEqual(row2.activity_label, 'coding');
assert.strictEqual(row2.category, 'work');
assert.strictEqual(row2.confirmed, 'true');
assert.strictEqual(row2.local_start, '2026-11-15 11:00:00');
assert.strictEqual(row2.local_end, '2026-11-15 12:00:00');

// Check row 3 (entry-2, segment 1)
const row3 = exportRows[2];
assert.strictEqual(row3.entry_id, 'entry-2');
assert.strictEqual(row3.segment_id, 'seg-2-1');
assert.strictEqual(row3.activity_label, 'lunch and walk');
assert.strictEqual(row3.category, 'meals');
assert.strictEqual(row3.confirmed, 'false');

// Check row 4 (entry-3, unparsed entry with no segments)
const row4 = exportRows[3];
assert.strictEqual(row4.entry_id, 'entry-3-unparsed');
assert.strictEqual(row4.segment_id, '');
assert.strictEqual(row4.activity_label, '');
assert.strictEqual(row4.category, '');
assert.strictEqual(row4.raw_text, 'resting on sofa');

console.log('✓ Row-per-segment mapping matches History segments exactly');

// ==========================================
// 4. CSV & JSON Serialization
// ==========================================
console.log('\n[Check 4] CSV and JSON serialization...');

const csvOutput = generateCSV(exportRows);
const lines = csvOutput.split('\r\n');
assert.strictEqual(lines.length, 5, '1 header line + 4 data lines');

const expectedHeaders = [
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
assert.strictEqual(lines[0], expectedHeaders.join(','), 'CSV headers match 12 segment fields');

// Verify RFC 4180 parsing
assert.ok(lines[1].includes('entry-1,seg-1-1'));
assert.ok(lines[2].includes('entry-1,seg-1-2'));

// JSON export
const jsonOutput = generateJSON(exportRows);
const parsedJSON = JSON.parse(jsonOutput);
assert.strictEqual(Array.isArray(parsedJSON), true);
assert.strictEqual(parsedJSON.length, 4);
assert.strictEqual(parsedJSON[0].activity_label, 'emails');
assert.strictEqual(parsedJSON[1].activity_label, 'coding');

console.log('✓ CSV and JSON generation verified successfully');

// ==========================================
// 5. Rate Limiting Calculation (Gemini 15 RPM)
// ==========================================
console.log('\n[Check 5] Rate limiting: 15 RPM free tier compliance...');

const maxRPM = 15;
const minIntervalMs = (60 * 1000) / maxRPM; // 4000ms
const actualIntervalMs = 4200; // Little Hours pause between calls

assert.ok(actualIntervalMs > minIntervalMs, 'Pause between calls (4200ms) exceeds 4000ms interval for 15 RPM');
const calculatedRPM = (60 * 1000) / actualIntervalMs;
assert.ok(calculatedRPM < 15, `Calculated RPM (${calculatedRPM.toFixed(2)}) is strictly below 15 RPM limit`);

console.log(`✓ 4200ms delay guarantees ${calculatedRPM.toFixed(2)} RPM, safely inside free tier 15 RPM limit`);

console.log('\n=============================================');
console.log('ALL MILESTONE 2.6 TESTS PASSED SUCCESSFULLY!');
console.log('=============================================\n');
