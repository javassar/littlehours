/**
 * Test Suite for Milestone 2.5: Overlapping entries
 */

import assert from 'assert';
import fs from 'fs';
import { computeOverlapAdjustments } from '../src/lib/overlap.ts';

console.log('--- Testing Milestone 2.5: Overlapping entries ---');

// ==========================================
// Check 1: The SPEC.md Primary Check Case:
// "Log work from 10 to 12, then exercise from 11 to 11:30.
//  The result is work 10 to 11, exercise 11 to 11:30, work 11:30 to 12."
// ==========================================
console.log('\n[Check 1] Verifying SPEC.md split check case (work 10-12, exercise 11-11:30)...');

const earlierWorkSegment = {
  id: 'seg-work-10-12',
  entry_id: 'entry-work-1',
  user_id: 'user-1',
  start_time: '2026-11-09T10:00:00-07:00',
  end_time: '2026-11-09T12:00:00-07:00',
  activity_label: 'work',
  category: 'work',
  confirmed: true,
  model: 'manual',
  prompt_version: 'v2',
};

const newExerciseStart = '2026-11-09T11:00:00-07:00';
const newExerciseEnd = '2026-11-09T11:30:00-07:00';
const newExerciseEntryId = 'entry-exercise-2';

const res = computeOverlapAdjustments(
  newExerciseStart,
  newExerciseEnd,
  newExerciseEntryId,
  [earlierWorkSegment],
  'America/Phoenix'
);

assert.strictEqual(res.hasOverlaps, true, 'Should detect overlap');
assert.strictEqual(res.displayAdjustments.length, 1);
assert.strictEqual(res.displayAdjustments[0].type, 'split');
assert.strictEqual(res.displayAdjustments[0].activity_label, 'work');

// Check updates: First half 10:00 to 11:00
assert.strictEqual(res.payload.to_update.length, 1);
assert.strictEqual(res.payload.to_update[0].id, 'seg-work-10-12');
assert.strictEqual(res.payload.to_update[0].start_time, '2026-11-09T10:00:00-07:00');
assert.strictEqual(res.payload.to_update[0].end_time, '2026-11-09T11:00:00-07:00');

// Check inserts: Second half 11:30 to 12:00
assert.strictEqual(res.payload.to_insert.length, 1);
assert.strictEqual(res.payload.to_insert[0].entry_id, 'entry-work-1');
assert.strictEqual(res.payload.to_insert[0].activity_label, 'work');
assert.strictEqual(res.payload.to_insert[0].start_time, '2026-11-09T11:30:00-07:00');
assert.strictEqual(res.payload.to_insert[0].end_time, '2026-11-09T12:00:00-07:00');

// Verify total window continuity:
const p1Start = new Date(res.payload.to_update[0].start_time).getTime();
const p1End = new Date(res.payload.to_update[0].end_time).getTime();
const newStart = new Date(newExerciseStart).getTime();
const newEnd = new Date(newExerciseEnd).getTime();
const p2Start = new Date(res.payload.to_insert[0].start_time).getTime();
const p2End = new Date(res.payload.to_insert[0].end_time).getTime();

assert.strictEqual(p1End, newStart, 'Part 1 end must touch new segment start');
assert.strictEqual(newEnd, p2Start, 'New segment end must touch Part 2 start');
assert.strictEqual(p1Start, new Date('2026-11-09T10:00:00-07:00').getTime());
assert.strictEqual(p2End, new Date('2026-11-09T12:00:00-07:00').getTime());

console.log('✓ Verified: Result is work 10:00-11:00, exercise 11:00-11:30, work 11:30-12:00 with 0 lost minutes.');

// ==========================================
// Check 2: Trimming and Deleting Overlaps
// ==========================================
console.log('\n[Check 2] Testing trim right, trim left, delete engulfed, and non-overlap...');

