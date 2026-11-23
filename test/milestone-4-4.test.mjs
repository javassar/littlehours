/**
 * Test Suite for Milestone 4.4: Comparison, company, gaps, and quality notice
 * SPEC-3.9 Acceptance Criteria verification.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  computeWeekSummary,
  createZonedDate,
  formatHoursMinutes,
  formatGapRange,
  MIN_COMPARISON_HOURS,
  MIN_GAP_MINUTES,
} from '../src/lib/weekSummary.ts';

console.log('--- Testing Milestone 4.4: Comparison, company, gaps, and quality notice ---\n');

const TZ_PHX = 'America/Phoenix';
const weekStartNov16 = createZonedDate(2026, 11, 16, 0, 0, TZ_PHX);
const weekEndNov23 = createZonedDate(2026, 11, 23, 0, 0, TZ_PHX);
const prevWeekStartNov9 = createZonedDate(2026, 11, 9, 0, 0, TZ_PHX);

// ==========================================
// Check 1: The comparison hides itself when last week has under 24 logged hours
// ==========================================
console.log('[Check 1] The comparison hides itself when last week has under 24 logged hours...');
{
  assert.strictEqual(MIN_COMPARISON_HOURS, 24, 'MIN_COMPARISON_HOURS must be 24');

  // Case A: Last week has 23 hours 59 minutes (1439 mins) -> comparison must NOT be available
  const currentWeekWork = {
    start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 17, 0, TZ_PHX), // 8h
    category: 'work',
  };

  const prevWeekUnder24 = {
    start_time: createZonedDate(2026, 11, 9, 0, 0, TZ_PHX),
    end_time: new Date(createZonedDate(2026, 11, 9, 0, 0, TZ_PHX).getTime() + (23 * 60 + 59) * 60 * 1000), // 23h 59m
    category: 'work',
  };

  const summaryUnder24 = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [currentWeekWork],
    previousSegments: [prevWeekUnder24],
    settings: { timezone: TZ_PHX, categories: [{ name: 'work' }], work_report_categories: ['work'] },
  });

  assert.strictEqual(summaryUnder24.comparison.available, false, 'Comparison must not be available when <24h');
  assert.strictEqual(summaryUnder24.comparison.deltas.length, 0, 'Deltas must be empty when <24h');
  assert.strictEqual(
    summaryUnder24.comparison.reason,
    'Last week has too little data to compare.',
    'Must display exact reason when last week has < 24h'
  );

  // Case B: Last week has exactly 24 hours (1440 mins) -> comparison must be available
  const prevWeekExactly24 = {
    start_time: createZonedDate(2026, 11, 9, 0, 0, TZ_PHX),
    end_time: new Date(createZonedDate(2026, 11, 9, 0, 0, TZ_PHX).getTime() + 24 * 60 * 60 * 1000), // 24h = 1440m
    category: 'work',
  };

  const summaryExactly24 = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [currentWeekWork],
    previousSegments: [prevWeekExactly24],
    settings: { timezone: TZ_PHX, categories: [{ name: 'work' }], work_report_categories: ['work'] },
  });

  assert.strictEqual(summaryExactly24.comparison.available, true, 'Comparison must be available when >=24h');
  // Work: this week 8h (480m) - last week 24h (1440m) = -960m
  assert.strictEqual(summaryExactly24.comparison.workDeltaMinutes, -960);
  assert.strictEqual(summaryExactly24.comparison.deltas.length, 1);
  assert.strictEqual(summaryExactly24.comparison.deltas[0].category, 'work');
  assert.strictEqual(summaryExactly24.comparison.deltas[0].deltaMinutes, -960);

  // Case C: When entire week is vacation, comparison is skipped
  const vacationSegment = {
    start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 17, 0, TZ_PHX),
    category: 'vacation',
    on_vacation: true,
  };
  const summaryVacation = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [vacationSegment],
    previousSegments: [prevWeekExactly24],
    settings: { timezone: TZ_PHX },
  });
  assert.strictEqual(summaryVacation.isAllVacation, true);
  assert.strictEqual(summaryVacation.comparison.available, false, 'Vacation week skips comparison');

  console.log('✓ Check 1 passed: Comparison hides itself when last week has under 24 logged hours.');
}

// ==========================================
// Check 2: Merging two spellings of a person's name in Settings merges them here too
// ==========================================
console.log('\n[Check 2] Merging two spellings of a person\'s name in Settings merges them here too...');
{
  // Segments with different casing and whitespace variations
  const seg1 = {
    start_time: createZonedDate(2026, 11, 16, 10, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 12, 0, TZ_PHX), // 2h = 120m
    category: 'social time',
    company: ['Alice', 'Bob'],
  };
  const seg2 = {
    start_time: createZonedDate(2026, 11, 17, 10, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 17, 11, 30, TZ_PHX), // 1.5h = 90m
    category: 'social time',
    company: ['alice', 'Bob'], // lowercase 'alice' should merge with 'Alice'
  };
  const seg3 = {
    start_time: createZonedDate(2026, 11, 18, 14, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 18, 15, 0, TZ_PHX), // 1h = 60m
    category: 'social time',
    company: ['Alice   '], // trailing spaces should be normalized
  };
  const segAlone = {
    start_time: createZonedDate(2026, 11, 19, 10, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 19, 13, 0, TZ_PHX), // 3h = 180m
    category: 'reading',
    company: [], // Alone
  };
  const segVacation = {
    start_time: createZonedDate(2026, 11, 20, 10, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 20, 14, 0, TZ_PHX), // 4h
    category: 'vacation',
    company: ['Alice'], // Vacation is excluded from Company kept
    on_vacation: true,
  };

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [seg1, seg2, seg3, segAlone, segVacation],
    settings: { timezone: TZ_PHX },
  });

  // Alice: 120 + 90 + 60 = 270m (4h 30m). Vacation's 4h excluded.
  const alice = summary.people.find((p) => p.name.toLowerCase() === 'alice');
  assert(alice, 'Alice should be found in people summary');
  assert.strictEqual(alice.minutes, 270, 'Alice minutes should be 270m across merged variations');

  // Bob: 120 + 90 = 210m (3h 30m)
  const bob = summary.people.find((p) => p.name.toLowerCase() === 'bob');
  assert(bob, 'Bob should be found in people summary');
  assert.strictEqual(bob.minutes, 210, 'Bob minutes should be 210m');

  // Alone: 180m
  assert.strictEqual(summary.aloneMinutes, 180, 'Alone time should be 180m');

  // Verify renamePerson simulation:
  // Suppose user merged "Robert" into "Bob" in Settings. The segments are updated in DB to "Bob".
  const segRobert = {
    start_time: createZonedDate(2026, 11, 16, 14, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 15, 0, TZ_PHX), // 60m
    category: 'social time',
    company: ['Robert'],
  };
  // After renamePerson in Settings:
  const segRobertMerged = {
    ...segRobert,
    company: ['Bob'],
  };
  const summaryMerged = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [seg1, seg2, seg3, segAlone, segRobertMerged],
    settings: { timezone: TZ_PHX },
  });
  const bobMerged = summaryMerged.people.find((p) => p.name.toLowerCase() === 'bob');
  assert.strictEqual(bobMerged.minutes, 210 + 60, 'Bob minutes must reflect merged name (270m)');

  console.log('✓ Check 2 passed: Person names merge case-insensitively, ignore whitespace, and reflect settings renames.');
}

// ==========================================
// Check 3: Gaps of 15 minutes or more appear, and shorter gaps do not
// ==========================================
console.log('\n[Check 3] Gaps of 15 minutes or more appear, and shorter gaps do not...');
{
  assert.strictEqual(MIN_GAP_MINUTES, 15, 'MIN_GAP_MINUTES must be 15');

  // Monday 00:00 to 09:00: gap of 9 hours (540m) -> should appear
  // Segment A: 09:00 to 10:00 (60m)
  // Gap 1: 10:00 to 10:14 (14m) -> MUST NOT appear
  // Segment B: 10:14 to 11:00 (46m)
  // Gap 2: 11:00 to 11:15 (15m) -> MUST appear
  // Segment C: 11:15 to 24:00 (all the way to Sunday 24:00 to avoid trailing gap for testing)
  const segA = {
    start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 10, 0, TZ_PHX),
    category: 'work',
  };
  const segB = {
    start_time: createZonedDate(2026, 11, 16, 10, 14, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 11, 0, TZ_PHX),
    category: 'work',
  };
  const segC = {
    start_time: createZonedDate(2026, 11, 16, 11, 15, TZ_PHX),
    end_time: weekEndNov23, // fills remaining week
    category: 'work',
  };

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [segA, segB, segC],
    settings: { timezone: TZ_PHX },
  });

  // Expected gaps:
  // 1. Monday 00:00 to 09:00 (540m)
  // 2. Monday 11:00 to 11:15 (15m)
  // 14m gap from 10:00 to 10:14 must NOT appear.
  assert.strictEqual(summary.gaps.length, 2, 'Must contain exactly 2 gaps (540m and 15m), 14m ignored');
  assert.strictEqual(summary.gaps[0].minutes, 540);
  assert.strictEqual(summary.gaps[1].minutes, 15);

  // Test formatGapRange
  const gapStart = createZonedDate(2026, 11, 17, 14, 10, TZ_PHX); // Tue 2:10 PM
  const gapEnd = createZonedDate(2026, 11, 17, 16, 45, TZ_PHX);   // Tue 4:45 PM
  const formatted = formatGapRange(gapStart, gapEnd, TZ_PHX);
  assert.strictEqual(formatted, 'Tue 2:10 PM to 4:45 PM', `Expected 'Tue 2:10 PM to 4:45 PM', got '${formatted}'`);

  console.log('✓ Check 3 passed: Gaps >= 15 min appear, < 15 min ignored, formatGapRange outputs Tue 2:10 PM to 4:45 PM.');
}

// ==========================================
// Check 4: The notice appears when an entry has needs_clarification status and disappears after it is resolved
// ==========================================
console.log('\n[Check 4] The notice appears when an entry has needs_clarification and disappears after resolution...');
{
  const entryNeedsClarification = {
    id: 'entry-1',
    window_start: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX).toISOString(),
    window_end: createZonedDate(2026, 11, 16, 12, 0, TZ_PHX).toISOString(),
    parse_status: 'needs_clarification',
  };

  const summaryWithClarification = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [],
    entries: [entryNeedsClarification],
    settings: { timezone: TZ_PHX },
  });

  assert.strictEqual(
    summaryWithClarification.quality.entriesNeedingAttention,
    1,
    'Quality notice count must be 1 when an entry needs clarification'
  );

  // When resolved to 'parsed':
  const entryResolved = {
    ...entryNeedsClarification,
    parse_status: 'parsed',
  };

  const summaryResolved = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [],
    entries: [entryResolved],
    settings: { timezone: TZ_PHX },
  });

  assert.strictEqual(
    summaryResolved.quality.entriesNeedingAttention,
    0,
    'Quality notice count must be 0 after clarification is resolved'
  );

  // Also test unconfirmed segments and unsynced changes:
  const unconfirmedSeg = {
    start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 10, 0, TZ_PHX),
    category: 'work',
    confirmed: false,
  };
  const summaryUnconfirmed = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [unconfirmedSeg],
    settings: { timezone: TZ_PHX, unsyncedChanges: 2 },
  });
  assert.strictEqual(summaryUnconfirmed.quality.unconfirmedSegments, 1);
  assert.strictEqual(summaryUnconfirmed.quality.unsyncedChanges, 2);

  console.log('✓ Check 4 passed: Quality notice appears for needs_clarification / unconfirmed / unsynced and disappears when resolved.');
}

// ==========================================
// Check 5: iPhone layout safeguards & CSS Tokens
// ==========================================
console.log('\n[Check 5] Verifying iPhone layout safeguards and visual design tokens...');
{
  const css = fs.readFileSync(path.resolve('src/pages/WeekPage.css'), 'utf8');

  // Check notice card
  assert(css.includes('.week-quality-notice-card'), 'Notice card class exists');
  assert(css.includes('.week-notice-action-btn'), 'Notice action button class exists');
  assert(css.includes('min-height: 44px;'), 'Notice button meets 44px min tap target');

  // Check comparison card
  assert(css.includes('.week-comparison-card'), 'Comparison card class exists');
  assert(css.includes('.week-comparison-row'), 'Comparison row class exists');

  // Check company kept card
  assert(css.includes('.week-company-card'), 'Company card class exists');
  assert(css.includes('.week-company-alone-row'), 'Alone row class exists');

  // Check unlogged stretches
  assert(css.includes('.week-gaps-card'), 'Gaps card class exists');
  assert(css.includes('.week-gaps-header-btn'), 'Gaps header button exists');
  assert(css.includes('.week-gaps-chevron'), 'Chevron class exists');

  // Verify responsive and box-sizing properties
  assert(css.includes('min-width: 0;'), 'Enforces min-width: 0 on flex children');
  assert(css.includes('box-sizing: border-box;'), 'Enforces box-sizing: border-box');
  assert(css.includes('text-overflow: ellipsis;'), 'Enforces text-overflow: ellipsis on labels');

  console.log('✓ Check 5 passed: CSS classes, 44px touch targets, and mobile overflow safeguards verified.');
}

console.log('\n====================================================');
console.log('All Milestone 4.4 Acceptance Criteria Passed Successfully!');
console.log('====================================================\n');
