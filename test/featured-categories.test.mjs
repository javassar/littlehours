/**
 * Tests for Week in Review Featured Categories Change
 *
 * Verifies:
 * 1. Single non-work category featured
 * 2. Three categories at once featured
 * 3. Four or more categories with extra category line in copy text
 * 4. Vacation as the featured category (vacation time counts)
 * 5. Vacation not featured (vacation time does not count)
 * 6. Featured category that no longer exists (ignored in math, fallback behavior)
 * 7. Week-over-week comparison section with featured selection
 * 8. Settings and Bottom Sheet UI integration (disabled last checkbox, "Make this my default")
 */

import assert from 'node:assert';
import fs from 'node:fs';
import {
  computeWeekSummary,
  createZonedDate,
  formatHoursMinutes,
  formatDecimalHours,
  generateReportText,
  getFeaturedCardTitle,
} from '../src/lib/weekSummary.ts';

const TZ_PHX = 'America/Phoenix';
const weekStartNov16 = createZonedDate(2026, 11, 16, 0, 0, TZ_PHX);
const weekEndNov23 = createZonedDate(2026, 11, 23, 0, 0, TZ_PHX);

console.log('--- Testing Featured Categories on Week in Review ---\n');

// ==========================================
// Check 1: Single Non-Work Category
// ==========================================
console.log('[Check 1] Single non-work category (reading)...');
{
  const sReading1 = {
    start_time: createZonedDate(2026, 11, 16, 19, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 21, 30, TZ_PHX), // 150m (2h 30m)
    category: 'reading',
  };
  const sReading2 = {
    start_time: createZonedDate(2026, 11, 17, 20, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 17, 22, 40, TZ_PHX), // 160m (2h 40m)
    category: 'reading',
  };
  const sWork = {
    start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 17, 0, TZ_PHX), // 480m work
    category: 'work',
  };

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [sReading1, sReading2, sWork],
    settings: { timezone: TZ_PHX, categories: [{ name: 'reading' }, { name: 'work' }] },
    featuredCategories: ['reading'],
  });

  // Total reading minutes: 150 + 160 = 310m (5h 10m)
  assert.strictEqual(summary.featured.totalMinutes, 310, 'Featured total should be 310m (5h 10m)');
  assert.strictEqual(formatHoursMinutes(summary.featured.totalMinutes), '5h 10m');
  assert.strictEqual(summary.featured.perDay[0], 150, 'Monday reading: 150m');
  assert.strictEqual(summary.featured.perDay[1], 160, 'Tuesday reading: 160m');
  assert.strictEqual(summary.featured.perDay[2], 0, 'Wednesday reading: 0m');

  // Card titles
  const titleFinished = getFeaturedCardTitle(summary.featured.categoriesUsed, false);
  assert.strictEqual(titleFinished, 'Time on reading', 'Finished week title must be "Time on reading"');

  const titleCurrent = getFeaturedCardTitle(summary.featured.categoriesUsed, true);
  assert.strictEqual(titleCurrent, 'Time on reading so far', 'Current week title must be "Time on reading so far"');

  // Copy text line
  const reportText = generateReportText(summary, TZ_PHX, 'hours_minutes');
  assert(reportText.includes('Time on reading: 5h 10m'), 'Copy report text must contain "Time on reading: 5h 10m"');
  assert(!reportText.includes('Hours worked:'), 'Non-work report must not say "Hours worked:"');
}
console.log('✓ Check 1 passed: Single non-work category computes and formats properly.\n');

// ==========================================
// Check 2: Three Categories at Once
// ==========================================
console.log('[Check 2] Three categories at once (work, job search, admin)...');
{
  const sWork = {
    start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 11, 0, TZ_PHX), // 120m
    category: 'work',
  };
  const sJobSearch = {
    start_time: createZonedDate(2026, 11, 16, 11, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 12, 0, TZ_PHX), // 60m
    category: 'job search',
  };
  const sAdmin = {
    start_time: createZonedDate(2026, 11, 16, 12, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 12, 30, TZ_PHX), // 30m
    category: 'admin',
  };
  const sReading = {
    start_time: createZonedDate(2026, 11, 16, 13, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 14, 0, TZ_PHX), // 60m (not in featured)
    category: 'reading',
  };

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [sWork, sJobSearch, sAdmin, sReading],
    settings: {
      timezone: TZ_PHX,
      categories: [{ name: 'work' }, { name: 'job search' }, { name: 'admin' }, { name: 'reading' }],
    },
    featuredCategories: ['work', 'job search', 'admin'],
  });

  // Total: 120 + 60 + 30 = 210m (3h 30m)
  assert.strictEqual(summary.featured.totalMinutes, 210, 'Featured total must be 210m');
  assert.deepStrictEqual(summary.featured.categoriesUsed, ['work', 'job search', 'admin']);

  const titleFinished = getFeaturedCardTitle(summary.featured.categoriesUsed, false);
  assert.strictEqual(titleFinished, 'Time on work, job search, admin');

  const reportText = generateReportText(summary, TZ_PHX, 'hours_minutes');
  assert(reportText.includes('Time on work, job search, admin: 3h 30m'));
}
console.log('✓ Check 2 passed: Three categories at once correctly add and format.\n');