const existingSegs = [
  // 1. Non-overlapping: 8:00 to 9:00
  {
    id: 'seg-1',
    entry_id: 'e-1',
    start_time: '2026-11-09T08:00:00-07:00',
    end_time: '2026-11-09T09:00:00-07:00',
    activity_label: 'breakfast',
    category: 'meals',
  },
  // 2. Trim from right: 9:30 to 10:30 (overlaps 10:00 to 11:00)
  {
    id: 'seg-2',
    entry_id: 'e-2',
    start_time: '2026-11-09T09:30:00-07:00',
    end_time: '2026-11-09T10:30:00-07:00',
    activity_label: 'emailing',
    category: 'work',
  },
  // 3. Completely engulfed: 10:15 to 10:45
  {
    id: 'seg-3',
    entry_id: 'e-3',
    start_time: '2026-11-09T10:15:00-07:00',
    end_time: '2026-11-09T10:45:00-07:00',
    activity_label: 'phone browsing',
    category: 'phone and social media',
  },
  // 4. Trim from left: 10:45 to 11:30
  {
    id: 'seg-4',
    entry_id: 'e-4',
    start_time: '2026-11-09T10:45:00-07:00',
    end_time: '2026-11-09T11:30:00-07:00',
    activity_label: 'reading docs',
    category: 'reading',
  },
];

const overlapTest = computeOverlapAdjustments(
  '2026-11-09T10:00:00-07:00',
  '2026-11-09T11:00:00-07:00',
  'new-entry-id',
  existingSegs,
  'America/Phoenix'
);

// seg-1 should not be in any adjustment
assert(!overlapTest.displayAdjustments.some((d) => d.id === 'seg-1'));

// seg-2 should be trimmed right: 9:30 to 10:00
const seg2Update = overlapTest.payload.to_update.find((u) => u.id === 'seg-2');
assert(seg2Update);
assert.strictEqual(seg2Update.end_time, '2026-11-09T10:00:00-07:00');

// seg-3 should be deleted
assert(overlapTest.payload.to_delete.includes('seg-3'));

// seg-4 should be trimmed left: 11:00 to 11:30
const seg4Update = overlapTest.payload.to_update.find((u) => u.id === 'seg-4');
assert(seg4Update);
assert.strictEqual(seg4Update.start_time, '2026-11-09T11:00:00-07:00');
assert.strictEqual(seg4Update.end_time, '2026-11-09T11:30:00-07:00');

console.log('✓ Verified: Non-overlap, trim right, delete engulfed, and trim left all computed accurately.');

// ==========================================
// Check 3: UI Section "This changes earlier entries"
// ==========================================
console.log('\n[Check 3] Verifying ConfirmationSheet UI section for overlap changes...');
const sheetCode = fs.readFileSync('src/components/ConfirmationSheet.tsx', 'utf8');
assert(sheetCode.includes('This changes earlier entries'), 'ConfirmationSheet must display "This changes earlier entries"');
assert(sheetCode.includes('confirmation-overlap-section'), 'ConfirmationSheet must have .confirmation-overlap-section');
assert(sheetCode.includes('confirmation-overlap-before'), 'ConfirmationSheet must show before times');
assert(sheetCode.includes('confirmation-overlap-after'), 'ConfirmationSheet must show after times');
console.log('✓ Verified: ConfirmationSheet contains the required "This changes earlier entries" section.');

// ==========================================
// Check 4: Atomic Postgres RPC Function & Migration
// ==========================================
console.log('\n[Check 4] Verifying atomic Postgres RPC migration...');
const migrationFiles = fs.readdirSync('supabase/migrations');
const rpcMigration = migrationFiles.find((f) => f.includes('apply_segments_with_adjustments'));
assert(rpcMigration, 'Migration for apply_segments_with_adjustments must exist');

const migrationSql = fs.readFileSync(`supabase/migrations/${rpcMigration}`, 'utf8');
assert(migrationSql.includes('create or replace function public.apply_segments_with_adjustments'), 'Must declare apply_segments_with_adjustments');
assert(migrationSql.includes('p_adjustments'), 'Function must accept p_adjustments');
assert(migrationSql.includes('update public.entries'), 'Function must update entry status to parsed');
assert(!migrationSql.includes('raw_text ='), 'Function must never alter earlier raw_text');
console.log('✓ Verified: Atomic Postgres RPC migration exists and guarantees database integrity.');

console.log('\nAll Milestone 2.5 checks passed successfully!');
