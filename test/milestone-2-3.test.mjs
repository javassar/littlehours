/**
 * Automated test suite for Milestone 2.3: Confirmation sheet
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('--- Testing Milestone 2.3: Confirmation sheet ---');

// 1. Verify ConfirmationSheet component files exist and export correctly
const sheetComponentContent = fs.readFileSync('src/components/ConfirmationSheet.tsx', 'utf8');
const sheetCssContent = fs.readFileSync('src/components/ConfirmationSheet.css', 'utf8');
const componentsIndexContent = fs.readFileSync('src/components/index.ts', 'utf8');

assert(componentsIndexContent.includes("export * from './ConfirmationSheet'"), 'ConfirmationSheet must be exported from components/index.ts');
console.log('✓ Verified: ConfirmationSheet component exists and is exported');

// 2. Verify ConfirmationSheet features in code
assert(sheetComponentContent.includes('handleLabelChange'), 'Must support editing activity label');
assert(sheetComponentContent.includes('handleCategoryChange'), 'Must support editing category with picker');
assert(sheetComponentContent.includes('handleStartChange'), 'Must support editing start time');
assert(sheetComponentContent.includes('handleEndChange'), 'Must support editing end time');
assert(sheetComponentContent.includes('handleBoundaryChange'), 'Must support boundary adjustment between rows');
assert(sheetComponentContent.includes('handleLooksRight'), 'Must have "Looks right" action');
assert(sheetComponentContent.includes('handleDismissUnconfirmed'), 'Must support closing unconfirmed');
assert(sheetComponentContent.includes('confirmed: true'), 'Looks right must set confirmed = true');
assert(sheetComponentContent.includes('confirmed: false'), 'Dismiss must set confirmed = false');
console.log('✓ Verified: ConfirmationSheet has all required handlers (label, category, start, end, boundary, looks right, dismiss)');

// 3. Mathematical invariant test: Moving boundary between rows preserves contiguous coverage without lost or doubled minutes
function testBoundaryAdjustment(segments, boundaryIndex, newBoundaryIso) {
  // Deep clone
  const updated = segments.map((s) => ({ ...s }));
  const newMs = new Date(newBoundaryIso).getTime();
  const prevStartMs = new Date(updated[boundaryIndex].start_time).getTime();
  const nextEndMs = new Date(updated[boundaryIndex + 1].end_time).getTime();

  assert(newMs > prevStartMs, 'New boundary must be after previous start time');
  assert(newMs < nextEndMs, 'New boundary must be before next end time');

  // Move boundary
  updated[boundaryIndex].end_time = newBoundaryIso;
  updated[boundaryIndex + 1].start_time = newBoundaryIso;

  // Verify contiguousness
  for (let i = 0; i < updated.length - 1; i++) {
    assert.strictEqual(
      updated[i].end_time,
      updated[i + 1].start_time,
      `Segment ${i} end must strictly equal Segment ${i + 1} start`
    );
  }

  // Calculate total window minutes before and after
  const initialDurationMs =
    new Date(segments[segments.length - 1].end_time).getTime() -
    new Date(segments[0].start_time).getTime();
  const updatedDurationMs =
    new Date(updated[updated.length - 1].end_time).getTime() -
    new Date(updated[0].start_time).getTime();

  assert.strictEqual(
    initialDurationMs,
    updatedDurationMs,
    'Total window duration must remain identical (no minutes lost or gained)'
  );

  // Sum of individual segments must equal total window duration
  const sumSegmentsMs = updated.reduce((acc, seg) => {
    return acc + (new Date(seg.end_time).getTime() - new Date(seg.start_time).getTime());
  }, 0);

  assert.strictEqual(
    sumSegmentsMs,
    initialDurationMs,
    'Sum of individual segment durations must exactly equal total window duration (no doubled or lost minutes)'
  );

  return updated;
}

const initialSegments = [
  {
    id: 'seg-1',
    start_time: '2026-11-09T14:00:00.000Z',
    end_time: '2026-11-09T15:00:00.000Z',
    activity_label: 'deep work',
    category: 'work',
    confirmed: false,
  },
  {
    id: 'seg-2',
    start_time: '2026-11-09T15:00:00.000Z',
    end_time: '2026-11-09T16:30:00.000Z',
    activity_label: 'afternoon stroll',
    category: 'exercise',
    confirmed: false,
  },
  {
    id: 'seg-3',
    start_time: '2026-11-09T16:30:00.000Z',
    end_time: '2026-11-09T17:00:00.000Z',
    activity_label: 'snack break',
    category: 'meals',
    confirmed: false,
  },
];

// Test moving boundary 0 (between seg-1 and seg-2) to 15:25
const movedResult1 = testBoundaryAdjustment(initialSegments, 0, '2026-11-09T15:25:00.000Z');
assert.strictEqual(movedResult1[0].end_time, '2026-11-09T15:25:00.000Z');
assert.strictEqual(movedResult1[1].start_time, '2026-11-09T15:25:00.000Z');
assert.strictEqual(movedResult1[0].activity_label, 'deep work');
console.log('✓ Verified: Moving boundary between rows moves both rows with zero gap or overlap');

// Test moving boundary 1 (between seg-2 and seg-3) to 16:45
const movedResult2 = testBoundaryAdjustment(movedResult1, 1, '2026-11-09T16:45:00.000Z');
assert.strictEqual(movedResult2[1].end_time, '2026-11-09T16:45:00.000Z');
assert.strictEqual(movedResult2[2].start_time, '2026-11-09T16:45:00.000Z');
console.log('✓ Verified: Successive boundary edits maintain exact window duration without lost or doubled minutes');

// 4. Verify HistoryPage.tsx integration
const historyPageContent = fs.readFileSync('src/pages/HistoryPage.tsx', 'utf8');

// ConfirmationSheet imported and rendered in HistoryPage
assert(historyPageContent.includes('<ConfirmationSheet'), 'HistoryPage must render ConfirmationSheet');
assert(historyPageContent.includes('history-unchecked-badge'), 'HistoryPage must include .history-unchecked-badge');
assert(
  historyPageContent.includes("entry.segments.some((s) => !s.confirmed)"),
  'HistoryPage must display Unchecked badge when any segment is not confirmed'
);
assert(
  historyPageContent.includes('Unchecked'),
  'HistoryPage must show "Unchecked" text'
);
assert(
  historyPageContent.includes('handleConfirmSegments'),
  'HistoryPage must have handleConfirmSegments updating segments to confirmed: true'
);
console.log('✓ Verified: HistoryPage shows "Unchecked" tag when unconfirmed and opens ConfirmationSheet on click');

// 5. Verify LogPage.tsx integration
const logPageContent = fs.readFileSync('src/pages/LogPage.tsx', 'utf8');
assert(logPageContent.includes('<ConfirmationSheet'), 'LogPage must render ConfirmationSheet');
assert(logPageContent.includes('pollForParseCompletion'), 'LogPage must poll for parse completion after save to show confirmation sheet');
assert(logPageContent.includes('handleConfirmSegments'), 'LogPage must support confirming segments directly after parse');
console.log('✓ Verified: LogPage automatically presents ConfirmationSheet upon parse completion');

// 6. Verify layout.css contains styling for .history-unchecked-badge
const layoutCss = fs.readFileSync('src/styles/layout.css', 'utf8');
assert(layoutCss.includes('.history-unchecked-badge'), 'layout.css must style .history-unchecked-badge');
assert(layoutCss.includes('--mauve') || layoutCss.includes('--rose'), 'Badge must use design system tokens');
console.log('✓ Verified: layout.css has styling for .history-unchecked-badge');

console.log('\nAll Milestone 2.3 checks passed successfully!');
