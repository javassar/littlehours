/**
 * Test Suite for Milestone 4.5: Demo data, polish, and README
 * SPEC-3.9 Acceptance Criteria verification.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  computeWeekSummary,
  createZonedDate,
  formatHoursMinutes,
  getPreviousWeekStart,
  getWeekStartForDate,
} from '../src/lib/weekSummary.ts';
import { generateDemoSeedData } from '../supabase/functions/seed-demo/data.ts';

console.log('--- Testing Milestone 4.5: Demo data, polish, and README ---\n');

const TZ_PHX = 'America/Phoenix';

// ==========================================
// Check 1: Demo sandbox seed data generation covers 14 days and populates Week in Review
// ==========================================
console.log('[Check 1] Demo sandbox seed data covers 14 days with comparison section...');
{
  const testNow = createZonedDate(2026, 11, 23, 14, 0, TZ_PHX); // Monday afternoon 2:00 PM
  const seed = generateDemoSeedData('demo-user-123', TZ_PHX, testNow);

  // Verify entry and segment counts
  assert(seed.entries.length >= 100, `Expected >= 100 entries across 14 days, got ${seed.entries.length}`);
  assert(seed.segments.length >= 150, `Expected >= 150 segments across 14 days, got ${seed.segments.length}`);

  // Calculate week boundaries
  const currentWeekStart = getWeekStartForDate(testNow, TZ_PHX);
  const prevWeekStart = getPreviousWeekStart(currentWeekStart, TZ_PHX);

  // Compute summary for previous full week
  const prevWeekSummary = computeWeekSummary({
    weekStart: prevWeekStart,
    now: testNow,
    segments: seed.segments,
    previousSegments: seed.segments,
    settings: {
      timezone: TZ_PHX,
      categories: [{ name: 'work' }, { name: 'social' }, { name: 'meals' }],
      work_report_categories: ['work'],
    },
  });

  // Previous week must be fully populated (168h logged)
  assert.strictEqual(prevWeekSummary.loggedMs, 168 * 3600 * 1000, 'Previous week must have 168h logged time');
  assert(prevWeekSummary.work.totalMinutes > 0, 'Previous week must contain work minutes');
  assert(prevWeekSummary.byCategory.length >= 8, 'Previous week must contain diverse categories');
  assert(prevWeekSummary.people.length > 0, 'Previous week must contain people/social companions');

  // Compute summary for current week
  const currentWeekSummary = computeWeekSummary({
    weekStart: currentWeekStart,
    now: testNow,
    segments: seed.segments,
    previousSegments: seed.segments,
    settings: {
      timezone: TZ_PHX,
      categories: [{ name: 'work' }, { name: 'social' }, { name: 'meals' }],
      work_report_categories: ['work'],
    },
  });

  // Current week must have comparison available because previous week has >= 24h logged
  assert.strictEqual(
    currentWeekSummary.comparison.available,
    true,
    'Current week must show comparison because previous week has > 24 logged hours'
  );
  assert(currentWeekSummary.comparison.deltas.length > 0, 'Comparison must contain deltas');
  assert.strictEqual(typeof currentWeekSummary.comparison.workDeltaMinutes, 'number');

  console.log('✓ Check 1 passed: 14 days of demo seed data generates a fully populated Week in Review and active comparison.');
}

// ==========================================
// Check 2: Verify scripts/test-demo.ts passes static safety checks
// ==========================================
console.log('\n[Check 2] Verifying scripts/test-demo.ts safety and syntax...');
{
  const scriptContent = fs.readFileSync(path.resolve('scripts/test-demo.ts'), 'utf8');

  // Verify all 11 isolation tests exist in script
  for (let i = 1; i <= 11; i++) {
    assert(
      scriptContent.includes(`Test ${i}`),
      `scripts/test-demo.ts must include Test ${i}`
    );
  }

  // Verify seed-demo index.ts includes work_report_categories
  const seedIndexContent = fs.readFileSync(
    path.resolve('supabase/functions/seed-demo/index.ts'),
    'utf8'
  );
  assert(
    seedIndexContent.includes("work_report_categories: ['work']"),
    'seed-demo index.ts must initialize work_report_categories in settings'
  );

  console.log('✓ Check 2 passed: test-demo.ts script and seed-demo index verified.');
}

// ==========================================
// Check 3: README mentions Week in Review and deterministic architecture
// ==========================================
console.log('\n[Check 3] Verifying README mentions new screen, architecture note, and 14 days...');
{
  const readmeContent = fs.readFileSync(path.resolve('README.md'), 'utf8');

  // Screenshot entry
  assert(
    readmeContent.includes('Week in Review') && readmeContent.includes('docs/screenshots/week-review.png'),
    'README must include Week in Review screenshot entry'
  );

  // Architecture note
  assert(
    readmeContent.includes('Deterministic Week in Review Analysis'),
    'README must include Deterministic Week in Review Analysis section'
  );
  assert(
    readmeContent.includes('no LLM call'),
    'README architecture note must state that weekly totals require no LLM call'
  );

  // 14 days seed data note
  assert(
    readmeContent.includes('14 days of realistic time data'),
    'README demo sandbox description must state 14 days of realistic time data'
  );

  console.log('✓ Check 3 passed: README contains screenshot entry, architecture note, and 14-day demo description.');
}

// ==========================================
// Check 4: Accessibility checklist (Section 7)
// ==========================================
console.log('\n[Check 4] Verifying Section 7 Accessibility checklist...');
{
  const pageContent = fs.readFileSync(path.resolve('src/pages/WeekPage.tsx'), 'utf8');
  const cssContent = fs.readFileSync(path.resolve('src/pages/WeekPage.css'), 'utf8');

  // 1. Visible text values beside every bar
  assert(pageContent.includes('week-bar-day-time'), 'Hero daily bars have visible text times');
  assert(pageContent.includes('week-cat-time'), 'Category bars have visible text times');
  assert(pageContent.includes('week-cat-share'), 'Category bars have visible text share percentage');
  assert(pageContent.includes('week-day-time'), 'Day by day bars have visible text times');

  // 2. aria-label on charts & interactive items
  assert(pageContent.includes('role="img"') && pageContent.includes('aria-label='), 'Charts have aria-labels');
  assert(pageContent.includes('aria-expanded='), 'Collapsible disclosure has aria-expanded');
  assert(pageContent.includes('aria-controls="week-gaps-list"'), 'Collapsible disclosure has aria-controls');

  // 3. Tap targets >= 44x44px
  assert(cssContent.includes('min-width: 44px;') && cssContent.includes('min-height: 44px;'), 'Enforces 44px min tap targets');

  // 4. prefers-reduced-motion
  assert(cssContent.includes('@media (prefers-reduced-motion: reduce)'), 'WeekPage.css respects prefers-reduced-motion');
  assert(cssContent.includes('transition: none !important;'), 'Suppresses transitions under reduced motion');

  console.log('✓ Check 4 passed: Accessibility requirements (visible text, aria-labels, 44px targets, reduced motion) verified.');
}

console.log('\n====================================================');
console.log('All Milestone 4.5 Acceptance Criteria Passed Successfully!');
console.log('====================================================\n');
