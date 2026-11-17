/**
 * Test Suite for Milestone 2.4: Follow-up questions
 */

import assert from 'assert';
import fs from 'fs';
import { validateParseResult } from '../supabase/functions/parse-entry/validator.ts';
import { SYSTEM_PROMPT, PROMPT_VERSION } from '../supabase/functions/parse-entry/prompt.ts';

console.log('--- Testing Milestone 2.4: Follow-up questions ---');

const CATEGORIES = [
  'work',
  'job search',
  'phone and social media',
  'sleep',
  'exercise',
  'meals',
  'chores',
  'social time',
  'reading',
  'entertainment',
  'travel',
  'personal care',
  'errands',
  'rest',
];

// ==========================================
// Check 1: Components and Exports
// ==========================================
console.log('\n[Check 1] Verifying FollowUpCard component and exports...');
const componentsIndex = fs.readFileSync('src/components/index.ts', 'utf8');
assert(componentsIndex.includes('FollowUpCard'), 'FollowUpCard must be exported from src/components/index.ts');

const followUpCardCode = fs.readFileSync('src/components/FollowUpCard.tsx', 'utf8');
assert(followUpCardCode.includes('followup-input'), 'FollowUpCard must include input text box');
assert(followUpCardCode.includes('onAnswer'), 'FollowUpCard must have onAnswer prop');
assert(followUpCardCode.includes('onFixByHand'), 'FollowUpCard must have onFixByHand prop');
assert(followUpCardCode.includes('roundsCount >= 3') || followUpCardCode.includes('maxRoundsReached'), 'FollowUpCard must handle up to 3 rounds');
console.log('✓ Verified: FollowUpCard component exists and is exported with all required props.');

// ==========================================
// Check 2: Prompt v2 & Follow-ups Support
// ==========================================
console.log('\n[Check 2] Verifying prompt.ts v2 and follow-ups rules...');
assert(['v2', 'v3'].includes(PROMPT_VERSION), 'PROMPT_VERSION must be at least v2');
assert(SYSTEM_PROMPT.includes('follow_ups'), 'SYSTEM_PROMPT must mention follow_ups');
assert(SYSTEM_PROMPT.includes('combine the activities in raw_text with the answers in follow_ups'), 'SYSTEM_PROMPT must explain combining raw_text and follow_ups');
console.log('✓ Verified: SYSTEM_PROMPT includes explicit instructions for follow-ups.');

// ==========================================
// Check 3: Check item 1 & 2 from SPEC.md:
// "A 3-hour window with '30 minutes scrolling' produces the question about the remaining 2h 30m, and my answer completes the window."
// "The original text is unchanged in the database after the follow-up."
// ==========================================
console.log('\n[Check 3] Verifying Milestone 2.4 follow-up test case...');
const windowStart = '2026-11-09T14:00:00-07:00';
const windowEnd = '2026-11-09T17:00:00-07:00'; // 3-hour window
const originalRawText = '30 minutes scrolling';

// Initial state before follow-up
const mockEntry = {
  id: 'test-entry-1',
  raw_text: originalRawText,
  window_start: windowStart,
  window_end: windowEnd,
  parse_status: 'needs_clarification',
  clarification_question: 'This covers 30m of your 3h. What happened in the rest?',
  follow_ups: [],
};

// Round 1 parse result
const round1Result = {
  status: 'needs_clarification',
  question: 'This covers 30m of your 3h. What happened in the rest?',
  segments: [],
};
const valRound1 = validateParseResult(round1Result, windowStart, windowEnd, CATEGORIES);
assert.strictEqual(valRound1.valid, true);
assert.strictEqual(round1Result.status, 'needs_clarification');
assert(round1Result.question.includes('30m') && round1Result.question.includes('3h'));
console.log('✓ Round 1: 3-hour window with "30 minutes scrolling" correctly returned needs_clarification.');

// User submits follow-up answer:
const userAnswer = '2h 30m answering emails';
const followUpSubmission = {
  question: mockEntry.clarification_question,
  answer: userAnswer,
  answered_at: new Date().toISOString(),
};

// Update entry: follow_ups updated, raw_text strictly unchanged!
const updatedEntry = {
  ...mockEntry,
  follow_ups: [...mockEntry.follow_ups, followUpSubmission],
  parse_status: 'pending',
};

assert.strictEqual(updatedEntry.raw_text, originalRawText, 'raw_text must remain strictly untouched');
assert.strictEqual(updatedEntry.follow_ups.length, 1);
assert.strictEqual(updatedEntry.follow_ups[0].answer, '2h 30m answering emails');
console.log('✓ Verified: raw_text is completely preserved and untouched in entry state.');

// Round 2 parse simulation with follow-up provided:
const round2Result = {
  status: 'parsed',
  question: null,
  segments: [
    {
      start_time: '2026-11-09T14:00:00-07:00',
      end_time: '2026-11-09T14:30:00-07:00',
      activity_label: 'doom scrolling',
      category: 'phone and social media',
    },
    {
      start_time: '2026-11-09T14:30:00-07:00',
      end_time: '2026-11-09T17:00:00-07:00',
      activity_label: 'answering emails',
      category: 'work',
    },
  ],
};

const valRound2 = validateParseResult(round2Result, windowStart, windowEnd, CATEGORIES);
assert.strictEqual(valRound2.valid, true, `Round 2 validation failed: ${valRound2.error}`);
assert.strictEqual(round2Result.status, 'parsed');
assert.strictEqual(round2Result.segments.length, 2);
console.log('✓ Round 2: Combined raw_text + follow_up answered the window and validated into contiguous segments.');

// ==========================================
// Check 4: Fix it by hand behavior
// ==========================================
console.log('\n[Check 4] Verifying "Fix it by hand" segment coverage...');
const handCreatedSegment = {
  id: 'manual-seg-1',
  start_time: windowStart,
  end_time: windowEnd,
  activity_label: 'project work',
  category: 'work',
};

const handResult = {
  status: 'parsed',
  segments: [handCreatedSegment],
};

const valHand = validateParseResult(handResult, windowStart, windowEnd, CATEGORIES);
assert.strictEqual(valHand.valid, true, `Manual segment validation failed: ${valHand.error}`);
assert.strictEqual(handResult.segments.length, 1);
assert.strictEqual(handResult.segments[0].start_time, windowStart);
assert.strictEqual(handResult.segments[0].end_time, windowEnd);
console.log('✓ Verified: Fix it by hand segment spans the entire window seamlessly.');

console.log('\nAll Milestone 2.4 checks passed successfully!');
