/**
 * Test Suite for Milestone 4.1: Calculations and Data Loading
 * Follows SPEC-3.9 Section 10 tests and conventions.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  computeWeekSummary,
  createZonedDate,
  getZonedDateParts,
  getWeekStartForDate,
  getNextWeekStart,
  getPreviousWeekStart,
  getDefaultSelectedWeekStart,
  getWeekBoundaries,
  formatHoursMinutes,
  formatDecimalHours,
  resolveCategoryColor,
  MIN_GAP_MINUTES,
  MIN_COMPARISON_HOURS,
} from '../src/lib/weekSummary.ts';
import { fetchWeekReviewData, PAGE_SIZE } from '../src/lib/weekData.ts';

console.log('--- Testing Milestone 4.1: Calculations and Data Loading ---\n');

// ==========================================
// Check 0: Migration & Settings Schema
// ==========================================
console.log('[Check 0] Verifying migration file and work_report_categories column...');
const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
const files = fs.readdirSync(migrationsDir);
const migrationFile = files.find((f) => f.includes('work_report_categories'));

assert(migrationFile, 'Expected migration file for work_report_categories to exist in supabase/migrations/');
const migrationSql = fs.readFileSync(path.join(migrationsDir, migrationFile), 'utf-8');
assert(
  migrationSql.includes('work_report_categories') &&
    migrationSql.includes('text[]') &&
    migrationSql.includes('{work}'),
  'Migration SQL must add work_report_categories text[] with default {work}'
);
console.log(`✓ Migration verified: ${migrationFile}\n`);

// Helper to create week start: Monday Nov 16, 2026 00:00:00 in America/Phoenix
const TZ_PHX = 'America/Phoenix';
const weekStartNov16 = createZonedDate(2026, 11, 16, 0, 0, TZ_PHX);
const weekEndNov23 = createZonedDate(2026, 11, 23, 0, 0, TZ_PHX);

// ==========================================
// Test 1: A segment fully inside the week is counted exactly
// ==========================================
console.log('[Test 1] Segment fully inside the week is counted exactly...');
{
  // Tuesday Nov 17 09:00 to 11:30 (150 minutes = 2h 30m)
  const sStart = createZonedDate(2026, 11, 17, 9, 0, TZ_PHX);
  const sEnd = createZonedDate(2026, 11, 17, 11, 30, TZ_PHX);

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [
      {
        id: 's1',
        start_time: sStart,
        end_time: sEnd,
        category: 'work',
        activity_label: 'client project',
        confirmed: true,
      },
    ],
    settings: { timezone: TZ_PHX, work_report_categories: ['work'] },
  });

  const expectedMs = 150 * 60 * 1000;
  assert.strictEqual(summary.loggedMs, expectedMs, 'Logged ms should be 150 minutes');
  assert.strictEqual(summary.countedMs, expectedMs, 'Counted ms should be 150 minutes');
  assert.strictEqual(summary.vacationMs, 0, 'Vacation ms should be 0');
  assert.strictEqual(summary.featured.totalMinutes, 150, 'Featured total minutes should be 150');
  assert.strictEqual(summary.work.totalMinutes, 150, 'Work total minutes alias should match');
  assert.strictEqual(summary.byCategory.length, 1, 'Should have 1 category');
  assert.strictEqual(summary.byCategory[0].category, 'work');
  assert.strictEqual(summary.byCategory[0].minutes, 150);
  assert.strictEqual(summary.byCategory[0].shareOfCounted, 100);
}
console.log('✓ Test 1 passed.\n');

// ==========================================
// Test 2: A segment that crosses the end of Sunday is clipped
// ==========================================
console.log('[Test 2] Segment crossing Sunday 24:00 (Monday 00:00) into next week is clipped...');
{
  // Sunday Nov 22 22:00 to Monday Nov 23 03:00 (5 hours total; 2h in week, 3h in next week)
  const sStart = createZonedDate(2026, 11, 22, 22, 0, TZ_PHX);
  const sEnd = createZonedDate(2026, 11, 23, 3, 0, TZ_PHX);

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [
      {
        id: 's-cross-end',
        start_time: sStart,
        end_time: sEnd,
        category: 'work',
      },
    ],
    settings: { timezone: TZ_PHX, work_report_categories: ['work'] },
  });

  // Only 2 hours (120 min) should count
  assert.strictEqual(summary.loggedMs, 120 * 60 * 1000, 'Logged ms should only include 120 min before Monday 00:00');
  assert.strictEqual(summary.featured.totalMinutes, 120, 'Featured total minutes should be 120');
  assert.strictEqual(summary.featured.perDay[6], 120, 'Sunday featured minutes should be 120');
}
console.log('✓ Test 2 passed.\n');

// ==========================================
// Test 3: A segment crossing Monday 00:00 from previous week is clipped
// ==========================================
console.log('[Test 3] Segment crossing Monday 00:00 from previous week is clipped...');
{
  // Sunday Nov 15 21:00 to Monday Nov 16 02:30 (5.5h total; 3h in prev week, 2.5h = 150 min in this week)
  const sStart = createZonedDate(2026, 11, 15, 21, 0, TZ_PHX);
  const sEnd = createZonedDate(2026, 11, 16, 2, 30, TZ_PHX);

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [
      {
        id: 's-cross-start',
        start_time: sStart,
        end_time: sEnd,
        category: 'work',
      },
    ],
    settings: { timezone: TZ_PHX, work_report_categories: ['work'] },
  });

  assert.strictEqual(summary.loggedMs, 150 * 60 * 1000, 'Logged ms should only include 150 min starting Monday 00:00');
  assert.strictEqual(summary.featured.totalMinutes, 150, 'Featured total minutes should be 150');
  assert.strictEqual(summary.featured.perDay[0], 150, 'Monday featured minutes should be 150');
}
console.log('✓ Test 3 passed.\n');

// ==========================================
// Test 4: Vacation segments excluded from counted time and do not add to work
// ==========================================
console.log('[Test 4] Vacation segments excluded from counted time & work hours...');
{
  const sWork = {
    start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 17, 0, TZ_PHX), // 8h = 480m
    category: 'work',
  };
  const sVacationCategory = {
    start_time: createZonedDate(2026, 11, 17, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 17, 13, 0, TZ_PHX), // 4h = 240m
    category: 'vacation',
  };
  const sVacationParent = {
    id: 's-vac-parent',
    entry_id: 'e-vac',
    start_time: createZonedDate(2026, 11, 18, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 18, 11, 0, TZ_PHX), // 2h = 120m
    category: 'reading',
  };

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [sWork, sVacationCategory, sVacationParent],
    entries: [
      {
        id: 'e-vac',
        on_vacation: true,
      },
    ],
    settings: { timezone: TZ_PHX, work_report_categories: ['work'] },
  });

  assert.strictEqual(summary.loggedMs, (480 + 240 + 120) * 60 * 1000, 'Total logged ms includes vacation');
  assert.strictEqual(summary.vacationMs, (240 + 120) * 60 * 1000, 'Vacation ms is 360m');
  assert.strictEqual(summary.countedMs, 480 * 60 * 1000, 'Counted ms excludes vacation (480m)');
  assert.strictEqual(summary.featured.totalMinutes, 480, 'Vacation never adds to featured total unless featured');
  assert.strictEqual(summary.byCategory.length, 1, 'byCategory excludes vacation rows');
  assert.strictEqual(summary.byCategory[0].category, 'work');
  assert.strictEqual(summary.byCategory[0].shareOfCounted, 100);

  // If vacation itself is featured, vacation time counts normally
  const summaryVac = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [sWork, sVacationCategory, sVacationParent],
    entries: [{ id: 'e-vac', on_vacation: true }],
    settings: { timezone: TZ_PHX, work_report_categories: ['work', 'vacation'] },
  });
  assert.strictEqual(summaryVac.featured.totalMinutes, 840, 'When vacation is featured, vacation time counts');
}
console.log('✓ Test 4 passed.\n');

// ==========================================
// Test 5: Several work categories selected
// ==========================================
console.log('[Test 5] Several work categories all add to work total...');
{
  const sWork = {
    start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 11, 0, TZ_PHX), // 120m
    category: 'work',
  };
  const sJobSearch = {
    start_time: createZonedDate(2026, 11, 16, 11, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 12, 30, TZ_PHX), // 90m
    category: 'job search',
  };
  const sChores = {
    start_time: createZonedDate(2026, 11, 16, 12, 30, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 13, 0, TZ_PHX), // 30m
    category: 'chores',
  };

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [sWork, sJobSearch, sChores],
    settings: {
      timezone: TZ_PHX,
      work_report_categories: ['work', 'job search'],
    },
  });

  assert.strictEqual(summary.featured.totalMinutes, 210, 'Featured total should be 120 + 90 = 210m');
  assert.deepStrictEqual(summary.featured.categoriesUsed, ['work', 'job search']);
}
console.log('✓ Test 5 passed.\n');

// ==========================================
// Test 6: Day-level rounding
// ==========================================
console.log('[Test 6] Day-level rounding: days rounded first, week total equals sum of rounded days...');
{
  // Day 0 (Mon): 84 seconds = 1.4 minutes -> rounds to 1 minute
  // Day 1 (Tue): 84 seconds = 1.4 minutes -> rounds to 1 minute
  // Sum of days = 1 + 1 = 2 minutes.
  // (Notice: total ms is 168 seconds = 2.8 minutes, which would round to 3 if rounded at week level!)
  const sMon = {
    start_time: new Date(createZonedDate(2026, 11, 16, 9, 0, TZ_PHX).getTime()),
    end_time: new Date(createZonedDate(2026, 11, 16, 9, 0, TZ_PHX).getTime() + 84 * 1000),
    category: 'work',
  };
  const sTue = {
    start_time: new Date(createZonedDate(2026, 11, 17, 9, 0, TZ_PHX).getTime()),
    end_time: new Date(createZonedDate(2026, 11, 17, 9, 0, TZ_PHX).getTime() + 84 * 1000),
    category: 'work',
  };

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [sMon, sTue],
    settings: { timezone: TZ_PHX, work_report_categories: ['work'] },
  });

  assert.strictEqual(summary.featured.perDay[0], 1, 'Monday should round to 1m');
  assert.strictEqual(summary.featured.perDay[1], 1, 'Tuesday should round to 1m');
  assert.strictEqual(summary.featured.perDay[2], 0, 'Wednesday should be 0m');
  const sumPerDay = summary.featured.perDay.reduce((a, b) => a + b, 0);
  assert.strictEqual(summary.featured.totalMinutes, sumPerDay, 'Week total must strictly equal sum of perDay numbers');
  assert.strictEqual(summary.featured.totalMinutes, 2, 'Week total should be 2 minutes, not 3');
}
console.log('✓ Test 6 passed.\n');

// ==========================================
// Test 7: Timezone handling (America/Phoenix, America/New_York DST 169h)
// ==========================================
console.log('[Test 7] Timezone handling: America/Phoenix vs America/New_York (169h DST week)...');
{
  // 1. America/Phoenix: no DST
  const phxStart = createZonedDate(2026, 10, 26, 0, 0, 'America/Phoenix');
  const phxEnd = getNextWeekStart(phxStart, 'America/Phoenix');
  const phxHours = (phxEnd.getTime() - phxStart.getTime()) / (3600 * 1000);
  assert.strictEqual(phxHours, 168, 'Phoenix week must be exactly 168 hours');

  // 2. America/New_York on Oct 26 to Nov 1, 2026 (DST ends Nov 1, 2026, 25h Sunday)
  const nyDstStart = createZonedDate(2026, 10, 26, 0, 0, 'America/New_York');
  const nyDstEnd = getNextWeekStart(nyDstStart, 'America/New_York');
  const nyDstHours = (nyDstEnd.getTime() - nyDstStart.getTime()) / (3600 * 1000);
  assert.strictEqual(nyDstHours, 169, 'America/New_York fall-back week must be exactly 169 hours');

  // Confirm computeWeekSummary coverage reflects 169 hours
  const summary = computeWeekSummary({
    weekStart: nyDstStart,
    now: nyDstEnd, // finished week
    segments: [],
    settings: { timezone: 'America/New_York' },
  });
  assert.strictEqual(summary.coverage.availableMs, 169 * 3600 * 1000, 'Coverage available ms must be 169 hours');
  assert(summary.coverage.text.includes('169h'), `Coverage text must mention 169h, got: ${summary.coverage.text}`);
}
console.log('✓ Test 7 passed.\n');

// ==========================================
// Test 8: Gap detection
// ==========================================
console.log('[Test 8] Gap detection: 14m gap ignored, 15m reported, current week stops at now...');
{
  // Week runs Monday 00:00 to Monday 00:00
  // Segment 1: Monday 00:00 to 01:00 (60m)
  // Gap 1: 01:00 to 01:14 (14m) -> ignored
  // Segment 2: Monday 01:14 to 02:00 (46m)
  // Gap 2: 02:00 to 02:15 (15m) -> reported!
  // Segment 3: Monday 02:15 to 03:00 (45m)
  // now = Monday 03:10 (10m after segment 3 -> ignored because < 15m)
  const t0 = createZonedDate(2026, 11, 16, 0, 0, TZ_PHX);
  const t1 = createZonedDate(2026, 11, 16, 1, 0, TZ_PHX);
  const t2 = new Date(t1.getTime() + 14 * 60 * 1000); // 14m gap
  const t3 = createZonedDate(2026, 11, 16, 2, 0, TZ_PHX);
  const t4 = new Date(t3.getTime() + 15 * 60 * 1000); // 15m gap
  const t5 = createZonedDate(2026, 11, 16, 3, 0, TZ_PHX);
  const now = new Date(t5.getTime() + 10 * 60 * 1000); // now is 3:10 AM

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now,
    segments: [
      { start_time: t0, end_time: t1, category: 'sleep' },
      { start_time: t2, end_time: t3, category: 'chores' },
      { start_time: t4, end_time: t5, category: 'work' },
    ],
    settings: { timezone: TZ_PHX },
  });

  assert.strictEqual(summary.gaps.length, 1, 'Only the 15m gap should be reported');
  assert.strictEqual(summary.gaps[0].minutes, 15, 'Reported gap should be 15m');
  assert.strictEqual(summary.gaps[0].start.getTime(), t3.getTime());
  assert.strictEqual(summary.gaps[0].end.getTime(), t4.getTime());
}
console.log('✓ Test 8 passed.\n');

// ==========================================
// Test 9: People & Alone
// ==========================================
console.log('[Test 9] People: two tags both get full duration, no tags = alone, case insensitive...');
{
  const s1 = {
    start_time: createZonedDate(2026, 11, 16, 10, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 11, 0, TZ_PHX), // 60m
    category: 'social time',
    company: ['Alice', 'Bob'],
  };
  const s2 = {
    start_time: createZonedDate(2026, 11, 16, 11, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 11, 30, TZ_PHX), // 30m
    category: 'social meals',
    company: ['alice '], // Extra space and lowercase
  };
  const s3 = {
    start_time: createZonedDate(2026, 11, 16, 12, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 12, 45, TZ_PHX), // 45m
    category: 'reading',
    company: [], // Alone
  };
  const sVacation = {
    start_time: createZonedDate(2026, 11, 16, 13, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 15, 0, TZ_PHX), // 120m vacation with Alice
    category: 'vacation',
    company: ['Alice'],
  };

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [s1, s2, s3, sVacation],
    settings: { timezone: TZ_PHX },
  });

  // Alice: 60 + 30 = 90m (vacation 120m excluded)
  const alice = summary.people.find((p) => p.name.toLowerCase() === 'alice');
  assert(alice, 'Alice must be in people list');
  assert.strictEqual(alice.minutes, 90, 'Alice total should be 90m');

  // Bob: 60m
  const bob = summary.people.find((p) => p.name.toLowerCase() === 'bob');
  assert(bob, 'Bob must be in people list');
  assert.strictEqual(bob.minutes, 60, 'Bob total should be 60m');

  // Alone: 45m
  assert.strictEqual(summary.aloneMinutes, 45, 'Alone minutes should be 45m');
}
console.log('✓ Test 9 passed.\n');

// ==========================================
// Test 10: Comparison availability (<24h vs >=24h)
// ==========================================
console.log('[Test 10] Comparison unavailable when previous week has under 24 logged hours...');
{
  const prevWeekStart = getPreviousWeekStart(weekStartNov16, TZ_PHX);

  // 1. Previous week has only 10 hours (< 24h)
  const summaryUnder24 = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [
      {
        start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
        end_time: createZonedDate(2026, 11, 16, 17, 0, TZ_PHX), // 8h
        category: 'work',
      },
    ],
    previousSegments: [
      {
        start_time: createZonedDate(2026, 11, 9, 9, 0, TZ_PHX),
        end_time: createZonedDate(2026, 11, 9, 19, 0, TZ_PHX), // 10h
        category: 'work',
      },
    ],
    settings: { timezone: TZ_PHX, work_report_categories: ['work'] },
  });

  assert.strictEqual(summaryUnder24.comparison.available, false, 'Comparison must be unavailable when prev < 24h');

  // 2. Previous week has 25 hours (>= 24h)
  const prevSegs25h = [];
  for (let d = 0; d < 5; d++) {
    prevSegs25h.push({
      start_time: createZonedDate(2026, 11, 9 + d, 9, 0, TZ_PHX),
      end_time: createZonedDate(2026, 11, 9 + d, 14, 0, TZ_PHX), // 5h * 5 = 25h
      category: 'work',
    });
  }

  const summary25h = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [
      {
        start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
        end_time: createZonedDate(2026, 11, 16, 17, 0, TZ_PHX), // 8h work = 480m
        category: 'work',
      },
    ],
    previousSegments: prevSegs25h,
    settings: { timezone: TZ_PHX, work_report_categories: ['work'] },
  });

  assert.strictEqual(summary25h.comparison.available, true, 'Comparison must be available when prev >= 24h');
  // Prev work: 25h = 1500m. This week: 8h = 480m. Work delta: 480 - 1500 = -1020m.
  assert.strictEqual(summary25h.comparison.workDeltaMinutes, -1020);
}
console.log('✓ Test 10 passed.\n');

// ==========================================
// Test 11: Empty week returns zeros and no errors
// ==========================================
console.log('[Test 11] Empty week returns clean zeros and no errors...');
{
  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [],
    entries: [],
    settings: { timezone: TZ_PHX, work_report_categories: ['work'] },
  });

  assert.strictEqual(summary.loggedMs, 0);
  assert.strictEqual(summary.vacationMs, 0);
  assert.strictEqual(summary.countedMs, 0);
  assert.strictEqual(summary.featured.totalMinutes, 0);
  assert.deepStrictEqual(summary.featured.perDay, [0, 0, 0, 0, 0, 0, 0]);
  assert.strictEqual(summary.byCategory.length, 0);
  assert.strictEqual(summary.byDay.length, 7);
  for (const day of summary.byDay) {
    assert.strictEqual(day.loggedMinutes, 0);
    assert.strictEqual(day.workMinutes, 0);
    assert.strictEqual(day.byCategory.length, 0);
  }
  assert.strictEqual(summary.people.length, 0);
  assert.strictEqual(summary.aloneMinutes, 0);
  assert.strictEqual(summary.comparison.available, false);
  assert.strictEqual(summary.quality.unconfirmedSegments, 0);
  assert.strictEqual(summary.quality.entriesNeedingAttention, 0);
  assert.strictEqual(summary.quality.unsyncedChanges, 0);
}
console.log('✓ Test 11 passed.\n');

// ==========================================
// Test 12: Overlapping segments count each minute once
// ==========================================
console.log('[Test 12] Overlapping segments count each minute once...');
{
  // Segment 1: 10:00 to 11:00 (60m)
  // Segment 2: 10:30 to 11:30 (60m)
  // Union is 10:00 to 11:30 = 90 minutes.
  const s1 = {
    start_time: createZonedDate(2026, 11, 16, 10, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 11, 0, TZ_PHX),
    category: 'work',
  };
  const s2 = {
    start_time: createZonedDate(2026, 11, 16, 10, 30, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 11, 30, TZ_PHX),
    category: 'work',
  };

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [s1, s2],
    settings: { timezone: TZ_PHX, work_report_categories: ['work'] },
  });

  assert.strictEqual(summary.loggedMs, 90 * 60 * 1000, 'Logged time must be 90m for overlapping segments');
  assert.strictEqual(summary.featured.totalMinutes, 90, 'Featured total must be 90m');
  assert.strictEqual(summary.byCategory[0].minutes, 90, 'Category total must be 90m');
}
console.log('✓ Test 12 passed.\n');

// ==========================================
// Test 13: Percentages use counted time & vacation only week does not divide by zero
// ==========================================
console.log('[Test 13] Percentages use counted time; week of only vacation does not divide by zero...');
{
  // Week with only vacation
  const sVac = {
    start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 17, 0, TZ_PHX), // 8h vacation
    category: 'vacation',
  };

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [sVac],
    settings: { timezone: TZ_PHX, work_report_categories: ['work'] },
  });

  assert.strictEqual(summary.loggedMs, 8 * 3600 * 1000);
  assert.strictEqual(summary.vacationMs, 8 * 3600 * 1000);
  assert.strictEqual(summary.countedMs, 0);
  assert.strictEqual(summary.isAllVacation, true);
  assert.strictEqual(summary.featured.totalMinutes, 0);
  assert.strictEqual(summary.byCategory.length, 0);

  // Week with 2h work and 2h chores (counted = 4h = 240m)
  const sWork = {
    start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 11, 0, TZ_PHX), // 2h
    category: 'work',
  };
  const sChores = {
    start_time: createZonedDate(2026, 11, 16, 11, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 13, 0, TZ_PHX), // 2h
    category: 'chores',
  };

  const summaryCounted = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [sWork, sChores],
    settings: { timezone: TZ_PHX, work_report_categories: ['work'] },
  });

  assert.strictEqual(summaryCounted.byCategory[0].shareOfCounted, 50);
  assert.strictEqual(summaryCounted.byCategory[1].shareOfCounted, 50);
}
console.log('✓ Test 13 passed.\n');

// ==========================================
// Test 14: Data loading exports & pagination constants
// ==========================================
console.log('[Test 14] Data loading functions and pagination constants...');
{
  assert.strictEqual(typeof fetchWeekReviewData, 'function');
  assert.strictEqual(PAGE_SIZE, 1000, 'Page size must be 1000 rows to match Supabase default limit');
  assert.strictEqual(MIN_GAP_MINUTES, 15, 'MIN_GAP_MINUTES must be 15');
  assert.strictEqual(MIN_COMPARISON_HOURS, 24, 'MIN_COMPARISON_HOURS must be 24');

  // Test Monday navigation rule: on Mondays, default week is the previous week
  const mondayNow = createZonedDate(2026, 11, 23, 14, 0, TZ_PHX); // Monday Nov 23
  const defaultMondayStart = getDefaultSelectedWeekStart(mondayNow, TZ_PHX);
  const zPartsMon = getZonedDateParts(defaultMondayStart, TZ_PHX);
  assert.strictEqual(zPartsMon.day, 16, 'On Monday Nov 23, screen must open on week of Nov 16');

  // On Tuesday Nov 24, screen opens on current week (Nov 23)
  const tuesdayNow = createZonedDate(2026, 11, 24, 10, 0, TZ_PHX);
  const defaultTueStart = getDefaultSelectedWeekStart(tuesdayNow, TZ_PHX);
  const zPartsTue = getZonedDateParts(defaultTueStart, TZ_PHX);
  assert.strictEqual(zPartsTue.day, 23, 'On Tuesday Nov 24, screen must open on week of Nov 23');
}
console.log('✓ Test 14 passed.\n');

console.log('====================================================');
console.log('All Milestone 4.1 Unit Tests Passed Successfully!');
console.log('====================================================');