// ==========================================
// Check 3: Four or More Categories (With Extra Line in Copy Text)
// ==========================================
console.log('[Check 3] Four or more categories...');
{
  const categories = ['work', 'job search', 'admin', 'reading'];
  const title = getFeaturedCardTitle(categories, false);
  assert.strictEqual(title, 'Time on 4 categories', 'Card title should be "Time on 4 categories"');

  const titleCurrent = getFeaturedCardTitle(categories, true);
  assert.strictEqual(titleCurrent, 'Time on 4 categories so far');

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [
      {
        start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
        end_time: createZonedDate(2026, 11, 16, 10, 0, TZ_PHX), // 60m
        category: 'work',
      },
    ],
    settings: {
      timezone: TZ_PHX,
      categories: categories.map((name) => ({ name })),
    },
    featuredCategories: categories,
  });

  const reportText = generateReportText(summary, TZ_PHX, 'hours_minutes');
  assert(reportText.includes('Time on 4 categories: 1h 0m'), 'Must contain "Time on 4 categories: 1h 0m"');
  assert(
    reportText.includes('Categories: work, job search, admin, reading'),
    'Report copy must list category names on an extra line for 4 or more categories'
  );
}
console.log('✓ Check 3 passed: Four or more categories title and extra line verified.\n');

// ==========================================
// Check 4: Vacation as the Featured Category (Vacation time counts)
// ==========================================
console.log('[Check 4] Vacation as the featured category (vacation time counts)...');
{
  const sVacation1 = {
    start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 17, 0, TZ_PHX), // 480m (8h)
    category: 'vacation',
  };
  const sVacationEntry = {
    start_time: createZonedDate(2026, 11, 17, 10, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 17, 12, 0, TZ_PHX), // 120m (2h)
    category: 'reading',
    on_vacation: true,
  };
  const sWork = {
    start_time: createZonedDate(2026, 11, 18, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 18, 11, 0, TZ_PHX), // 120m work
    category: 'work',
  };

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [sVacation1, sVacationEntry, sWork],
    settings: {
      timezone: TZ_PHX,
      categories: [{ name: 'vacation' }, { name: 'reading' }, { name: 'work' }],
    },
    featuredCategories: ['vacation'],
  });

  // When vacation is featured, vacation time counts: 480m + 120m = 600m (10h)
  assert.strictEqual(
    summary.featured.totalMinutes,
    600,
    'Vacation time must count toward featured total when vacation is featured'
  );
  assert.strictEqual(summary.featured.perDay[0], 480, 'Monday vacation: 480m');
  assert.strictEqual(summary.featured.perDay[1], 120, 'Tuesday vacation entry: 120m');
  assert.strictEqual(summary.featured.perDay[2], 0, 'Wednesday work does not count for vacation');
}
console.log('✓ Check 4 passed: Vacation time counts when vacation is featured.\n');

// ==========================================
// Check 5: Vacation Not Featured (Vacation time does not count)
// ==========================================
console.log('[Check 5] Vacation not featured (vacation time does not count)...');
{
  const sWorkNormal = {
    start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 13, 0, TZ_PHX), // 240m (4h)
    category: 'work',
  };
  const sWorkOnVacation = {
    start_time: createZonedDate(2026, 11, 17, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 17, 11, 0, TZ_PHX), // 120m (2h)
    category: 'work',
    on_vacation: true,
  };
  const sVacationCat = {
    start_time: createZonedDate(2026, 11, 18, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 18, 17, 0, TZ_PHX), // 480m (8h)
    category: 'vacation',
  };

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [sWorkNormal, sWorkOnVacation, sVacationCat],
    settings: {
      timezone: TZ_PHX,
      categories: [{ name: 'work' }, { name: 'vacation' }],
    },
    featuredCategories: ['work'],
  });

  // Only the normal work segment should count: 240m (4h)
  assert.strictEqual(
    summary.featured.totalMinutes,
    240,
    'Vacation time must NOT count toward featured total when vacation is not featured'
  );
  assert.strictEqual(summary.featured.perDay[0], 240, 'Monday work counted');
  assert.strictEqual(summary.featured.perDay[1], 0, 'Tuesday vacation work excluded');
  assert.strictEqual(summary.featured.perDay[2], 0, 'Wednesday vacation excluded');
}
console.log('✓ Check 5 passed: Vacation time excluded when vacation is not featured.\n');

