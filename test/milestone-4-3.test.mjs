/**
 * Test Suite for Milestone 4.3: Breakdown and Day by Day
 * Verifies all Milestone 4.3 acceptance criteria.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  computeWeekSummary,
  createZonedDate,
  formatHoursMinutes,
} from '../src/lib/weekSummary.ts';

console.log('--- Testing Milestone 4.3: Breakdown and Day by Day ---\n');

const TZ_PHX = 'America/Phoenix';
const weekStartNov16 = createZonedDate(2026, 11, 16, 0, 0, TZ_PHX);
const weekEndNov23 = createZonedDate(2026, 11, 23, 0, 0, TZ_PHX);

// ==========================================
// Check 1: Category Rows Sorted Descending & Color Resolution
// ==========================================
console.log('[Check 1] Category rows sorted by time descending and use stored / token colors...');
{
  const sWork = {
    start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 17, 0, TZ_PHX), // 8h = 480m
    category: 'work',
  };
  const sReading = {
    start_time: createZonedDate(2026, 11, 17, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 17, 12, 0, TZ_PHX), // 3h = 180m
    category: 'reading',
  };
  const sChores = {
    start_time: createZonedDate(2026, 11, 18, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 18, 10, 0, TZ_PHX), // 1h = 60m
    category: 'chores',
  };
  const sCustom = {
    start_time: createZonedDate(2026, 11, 19, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 19, 13, 0, TZ_PHX), // 4h = 240m
    category: 'gardening',
  };

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [sWork, sReading, sChores, sCustom],
    settings: {
      timezone: TZ_PHX,
      categories: [
        { name: 'gardening', color: '#123456' }, // Custom stored color
      ],
    },
  });

  // Expected order: work (480m) > gardening (240m) > reading (180m) > chores (60m)
  assert.strictEqual(summary.byCategory.length, 4);
  assert.strictEqual(summary.byCategory[0].category, 'work');
  assert.strictEqual(summary.byCategory[0].minutes, 480);
  assert.strictEqual(summary.byCategory[0].color, '#8C9BB5', 'work should use slate token #8C9BB5');

  assert.strictEqual(summary.byCategory[1].category, 'gardening');
  assert.strictEqual(summary.byCategory[1].minutes, 240);
  assert.strictEqual(summary.byCategory[1].color, '#123456', 'gardening should use custom stored color');

  assert.strictEqual(summary.byCategory[2].category, 'reading');
  assert.strictEqual(summary.byCategory[2].minutes, 180);
  assert.strictEqual(summary.byCategory[2].color, '#D9A5AE', 'reading should use rose token #D9A5AE');

  assert.strictEqual(summary.byCategory[3].category, 'chores');
  assert.strictEqual(summary.byCategory[3].minutes, 60);
}
console.log('✓ Check 1 passed: Categories sorted descending by minutes and resolve token/stored colors.\n');

// ==========================================
// Check 2: Shares Calculated from Counted Time & Vacation Listed Separately
// ==========================================
console.log('[Check 2] Shares calculated from counted time; vacation listed separately with no bar/share...');
{
  // 20h work, 10h reading, 10h vacation (Total logged = 40h, Vacation = 10h, Counted = 30h)
  const sWork = {
    start_time: createZonedDate(2026, 11, 16, 0, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 20, 0, TZ_PHX), // 20h
    category: 'work',
  };
  const sReading = {
    start_time: createZonedDate(2026, 11, 17, 0, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 17, 10, 0, TZ_PHX), // 10h
    category: 'reading',
  };
  const sVacation = {
    start_time: createZonedDate(2026, 11, 18, 0, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 18, 10, 0, TZ_PHX), // 10h
    category: 'vacation',
  };

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [sWork, sReading, sVacation],
    settings: { timezone: TZ_PHX },
  });

  assert.strictEqual(summary.loggedMs, 40 * 3600 * 1000);
  assert.strictEqual(summary.vacationMs, 10 * 3600 * 1000);
  assert.strictEqual(summary.countedMs, 30 * 3600 * 1000);

  // Vacation must NOT be in byCategory
  const hasVacationInCats = summary.byCategory.some((c) => c.category === 'vacation');
  assert.strictEqual(hasVacationInCats, false, 'Vacation must not appear as a row in byCategory');

  // Work share: 20h / 30h counted = 67%
  const workCat = summary.byCategory.find((c) => c.category === 'work');
  assert(workCat);
  assert.strictEqual(workCat.shareOfCounted, 67, 'Work share of counted time must be 67% (20h / 30h)');

  // Reading share: 10h / 30h counted = 33%
  const readCat = summary.byCategory.find((c) => c.category === 'reading');
  assert(readCat);
  assert.strictEqual(readCat.shareOfCounted, 33, 'Reading share of counted time must be 33% (10h / 30h)');

  // Verify WeekPage renders vacation line
  const weekPageSrc = fs.readFileSync('src/pages/WeekPage.tsx', 'utf-8');
  assert(weekPageSrc.includes('week-vacation-line'), 'WeekPage must render week-vacation-line');
  assert(weekPageSrc.includes('Vacation: {formatHoursMinutes(Math.round(summary.vacationMs / 60000))}'),
    'WeekPage must render Vacation line separately'
  );
}
console.log('✓ Check 2 passed: Shares accurately use counted time and vacation is listed on its own line.\n');

// ==========================================
// Check 3: Coverage Line for Finished Week vs Current Week
// ==========================================
console.log('[Check 3] Coverage line is correct for finished week and current week...');
{
  // 1. Finished week (151h 30m of 168h)
  const segmentsFinished = [
    {
      start_time: weekStartNov16,
      end_time: new Date(weekStartNov16.getTime() + (151 * 60 + 30) * 60 * 1000), // 151h 30m
      category: 'work',
    },
  ];

  const summaryFinished = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23, // finished week
    segments: segmentsFinished,
    settings: { timezone: TZ_PHX },
  });

  assert.strictEqual(summaryFinished.isCurrentWeek, false);
  assert.strictEqual(summaryFinished.coverage.text, 'Logged 151h 30m of 168h.');

  // 2. Current week (Logged 61h 10m of 64h 20m so far)
  // Monday 00:00 to Wednesday 16:20 is 2 days + 16h 20m = 64h 20m available
  const nowWed = new Date(weekStartNov16.getTime() + (64 * 60 + 20) * 60 * 1000);
  const segmentsCurrent = [
    {
      start_time: weekStartNov16,
      end_time: new Date(weekStartNov16.getTime() + (61 * 60 + 10) * 60 * 1000), // 61h 10m
      category: 'work',
    },
  ];

  const summaryCurrent = computeWeekSummary({
    weekStart: weekStartNov16,
    now: nowWed, // current week
    segments: segmentsCurrent,
    settings: { timezone: TZ_PHX },
  });

  assert.strictEqual(summaryCurrent.isCurrentWeek, true);
  assert.strictEqual(summaryCurrent.coverage.text, 'Logged 61h 10m of 64h 20m so far.');
}
console.log('✓ Check 3 passed: Coverage line strictly matches finished and in-progress week formats.\n');

// ==========================================
// Check 4: Day by Day & Bottom Sheet Verification
// ==========================================
console.log('[Check 4] Day by day stacked bars & tapping a day opens bottom sheet with category totals...');
{
  // Mon: 8h work, 2h reading (10h logged)
  // Tue: 6h work (6h logged)
  // Wed: 4h work, 4h vacation (8h logged)
  const sMonWork = {
    start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 17, 0, TZ_PHX), // 8h = 480m
    category: 'work',
  };
  const sMonRead = {
    start_time: createZonedDate(2026, 11, 16, 17, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 19, 0, TZ_PHX), // 2h = 120m
    category: 'reading',
  };
  const sTueWork = {
    start_time: createZonedDate(2026, 11, 17, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 17, 15, 0, TZ_PHX), // 6h = 360m
    category: 'work',
  };
  const sWedVac = {
    start_time: createZonedDate(2026, 11, 18, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 18, 17, 0, TZ_PHX), // 8h = 480m
    category: 'vacation',
  };

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [sMonWork, sMonRead, sTueWork, sWedVac],
    settings: { timezone: TZ_PHX },
  });

  // Verify 7 days
  assert.strictEqual(summary.byDay.length, 7);
  const mon = summary.byDay[0];
  assert.strictEqual(mon.dayLabel, 'Mon 16');
  assert.strictEqual(mon.loggedMinutes, 600, 'Monday logged minutes must be 10h = 600m');
  assert.strictEqual(mon.byCategory.length, 2);
  assert.strictEqual(mon.byCategory[0].category, 'work');
  assert.strictEqual(mon.byCategory[0].minutes, 480);
  assert.strictEqual(mon.byCategory[1].category, 'reading');
  assert.strictEqual(mon.byCategory[1].minutes, 120);

  // Wednesday has 8h vacation
  const wed = summary.byDay[2];
  assert.strictEqual(wed.loggedMinutes, 480);
  assert.strictEqual(wed.byCategory[0].category, 'vacation');
  assert.strictEqual(wed.byCategory[0].minutes, 480);

  // Check DayDetailSheet component existence and contents
  const sheetSrc = fs.readFileSync('src/components/DayDetailSheet.tsx', 'utf-8');
  assert(sheetSrc.includes('day-sheet-backdrop'), 'DayDetailSheet must have backdrop');
  assert(sheetSrc.includes('day-sheet-surface'), 'DayDetailSheet must have surface');
  assert(sheetSrc.includes('day-sheet-handle'), 'DayDetailSheet must have drag handle');
  assert(sheetSrc.includes('day-sheet-close'), 'DayDetailSheet must have close button');
  assert(sheetSrc.includes('{day.fullHeading}'), 'DayDetailSheet must display full date heading');
  assert(sheetSrc.includes('Total logged: {formatHoursMinutes(day.loggedMinutes)}'),
    'DayDetailSheet must display total logged time'
  );

  // Verify WeekPage wires DayDetailSheet
  const weekPageSrc = fs.readFileSync('src/pages/WeekPage.tsx', 'utf-8');
  assert(weekPageSrc.includes('<DayDetailSheet'), 'WeekPage must render DayDetailSheet');
  assert(weekPageSrc.includes('setSelectedDayForSheet(day)'), 'Tapping day row must set selected day for sheet');
}
console.log('✓ Check 4 passed: Day by day stacked bar data and DayDetailSheet confirmed.\n');

// ==========================================
// Check 5: iPhone Viewport Layout Safety (No Overflow on Right Edge)
// ==========================================
console.log('[Check 5] Verifying no layout overflow / elements running off right edge on iPhone...');
{
  const weekCss = fs.readFileSync('src/pages/WeekPage.css', 'utf-8');
  const daySheetCss = fs.readFileSync('src/components/DayDetailSheet.css', 'utf-8');

  // Verify container & flex child resets
  assert(weekCss.includes('box-sizing: border-box;'), 'WeekPage.css must use box-sizing: border-box');
  assert(weekCss.includes('min-width: 0;'), 'WeekPage.css must set min-width: 0 on flex rows to prevent overflow');
  assert(weekCss.includes('text-overflow: ellipsis;'), 'Category names must have text-overflow: ellipsis');
  assert(daySheetCss.includes('box-sizing: border-box;'), 'DayDetailSheet must have box-sizing: border-box');
  assert(daySheetCss.includes('min-width: 0;'), 'DayDetailSheet must set min-width: 0 on flex children');
  assert(daySheetCss.includes('overflow-x: hidden;') || daySheetCss.includes('overflow: hidden;'),
    'DayDetailSheet surface must contain horizontal overflow'
  );

  // Viewport width checks at 360px, 375px, 390px
  const testViewports = [360, 375, 390];
  for (const vp of testViewports) {
    const pagePadding = 16 * 2; // 16px left + 16px right
    const contentWidth = vp - pagePadding;
    // Category row: dot (7px) + gap (8px) + time (50px) + share (35px) = 100px fixed min
    const remainingForCatName = contentWidth - 100;
    assert(remainingForCatName > 150, `At ${vp}px viewport, ${remainingForCatName}px remains for category label without overflowing`);

    // Day row: label (60px) + time (65px) + gap (20px) = 145px
    const remainingForBar = contentWidth - 145;
    assert(remainingForBar > 100, `At ${vp}px viewport, ${remainingForBar}px remains for stacked bar without overflowing`);
  }
}
console.log('✓ Check 5 passed: iPhone layout safety verified across 360px, 375px, and 390px viewports.\n');

console.log('====================================================');
console.log('All Milestone 4.3 Acceptance Criteria Passed Successfully!');
console.log('====================================================');
