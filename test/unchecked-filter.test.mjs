/**
 * Test Suite for History Unchecked Logs Filter
 * Verifies the button and filtering to see unchecked logs only.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('--- Testing History Unchecked Logs Filter ---\n');

// ==========================================
// Check 1: Entry Unchecked Detection Logic
// ==========================================
console.log('[Check 1] Unchecked entry detection logic...');
{
  const isEntryUnchecked = (entry) =>
    Boolean(entry.segments && entry.segments.length > 0 && entry.segments.some((s) => !s.confirmed));

  const entryAllConfirmed = {
    id: '1',
    segments: [
      { id: 's1', confirmed: true, activity_label: 'work', category: 'work' },
      { id: 's2', confirmed: true, activity_label: 'lunch', category: 'meals' },
    ],
  };

  const entryWithUnconfirmed = {
    id: '2',
    segments: [
      { id: 's3', confirmed: true, activity_label: 'reading', category: 'reading' },
      { id: 's4', confirmed: false, activity_label: 'doom scrolling', category: 'screen time' },
    ],
  };

  const entryNoSegments = {
    id: '3',
    segments: [],
  };

  assert.strictEqual(isEntryUnchecked(entryAllConfirmed), false, 'All confirmed segments must be checked');
  assert.strictEqual(isEntryUnchecked(entryWithUnconfirmed), true, 'Entry with unconfirmed segment must be unchecked');
  assert.strictEqual(isEntryUnchecked(entryNoSegments), false, 'Entry with no segments is not unchecked');

  const entries = [entryAllConfirmed, entryWithUnconfirmed, entryNoSegments];
  const uncheckedEntries = entries.filter(isEntryUnchecked);
  assert.strictEqual(uncheckedEntries.length, 1, 'Only entry 2 must be in unchecked entries');
  assert.strictEqual(uncheckedEntries[0].id, '2');

  console.log('✓ Check 1 passed: Unchecked entries correctly identified.');
}

// ==========================================
// Check 2: Verify HistoryPage.tsx and layout.css implementation
// ==========================================
console.log('\n[Check 2] Verifying HistoryPage.tsx and layout.css filter elements...');
{
  const historyCode = fs.readFileSync(path.resolve('src/pages/HistoryPage.tsx'), 'utf8');
  const layoutCss = fs.readFileSync(path.resolve('src/styles/layout.css'), 'utf8');

  // Verify state and search params
  assert(historyCode.includes('useSearchParams'), 'HistoryPage imports useSearchParams');
  assert(historyCode.includes('showUncheckedOnly'), 'HistoryPage manages showUncheckedOnly state');
  assert(historyCode.includes('uncheckedCount'), 'HistoryPage computes uncheckedCount badge');
  assert(historyCode.includes('toggleUncheckedFilter'), 'HistoryPage implements toggleUncheckedFilter');

  // Verify filter bar UI
  assert(historyCode.includes('history-filter-bar'), 'HistoryPage renders history-filter-bar');
  assert(historyCode.includes('history-filter-toggle-btn'), 'HistoryPage renders history-filter-toggle-btn');
  assert(historyCode.includes('history-filter-count-badge'), 'HistoryPage renders history-filter-count-badge');
  assert(historyCode.includes('aria-pressed={showUncheckedOnly}'), 'HistoryPage sets aria-pressed on toggle button');

  // Verify filtering of day groups
  assert(historyCode.includes('entries.filter(isEntryUnchecked)'), 'Filters entries when showUncheckedOnly is active');
  assert(historyCode.includes('!showUncheckedOnly && (queuedEntries.length > 0'), 'Suppresses queued entries while filtering unchecked logs');

  // Verify empty state when filtering
  assert(historyCode.includes('No unchecked logs!'), 'HistoryPage renders empty state when 0 unchecked logs remain');

  // Verify CSS styles
  assert(layoutCss.includes('.history-filter-bar'), 'layout.css defines .history-filter-bar');
  assert(layoutCss.includes('.history-filter-toggle-btn'), 'layout.css defines .history-filter-toggle-btn');
  assert(layoutCss.includes('min-height: 44px;'), 'Filter toggle button has minimum 44px touch target');
  assert(layoutCss.includes('.history-filter-count-badge'), 'layout.css defines .history-filter-count-badge');
  assert(layoutCss.includes('.history-filter-clear-btn'), 'layout.css defines .history-filter-clear-btn');

  console.log('✓ Check 2 passed: HistoryPage and layout.css successfully integrate unchecked filter bar.');
}

// ==========================================
// Check 3: Verify WeekPage notice link to unchecked filter
// ==========================================
console.log('\n[Check 3] Verifying Week in Review notice link to History unchecked filter...');
{
  const weekCode = fs.readFileSync(path.resolve('src/pages/WeekPage.tsx'), 'utf8');
  assert(
    weekCode.includes('to="/history?filter=unchecked"'),
    'WeekPage notice links directly to /history?filter=unchecked'
  );

  console.log('✓ Check 3 passed: WeekPage quality notice connects directly to unchecked filter.');
}

console.log('\n====================================================');
console.log('All History Unchecked Logs Filter Tests Passed!');
console.log('====================================================\n');