// ==========================================
// Check 6: A Featured Category That No Longer Exists
// ==========================================
console.log('[Check 6] A featured category that no longer exists...');
{
  const sWork = {
    start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 12, 0, TZ_PHX), // 180m
    category: 'work',
  };
  const sOldHobby = {
    start_time: createZonedDate(2026, 11, 16, 13, 0, TZ_PHX),
    end_time: createZonedDate(2026, 11, 16, 15, 0, TZ_PHX), // 120m
    category: 'pottery',
  };

  // Settings only has 'work' and 'reading', 'pottery' was deleted
  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [sWork, sOldHobby],
    settings: {
      timezone: TZ_PHX,
      categories: [{ name: 'work' }, { name: 'reading' }],
    },
    featuredCategories: ['work', 'pottery'],
  });

  // 'pottery' must be reported as missing and ignored in math
  assert.deepStrictEqual(summary.featured.missingCategories, ['pottery']);
  assert.deepStrictEqual(summary.featured.categoriesUsed, ['work']);
  assert.strictEqual(summary.featured.totalMinutes, 180, 'Only work should be counted in math');

  // Fallback test: None of the saved categories exist, but 'work' exists
  const summaryFallback = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [sWork],
    settings: {
      timezone: TZ_PHX,
      categories: [{ name: 'work' }, { name: 'reading' }],
    },
    featuredCategories: ['deleted_cat_1', 'deleted_cat_2'],
  });
  assert.deepStrictEqual(summaryFallback.featured.categoriesUsed, ['work'], 'Should fall back to work');

  // Fallback test: Neither saved categories nor 'work' exists
  const summaryNoValid = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [sWork],
    settings: {
      timezone: TZ_PHX,
      categories: [{ name: 'reading' }, { name: 'exercise' }],
    },
    featuredCategories: ['deleted_cat_1'],
  });
  assert.strictEqual(summaryNoValid.featured.noValidCategories, true);
  assert.deepStrictEqual(summaryNoValid.featured.categoriesUsed, []);
}
console.log('✓ Check 6 passed: Deleted/missing categories handled with graceful fallbacks.\n');

// ==========================================
// Check 7: Week-over-Week Comparison with Featured Category
// ==========================================
console.log('[Check 7] Week-over-week comparison with featured category...');
{
  const prevWeekStart = createZonedDate(2026, 11, 9, 0, 0, TZ_PHX);
  // Previous week: 30 hours of reading + 10 hours of work
  const prevReading = {
    start_time: createZonedDate(2026, 11, 9, 9, 0, TZ_PHX),
    end_time: new Date(createZonedDate(2026, 11, 9, 9, 0, TZ_PHX).getTime() + 30 * 3600 * 1000),
    category: 'reading',
  };

  // This week: 35 hours of reading
  const thisReading = {
    start_time: createZonedDate(2026, 11, 16, 9, 0, TZ_PHX),
    end_time: new Date(createZonedDate(2026, 11, 16, 9, 0, TZ_PHX).getTime() + 35 * 3600 * 1000),
    category: 'reading',
  };

  const summary = computeWeekSummary({
    weekStart: weekStartNov16,
    now: weekEndNov23,
    segments: [thisReading],
    previousSegments: [prevReading],
    settings: {
      timezone: TZ_PHX,
      categories: [{ name: 'reading' }, { name: 'work' }],
    },
    featuredCategories: ['reading'],
  });

  assert.strictEqual(summary.comparison.available, true);
  assert.strictEqual(
    summary.comparison.featuredDeltaMinutes,
    5 * 60,
    'Reading delta should be +5h (+300m)'
  );
  assert.strictEqual(
    summary.comparison.workDeltaMinutes,
    5 * 60,
    'workDeltaMinutes alias should match'
  );
}
console.log('✓ Check 7 passed: Week-over-week comparison correctly computes featured delta.\n');

// ==========================================
// Check 8: Settings and Sheet UI Verification
// ==========================================
console.log('[Check 8] Settings and WorkCategoriesSheet code verification...');
{
  const settingsSource = fs.readFileSync('src/pages/SettingsPage.tsx', 'utf-8');
  assert(
    settingsSource.includes('Default featured categories'),
    'Settings must have "Default featured categories" header'
  );
  assert(
    settingsSource.includes('The categories shown at the top of Week in Review. Choose work if you report your hours to a workplace.'),
    'Settings must have exact specified description'
  );

  const sheetSource = fs.readFileSync('src/components/WorkCategoriesSheet.tsx', 'utf-8');
  assert(
    sheetSource.includes('disabled={isOnlySelected}'),
    'Bottom sheet must disable the last remaining checked box'
  );
  assert(
    sheetSource.includes('Make this my default'),
    'Bottom sheet must provide "Make this my default" text button'
  );
  assert(
    sheetSource.includes('Saved as default'),
    'Bottom sheet must provide "Saved as default" confirmation'
  );

  const weekPageSource = fs.readFileSync('src/pages/WeekPage.tsx', 'utf-8');
  assert(
    weekPageSource.includes('week-counting-btn'),
    'WeekPage must render tappable counting control'
  );
  assert(
    weekPageSource.includes('week-counting-chevron'),
    'WeekPage counting control must have down arrow/chevron'
  );
  assert(
    weekPageSource.includes('SESSION_STORAGE_FEATURED_KEY'),
    'WeekPage must persist session featured selection in sessionStorage'
  );
}
console.log('✓ Check 8 passed: UI components adhere to all specification requirements.\n');

console.log('====================================================');
console.log('All Featured Categories Acceptance Tests Passed!');
console.log('====================================================');
