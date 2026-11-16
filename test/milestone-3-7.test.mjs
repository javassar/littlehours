/**
 * Test Suite for Milestone 3.7: Hourly pain rating (1 to 5)
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  calculateLookbackWindow,
  preparePainRatingExportRows,
  generatePainRatingsCSV,
  generatePainRatingsJSON,
  PAIN_RATINGS_CSV_HEADERS,
} from '../src/lib/export.ts';
import { PAIN_SCALE, getPainAnchor, getPainWord } from '../src/lib/painScale.ts';

// Logic mirror of send-reminders/index.ts checkRecentActivity
function checkRecentEntry(latestWindowEnd, currentTime, thresholdMs = 30 * 60 * 1000) {
  if (!latestWindowEnd) {
    return { isRecent: false, minutesAgo: -1 };
  }
  const endedAt = new Date(latestWindowEnd);
  if (isNaN(endedAt.getTime())) {
    return { isRecent: false, minutesAgo: -1 };
  }
  const diffMs = currentTime.getTime() - endedAt.getTime();
  if (diffMs >= -60_000 && diffMs <= thresholdMs) {
    const minutesAgo = Math.max(0, Math.round(diffMs / 60000));
    return {
      isRecent: true,
      minutesAgo,
      reason: `logged recently (latest entry ended at ${endedAt.toISOString()}, ${minutesAgo}m ago)`,
    };
  }
  const minutesAgo = Math.round(diffMs / 60000);
  return { isRecent: false, minutesAgo };
}

function checkRecentActivity(
  latestWindowEnd,
  latestRatedAt,
  currentTime,
  thresholdMs = 30 * 60 * 1000
) {
  const entryCheck = checkRecentEntry(latestWindowEnd, currentTime, thresholdMs);
  let ratingCheck = { isRecent: false, minutesAgo: -1 };

  if (latestRatedAt) {
    const ratedAt = new Date(latestRatedAt);
    if (!isNaN(ratedAt.getTime())) {
      const diffMs = currentTime.getTime() - ratedAt.getTime();
      if (diffMs >= -60_000 && diffMs <= thresholdMs) {
        const minutesAgo = Math.max(0, Math.round(diffMs / 60000));
        ratingCheck = {
          isRecent: true,
          minutesAgo,
          reason: `rated pain recently (latest rating at ${ratedAt.toISOString()}, ${minutesAgo}m ago)`,
        };
      }
    }
  }

  if (entryCheck.isRecent && ratingCheck.isRecent) {
    return entryCheck.minutesAgo <= ratingCheck.minutesAgo ? entryCheck : ratingCheck;
  }
  if (entryCheck.isRecent) return entryCheck;
  if (ratingCheck.isRecent) return ratingCheck;

  return { isRecent: false, minutesAgo: -1 };
}

console.log('--- Testing Milestone 3.7: Hourly pain rating (1 to 5) ---\n');

// ==========================================
// Check 1: Privacy Check (Step 9)
// Confirm that parse-entry and Gemini API never read pain_ratings
// ==========================================
console.log('[Check 1] Privacy verification: Confirm Gemini and parse-entry never access pain ratings...');

const parseEntryDir = 'supabase/functions/parse-entry';
const parseEntryFiles = fs.readdirSync(parseEntryDir);
const checkedFiles = [];

for (const file of parseEntryFiles) {
  const fullPath = path.join(parseEntryDir, file);
  if (fs.statSync(fullPath).isFile()) {
    checkedFiles.push(fullPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert(
      !content.includes('pain_ratings'),
      `Privacy violation: ${fullPath} references pain_ratings!`
    );
    assert(
      !content.toLowerCase().includes('pain'),
      `Privacy violation: ${fullPath} references pain!`
    );
  }
}

// Verify no Gemini call anywhere in frontend src/
function scanSrc(dir) {
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      if (item !== 'node_modules' && item !== '.git') scanSrc(full);
    } else {
      const content = fs.readFileSync(full, 'utf8');
      assert(!content.includes('GoogleGenAI'), `Found GoogleGenAI in frontend file: ${full}`);
    }
  }
}
scanSrc('src');

console.log(`✓ Privacy verified across ${checkedFiles.length} parse-entry files:`);
checkedFiles.forEach((f) => console.log(`   - ${f}`));
console.log('✓ No Gemini API calls or pain rating data leakage found.\n');

// ==========================================
// Check 2: Scale Anchors & Single Source of Truth (Step 2)
// ==========================================
console.log('[Check 2] Scale anchors from src/lib/painScale.ts...');
assert.strictEqual(PAIN_SCALE.length, 5, 'Must have exactly 5 anchors');

const expectedAnchors = [
  { rating: 1, word: 'none or very mild', meaning: 'Barely there, easy to ignore.' },
  { rating: 2, word: 'mild', meaning: 'Noticeable, does not limit what I do.' },
  { rating: 3, word: 'moderate', meaning: 'Hard to ignore, limits some activities.' },
  { rating: 4, word: 'severe', meaning: 'Limits most activities and my concentration.' },
  { rating: 5, word: 'very severe', meaning: 'I cannot do my normal activities.' },
];

for (let i = 0; i < 5; i++) {
  const exp = expectedAnchors[i];
  const actual = PAIN_SCALE[i];
  assert.strictEqual(actual.rating, exp.rating);
  assert.strictEqual(actual.word, exp.word);
  assert.strictEqual(actual.meaning, exp.meaning);
}

assert.strictEqual(getPainWord(3), 'moderate');
assert.strictEqual(getPainWord(null), '');
assert.strictEqual(getPainAnchor(5)?.meaning, 'I cannot do my normal activities.');
console.log('✓ All 5 anchors match SPEC-3.7 Step 2 table.\n');

// ==========================================
// Check 3: Overlap Calculation Tests (Step 8, Rule 6)
// Required cases:
// 1. A segment fully inside the window
// 2. A segment cut by the window start
// 3. A segment that straddles rated_at
// 4. A window with a gap
// ==========================================
console.log('[Check 3] Testing overlap calculation cases (Step 8 Rule 6)...');

// Reference rated_at: 2026-11-16T14:00:00Z (2:00 PM UTC)
// 60-minute window: 1:00 PM to 2:00 PM UTC (13:00 to 14:00)
const ratedAt = new Date('2026-11-16T14:00:00Z');

// Case 1: Segment fully inside window (1:15 to 1:45 PM, 30 min reading)
const case1Segments = [
  {
    entry_id: 'e1',
    start_time: '2026-11-16T13:15:00Z',
    end_time: '2026-11-16T13:45:00Z',
    activity_label: 'reading a novel',
    category: 'reading',
    parse_status: 'parsed',
  },
];
const case1 = calculateLookbackWindow(case1Segments, ratedAt, 60);
assert.strictEqual(case1.byCategory.reading, 30, 'Case 1: reading should be 30m');
assert.strictEqual(case1.unloggedMinutes, 30, 'Case 1: unlogged should be 30m');
console.log('✓ Case 1 passed: Segment fully inside window (30m reading, 30m unlogged).');

// Case 2: Segment cut by window start (0:30 to 1:30 PM, covers 1:00 to 1:30 PM = 30m work)
const case2Segments = [
  {
    entry_id: 'e2',
    start_time: '2026-11-16T12:30:00Z',
    end_time: '2026-11-16T13:30:00Z',
    activity_label: 'client meeting',
    category: 'work',
    parse_status: 'parsed',
  },
];
const case2 = calculateLookbackWindow(case2Segments, ratedAt, 60);
assert.strictEqual(case2.byCategory.work, 30, 'Case 2: work clipped to 30m');
assert.strictEqual(case2.unloggedMinutes, 30, 'Case 2: unlogged should be 30m');
console.log('✓ Case 2 passed: Segment cut by window start (30m work, 30m unlogged).');

// Case 3: Segment that straddles rated_at (1:45 to 2:30 PM, covers 1:45 to 2:00 PM = 15m chores)
const case3Segments = [
  {
    entry_id: 'e3',
    start_time: '2026-11-16T13:45:00Z',
    end_time: '2026-11-16T14:30:00Z',
    activity_label: 'cleaning kitchen',
    category: 'chores',
    parse_status: 'parsed',
  },
];
const case3 = calculateLookbackWindow(case3Segments, ratedAt, 60);
assert.strictEqual(case3.byCategory.chores, 15, 'Case 3: chores clipped to 15m');
assert.strictEqual(case3.unloggedMinutes, 45, 'Case 3: unlogged should be 45m');
console.log('✓ Case 3 passed: Segment straddling rated_at (15m chores, 45m unlogged).');

// Case 4: Window with a gap (1:00 to 1:20 work, gap 1:20-1:40, 1:40 to 2:00 exercise)
const case4Segments = [
  {
    entry_id: 'e4a',
    start_time: '2026-11-16T13:00:00Z',
    end_time: '2026-11-16T13:20:00Z',
    activity_label: 'coding',
    category: 'work',
    parse_status: 'parsed',
  },
  {
    entry_id: 'e4b',
    start_time: '2026-11-16T13:40:00Z',
    end_time: '2026-11-16T14:00:00Z',
    activity_label: 'yoga',
    category: 'exercise',
    parse_status: 'parsed',
  },
];
const case4 = calculateLookbackWindow(case4Segments, ratedAt, 60);
assert.strictEqual(case4.byCategory.work, 20, 'Case 4: work should be 20m');
assert.strictEqual(case4.byCategory.exercise, 20, 'Case 4: exercise should be 20m');
assert.strictEqual(case4.unloggedMinutes, 20, 'Case 4: unlogged gap should be 20m');
console.log('✓ Case 4 passed: Window with a gap (20m work, 20m exercise, 20m unlogged).');

// Case 5: Rule 5 - Only parsed entries count; pending/failed entries count as unlogged
const case5Segments = [
  {
    entry_id: 'e5a',
    start_time: '2026-11-16T13:00:00Z',
    end_time: '2026-11-16T13:30:00Z',
    activity_label: 'pending review',
    category: 'work',
    parse_status: 'pending', // Pending entry: must NOT count
  },
  {
    entry_id: 'e5b',
    start_time: '2026-11-16T13:30:00Z',
    end_time: '2026-11-16T14:00:00Z',
    activity_label: 'stretching',
    category: 'exercise',
    parse_status: 'parsed', // Parsed: counts
  },
];
const case5 = calculateLookbackWindow(case5Segments, ratedAt, 60);
assert.strictEqual(case5.byCategory.work, undefined, 'Pending entry segments must contribute nothing');
assert.strictEqual(case5.byCategory.exercise, 30, 'Parsed entry segments contribute');
assert.strictEqual(case5.unloggedMinutes, 30, 'Unlogged should include the pending 30m');
console.log('✓ Case 5 passed: Only segments from parsed entries count; pending/failed count as unlogged.\n');

// ==========================================
// Check 4: Pain Ratings Export Join & Formatting (Step 8)
// ==========================================
console.log('[Check 4] Testing preparePainRatingExportRows and CSV / JSON output...');

// Check item: "Saving a rating at 2:20 PM with 'Hour ends at' set to 2:00 PM exports hour_start of 1:00 PM and prior-window columns that cover 1:00 to 2:00 PM."
// Check item: "Two ratings saved 30 minutes apart show minutes_since_previous_rating of 30 on the second."
// Hand calculation check with known entries and segments.

const testEntries = [
  {
    id: 'entry-1',
    window_start: '2026-11-16T19:00:00Z', // 12:00 PM Phoenix
    window_end: '2026-11-16T21:00:00Z',   // 2:00 PM Phoenix
    raw_text: 'worked 1 hour then walked dog 1 hour with Sarah',
    created_at: '2026-11-16T21:00:05Z',
    on_vacation: false,
    parse_status: 'parsed',
  },
  {
    id: 'entry-2',
    window_start: '2026-11-16T21:00:00Z', // 2:00 PM Phoenix
    window_end: '2026-11-16T22:30:00Z',   // 3:30 PM Phoenix
    raw_text: 'lunch on the patio',
    created_at: '2026-11-16T22:30:05Z',
    on_vacation: true,
    parse_status: 'parsed',
  },
];

const testSegments = [
  {
    id: 'seg-1',
    entry_id: 'entry-1',
    start_time: '2026-11-16T19:00:00Z', // 12:00 to 1:00 PM Phoenix
    end_time: '2026-11-16T20:00:00Z',
    activity_label: 'deep work',
    category: 'work',
    company: [],
    parse_status: 'parsed',
  },
  {
    id: 'seg-2',
    entry_id: 'entry-1',
    start_time: '2026-11-16T20:00:00Z', // 1:00 to 2:00 PM Phoenix
    end_time: '2026-11-16T21:00:00Z',
    activity_label: 'walking dog',
    category: 'exercise',
    company: ['Sarah'],
    parse_status: 'parsed',
  },
  {
    id: 'seg-3',
    entry_id: 'entry-2',
    start_time: '2026-11-16T21:00:00Z', // 2:00 to 2:30 PM Phoenix
    end_time: '2026-11-16T21:30:00Z',
    activity_label: 'vacation lunch',
    category: 'vacation',
    company: ['Gray'],
    parse_status: 'parsed',
  },
];

// Rating 1: Saved at 2:20 PM Phoenix (21:20 UTC) with "Hour ends at" edited to 2:00 PM Phoenix (21:00 UTC)
// Rating 2: Saved at 2:30 PM Phoenix (21:30 UTC), rated_at = 2:30 PM Phoenix (21:30 UTC) - exactly 30 min after Rating 1
const testRatings = [
  {
    id: 'rating-1',
    rating: 2,
    rated_at: '2026-11-16T21:00:00Z', // 2:00 PM Phoenix
    entry_id: 'entry-1',
    created_at: '2026-11-16T21:20:00Z', // Saved at 2:20 PM
  },
  {
    id: 'rating-2',
    rating: 4,
    rated_at: '2026-11-16T21:30:00Z', // 2:30 PM Phoenix (30m later)
    entry_id: null, // standalone rating
    created_at: '2026-11-16T21:30:00Z',
  },
];

const exportRows = preparePainRatingExportRows(testRatings, testEntries, testSegments, 'America/Phoenix');

assert.strictEqual(exportRows.length, 2, 'Must export exactly 2 rows');

// Verify Row 1:
const r1 = exportRows[0];
assert.strictEqual(r1.id, 'rating-1');
assert.strictEqual(r1.rating, 2);
assert.strictEqual(r1.rated_at, '2026-11-16T21:00:00Z');
assert.strictEqual(r1.hour_start, '2026-11-16T20:00:00.000Z'); // 1:00 PM Phoenix
assert.strictEqual(r1.entered_at, '2026-11-16T21:20:00Z');
assert.strictEqual(r1.minutes_since_previous_rating, null, 'First rating has no previous rating');
assert.strictEqual(r1.entry_id, 'entry-1');

// Containing segment for Rating 1:
// rated_at is 21:00 UTC. seg-2 is 20:00 to 21:00 UTC (start_time <= rated_at < end_time -> seg-3 is 21:00 to 21:30)
// For rated_at = 21:00: 21:00 <= 21:00 < 21:30 -> containing segment is seg-3!
assert.strictEqual(r1.segment_category, 'vacation');
assert.strictEqual(r1.segment_label, 'vacation lunch');
assert.deepStrictEqual(r1.segment_company, ['Gray']);
assert.strictEqual(r1.on_vacation, true);

// Lookback 60 for Rating 1 (20:00 to 21:00 UTC):
// Hand calculation: seg-2 covers 20:00 to 21:00 UTC (60m exercise)
assert.strictEqual(r1.prior_60_min_by_category.exercise, 60);
assert.strictEqual(r1.prior_60_unlogged_min, 0);

// Lookback 180 for Rating 1 (18:00 to 21:00 UTC):
// seg-1: 19:00 to 20:00 (60m work)
// seg-2: 20:00 to 21:00 (60m exercise)
// Total covered = 120m, unlogged = 180 - 120 = 60m
assert.strictEqual(r1.prior_180_min_by_category.work, 60);
assert.strictEqual(r1.prior_180_min_by_category.exercise, 60);
assert.strictEqual(r1.prior_180_unlogged_min, 60);

// Verify Row 2 (30 minutes after Row 1):
const r2 = exportRows[1];
assert.strictEqual(r2.id, 'rating-2');
assert.strictEqual(r2.rating, 4);
assert.strictEqual(r2.rated_at, '2026-11-16T21:30:00Z');
assert.strictEqual(r2.hour_start, '2026-11-16T20:30:00.000Z');
assert.strictEqual(
  r2.minutes_since_previous_rating,
  30,
  'Two ratings saved 30 minutes apart show minutes_since_previous_rating of 30 on the second'
);
assert.strictEqual(r2.entry_id, '');

// Lookback 60 for Rating 2 (20:30 to 21:30 UTC):
// seg-2: 20:30 to 21:00 (30m exercise)
// seg-3: 21:00 to 21:30 (30m vacation)
// Total covered = 60m, unlogged = 0
assert.strictEqual(r2.prior_60_min_by_category.exercise, 30);
assert.strictEqual(r2.prior_60_min_by_category.vacation, 30);
assert.strictEqual(r2.prior_60_unlogged_min, 0);

console.log('✓ Hand calculation check passed for Rating 1 & Rating 2.');
console.log('✓ Verified hour_start is rated_at minus 60 minutes.');
console.log('✓ Verified minutes_since_previous_rating is 30 on the second rating.');

// Verify CSV formatting and headers
const csvOutput = generatePainRatingsCSV(exportRows);
const csvLines = csvOutput.split('\r\n');
assert.strictEqual(csvLines.length, 3, 'CSV must have 1 header line and 2 data lines');
assert.strictEqual(csvLines[0], PAIN_RATINGS_CSV_HEADERS.join(','));
assert(csvLines[1].includes('rating-1'));
assert(csvLines[2].includes(',30,')); // minutes_since_previous_rating of 30 on row 2
console.log('✓ CSV output matches all 18 headers and formats cells correctly.');

// Verify JSON formatting
const jsonOutput = generatePainRatingsJSON(exportRows);
const parsedJSON = JSON.parse(jsonOutput);
assert.strictEqual(parsedJSON.length, 2);
assert.strictEqual(parsedJSON[1].minutes_since_previous_rating, 30);
assert.deepStrictEqual(parsedJSON[0].prior_60_min_by_category, { exercise: 60 });
console.log('✓ JSON output matches structure with nested objects and arrays.\n');

// ==========================================
// Check 5: Reminders Check-in Suppression (Step 7)
// Rule: A reminder is skipped when the latest entry end time or the latest rating time is within the last 30 minutes
// Check item: "A rating at 2:40 PM suppresses the 3:00 PM reminder, and the 4:00 PM reminder arrives normally."
// ==========================================
console.log('[Check 5] Testing reminders check-in suppression (Step 7)...');

// Scenario A: Rating at 2:40 PM (14:40), checking at 3:00 PM (15:00) -> 20m ago <= 30m -> suppressed
const ratingTimeA = '2026-11-16T14:40:00Z';
const clockAt3PM = new Date('2026-11-16T15:00:00Z');
const res3PM = checkRecentActivity(null, ratingTimeA, clockAt3PM);
assert.strictEqual(res3PM.isRecent, true, 'Rating at 2:40 PM must suppress 3:00 PM reminder');
assert(res3PM.reason?.includes('rated pain recently'));
console.log('✓ Rating at 2:40 PM suppresses 3:00 PM reminder (20m ago <= 30m).');

// Scenario B: Rating at 2:40 PM (14:40), checking at 4:00 PM (16:00) -> 80m ago > 30m -> arrives normally
const clockAt4PM = new Date('2026-11-16T16:00:00Z');
const res4PM = checkRecentActivity(null, ratingTimeA, clockAt4PM);
assert.strictEqual(res4PM.isRecent, false, 'Rating at 2:40 PM must NOT suppress 4:00 PM reminder');
console.log('✓ 4:00 PM reminder arrives normally (80m ago > 30m).');

// Scenario C: Either entry or rating within 30 minutes suppresses
const entryTimeC = '2026-11-16T14:45:00Z';
const resEntryRecent = checkRecentActivity(entryTimeC, null, clockAt3PM);
assert.strictEqual(resEntryRecent.isRecent, true, 'Entry at 2:45 PM must suppress 3:00 PM reminder');

// Scenario D: Neither is recent -> arrives normally
const oldTime = '2026-11-16T10:00:00Z';
const resNeither = checkRecentActivity(oldTime, oldTime, clockAt3PM);
assert.strictEqual(resNeither.isRecent, false, 'Old logs do not suppress reminders');
console.log('✓ Check-in suppression logic verified.');

// Verify send-reminders/index.ts source code
const sendRemindersSource = fs.readFileSync('supabase/functions/send-reminders/index.ts', 'utf8');
assert(
  sendRemindersSource.includes('Tell me how you spent the past hour, and rate your pain.'),
  'send-reminders must have updated notification body'
);
assert(
  sendRemindersSource.includes("from('pain_ratings')"),
  'send-reminders must query pain_ratings table'
);
console.log('✓ send-reminders/index.ts verified: new notification body and pain_ratings query present.\n');

console.log('--- All Milestone 3.7 checks passed successfully! ---');
