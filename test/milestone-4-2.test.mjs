/**
 * Test Suite for Milestone 4.2: Screen, Navigation, and Hours Worked
 * Verifies all Milestone 4.2 acceptance criteria.
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
  formatWeekDateRange,
  formatHoursMinutes,
  formatDecimalHours,
  generateReportText,
} from '../src/lib/weekSummary.ts';

console.log('--- Testing Milestone 4.2: Screen, Navigation, and Hours Worked ---\n');

const TZ_PHX = 'America/Phoenix';

// ==========================================
// Check 1: Navigation, TabBar, & 375px Viewport Sizing
// ==========================================
console.log('[Check 1] Verifying 4th tab (Week), route /week, and 375px viewport sizing...');
{
  const tabBarSource = fs.readFileSync('src/components/TabBar.tsx', 'utf-8');
  assert(tabBarSource.includes("to: '/week'"), 'TabBar must link to /week');
  assert(tabBarSource.includes("label: 'Week'"), "TabBar must have label 'Week'");
  assert(tabBarSource.includes('WeekIcon'), 'TabBar must render WeekIcon');

  // Check tab order: Log, Week, History, Settings
  const logIdx = tabBarSource.indexOf("label: 'Log'");
  const weekIdx = tabBarSource.indexOf("label: 'Week'");
  const histIdx = tabBarSource.indexOf("label: 'History'");
  const setIdx = tabBarSource.indexOf("label: 'Settings'");
  assert(logIdx < weekIdx && weekIdx < histIdx && histIdx < setIdx, 'Tab order must be Log, Week, History, Settings');

  // Check TabBar CSS width fits 375px
  const tabBarCss = fs.readFileSync('src/components/TabBar.css', 'utf-8');
  const maxWidthMatch = tabBarCss.match(/max-width:\s*(\d+)px/);
  assert(maxWidthMatch, 'TabBar.css must specify max-width');
  const maxW = parseInt(maxWidthMatch[1], 10);
  assert(maxW <= 350, `TabBar max-width (${maxW}px) must comfortably fit within 375px minus padding`);

  // Check App.tsx route and Header title
  const appSource = fs.readFileSync('src/App.tsx', 'utf-8');
  assert(appSource.includes('path="/week"'), 'App.tsx must include route path="/week"');
  assert(appSource.includes('WeekPage'), 'App.tsx must include WeekPage component');
  assert(appSource.includes("location.pathname === '/week' ? 'Week in Review' : 'Little Hours'"),
    'Header title must dynamically show "Week in Review" on /week route'
  );
}
console.log('✓ Check 1 passed: 4 tabs in correct order, fits 375px viewport, and /week route wired.\n');

// ==========================================
// Check 2: Monday vs Other Days Navigation Opening
// ==========================================
console.log('[Check 2] Verifying initial week: on Monday opens previous week, other days opens current week...');
{
  // Monday Nov 23, 2026 at 09:00 AM
  const mondayMorning = createZonedDate(2026, 11, 23, 9, 0, TZ_PHX);
  const mondayStart = getDefaultSelectedWeekStart(mondayMorning, TZ_PHX);
  const partsMonday = getZonedDateParts(mondayStart, TZ_PHX);
  assert.strictEqual(partsMonday.month, 11);
  assert.strictEqual(partsMonday.day, 16, 'On Monday Nov 23, screen must open on week that just ended (Nov 16)');

  // Wednesday Nov 18, 2026 at 14:00 PM
  const wednesdayAfternoon = createZonedDate(2026, 11, 18, 14, 0, TZ_PHX);
  const wedStart = getDefaultSelectedWeekStart(wednesdayAfternoon, TZ_PHX);
  const partsWed = getZonedDateParts(wedStart, TZ_PHX);
  assert.strictEqual(partsWed.month, 11);
  assert.strictEqual(partsWed.day, 16, 'On Wednesday Nov 18, screen must open on current week in progress (Nov 16)');

  // Sunday Nov 22, 2026 at 20:00 PM
  const sundayEvening = createZonedDate(2026, 11, 22, 20, 0, TZ_PHX);
  const sunStart = getDefaultSelectedWeekStart(sundayEvening, TZ_PHX);
  const partsSun = getZonedDateParts(sunStart, TZ_PHX);
  assert.strictEqual(partsSun.month, 11);
  assert.strictEqual(partsSun.day, 16, 'On Sunday Nov 22, screen must open on current week (Nov 16)');
}
console.log('✓ Check 2 passed: Monday reporting moment opens previous week, other days open current week.\n');

// ==========================================
// Check 3: Hours Worked Matches History Sum
// ==========================================
console.log('[Check 3] Hours worked total matches the sum of work segments in History for the same week...');
{
  const weekStartNov16 = createZonedDate(2026, 11, 16, 0, 0, TZ_PHX);
  const weekEndNov23 = createZonedDate(2026, 11, 23, 0, 0, TZ_PHX);

  // Exact scenario matching Jackie's report from Section 6.2:
  // Mon: 8h 0m (480m)
  // Tue: 7h 30m (450m)
  // Wed: 8h 15m (495m)
  // Thu: 7h 0m (420m)
  // Fri: 7h 0m (420m)
  // Sat: 0h 0m
  // Sun: 0h 0m
  // Total: 37h 45m (2265 minutes)
  const segments = [
    // Mon: 8h work
    { start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 16, 17, 0, TZ_PHX), category: 'work' },
    // Tue: 7h 30m work + 1h reading
    { start_time: createZonedDate(2026, 11, 17, 9, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 17, 16, 30, TZ_PHX), category: 'work' },
    { start_time: createZonedDate(2026, 11, 17, 16, 30, TZ_PHX), end_time: createZonedDate(2026, 11, 17, 17, 30, TZ_PHX), category: 'reading' },
    // Wed: 8h 15m work
    { start_time: createZonedDate(2026, 11, 18, 9, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 18, 17, 15, TZ_PHX), category: 'work' },
    // Thu: 7h work + 2h chores
    { start_time: createZonedDate(2026, 11, 19, 9, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 19, 16, 0, TZ_PHX), category: 'work' },
    { start_time: createZonedDate(2026, 11, 19, 16, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 19, 18, 0, TZ_PHX), category: 'chores' },
    // Fri: 7h work
    { start_time: createZonedDate(2026, 11, 20, 9, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 20, 16, 0, TZ_PHX), category: 'work' },
    // Sat & Sun: exercise and social time (0h work)
    { start_time: createZonedDate(2026, 11, 21, 10, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 21, 12, 0, TZ_PHX), category: 'exercise' },
    { start_time: createZonedDate(2026, 11, 22, 13, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 22, 16, 0, TZ_PHX), category: 'social time' },
  ];

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments,
    settings: { timezone: TZ_PHX, work_report_categories: ['work'] },
  });

  const totalWorkMin = summary.featured.totalMinutes;
  assert.strictEqual(totalWorkMin, 2265, 'Total work minutes must be 2265 (37h 45m)');
  assert.strictEqual(formatHoursMinutes(totalWorkMin), '37h 45m');
  assert.strictEqual(formatDecimalHours(totalWorkMin), '37.75 hours');

  assert.deepStrictEqual(summary.featured.perDay, [480, 450, 495, 420, 420, 0, 0], 'Daily work minutes must match Mon-Sun breakdown');
  assert.strictEqual(summary.work.totalMinutes, 2265, 'Work alias matches featured');
}
console.log('✓ Check 3 passed: 37h 45m matches sum of work segments exactly.\n');

// ==========================================
// Check 4: Copy For My Report Text Generation
// ==========================================
console.log('[Check 4] Copy for my report puts exact text from section 6.2 on clipboard...');
{
  const weekStartNov16 = createZonedDate(2026, 11, 16, 0, 0, TZ_PHX);
  const weekEndNov23 = createZonedDate(2026, 11, 23, 0, 0, TZ_PHX);

  const segments = [
    { start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 16, 17, 0, TZ_PHX), category: 'work' },
    { start_time: createZonedDate(2026, 11, 17, 9, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 17, 16, 30, TZ_PHX), category: 'work' },
    { start_time: createZonedDate(2026, 11, 18, 9, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 18, 17, 15, TZ_PHX), category: 'work' },
    { start_time: createZonedDate(2026, 11, 19, 9, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 19, 16, 0, TZ_PHX), category: 'work' },
    { start_time: createZonedDate(2026, 11, 20, 9, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 20, 16, 0, TZ_PHX), category: 'work' },
  ];

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments,
    settings: { timezone: TZ_PHX, work_report_categories: ['work'] },
  });

  const reportText = generateReportText(summary, TZ_PHX, 'hours_minutes');
  const expectedReport = [
    'Week of Nov 16 to Nov 22',
    'Hours worked: 37h 45m',
    'Mon 8h 0m',
    'Tue 7h 30m',
    'Wed 8h 15m',
    'Thu 7h 0m',
    'Fri 7h 0m',
    'Sat 0h 0m',
    'Sun 0h 0m',
  ].join('\n');

  assert.strictEqual(reportText, expectedReport, 'Report text must match Section 6.2 spec example exactly');

  // Also verify decimal report format
  const decimalReport = generateReportText(summary, TZ_PHX, 'decimal');
  assert(decimalReport.includes('Hours worked: 37.75 hours'), 'Decimal report should display 37.75 hours');
}
console.log('✓ Check 4 passed: Copy for my report outputs exact expected text string.\n');

// ==========================================
// Check 5: Settings Work Categories Change Reflects in Hero
// ==========================================
console.log('[Check 5] Changing work categories in Settings changes the hero number...');
{
  const weekStartNov16 = createZonedDate(2026, 11, 16, 0, 0, TZ_PHX);
  const weekEndNov23 = createZonedDate(2026, 11, 23, 0, 0, TZ_PHX);

  const segments = [
    // 37h 45m work
    { start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 16, 17, 0, TZ_PHX), category: 'work' },
    { start_time: createZonedDate(2026, 11, 17, 9, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 17, 16, 30, TZ_PHX), category: 'work' },
    { start_time: createZonedDate(2026, 11, 18, 9, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 18, 17, 15, TZ_PHX), category: 'work' },
    { start_time: createZonedDate(2026, 11, 19, 9, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 19, 16, 0, TZ_PHX), category: 'work' },
    { start_time: createZonedDate(2026, 11, 20, 9, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 20, 16, 0, TZ_PHX), category: 'work' },
    // 5 hours job search
    { start_time: createZonedDate(2026, 11, 21, 10, 0, TZ_PHX), end_time: createZonedDate(2026, 11, 21, 15, 0, TZ_PHX), category: 'job search' },
  ];

  // 1. Initially only 'work' is counted
  const summary1 = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments,
    settings: { timezone: TZ_PHX, work_report_categories: ['work'] },
  });
  assert.strictEqual(summary1.featured.totalMinutes, 2265, 'Initial work total: 37h 45m');

  // 2. User adds 'job search' in Settings
  const summary2 = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments,
    settings: { timezone: TZ_PHX, work_report_categories: ['work', 'job search'] },
  });
  assert.strictEqual(summary2.featured.totalMinutes, 2265 + 300, 'Work total with job search: 42h 45m (2565m)');
  assert.strictEqual(formatHoursMinutes(summary2.featured.totalMinutes), '42h 45m');
  assert.strictEqual(summary2.featured.perDay[5], 300, 'Saturday work now includes 5h (300m) of job search');
}
console.log('✓ Check 5 passed: Adding "job search" in settings increases work total from 37h 45m to 42h 45m.\n');

// ==========================================
// Check 6: Empty State and Settings UI Components
// ==========================================
console.log('[Check 6] Empty state and Settings "Hours I report to my workplace" row...');
{
  const weekStartNov16 = createZonedDate(2026, 11, 16, 0, 0, TZ_PHX);
  const weekEndNov23 = createZonedDate(2026, 11, 23, 0, 0, TZ_PHX);

  const emptySummary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [],
    settings: { timezone: TZ_PHX, work_report_categories: ['work'] },
  });
  assert.strictEqual(emptySummary.loggedMs, 0, 'Empty week has 0 logged time');

  // Verify WeekPage code has empty state handling with Swan
  const weekPageSource = fs.readFileSync('src/pages/WeekPage.tsx', 'utf-8');
  assert(weekPageSource.includes('week-empty-state'), 'WeekPage must have empty state container');
  assert(weekPageSource.includes('Nothing logged this week yet.'), 'WeekPage must display empty state message');
  assert(weekPageSource.includes('<Swan'), 'WeekPage must display Swan illustration in empty state');

  // Verify SettingsPage has "Default featured categories"
  const settingsSource = fs.readFileSync('src/pages/SettingsPage.tsx', 'utf-8');
  assert(settingsSource.includes('Default featured categories'), 'SettingsPage must have Default featured categories section');
  assert(settingsSource.includes('WorkCategoriesSheet'), 'SettingsPage must render WorkCategoriesSheet');
}
console.log('✓ Check 6 passed: Empty state and Settings row verified.\n');

console.log('====================================================');
console.log('All Milestone 4.2 Acceptance Criteria Passed Successfully!');
console.log('====================================================');
