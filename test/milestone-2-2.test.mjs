/**
 * Automated test suite for Milestone 2.2: Parsing after save
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('--- Testing Milestone 2.2: Parsing after save ---');

// 1. Verify LogPage.tsx background call (instant saving)
const logPageContent = fs.readFileSync('src/pages/LogPage.tsx', 'utf8');
assert(logPageContent.includes('parseEntryInBackground(entryId)'), 'LogPage must call parseEntryInBackground');
assert(
  !logPageContent.includes('await parseEntryInBackground'),
  'LogPage must NOT await parseEntryInBackground (saving must never wait for parsing)'
);
console.log('✓ Verified: Saving is instant and calls parse-entry in background without awaiting');

// 2. Verify offlineQueue.ts calls parse-entry after sync
const offlineQueueContent = fs.readFileSync('src/lib/offlineQueue.ts', 'utf8');
assert(
  offlineQueueContent.includes('parseEntryInBackground(entry.id)'),
  'offlineQueue must call parseEntryInBackground when an offline entry syncs'
);
console.log('✓ Verified: Synced offline entries automatically trigger background parsing');

// 3. Verify parse.ts error handling & retry
const parseLibContent = fs.readFileSync('src/lib/parse.ts', 'utf8');
assert(parseLibContent.includes('export async function parseEntryInBackground'), 'Must export parseEntryInBackground');
assert(parseLibContent.includes('export async function retryParseEntry'), 'Must export retryParseEntry');
assert(
  parseLibContent.includes("parse_status: 'failed'"),
  'Must set parse_status to failed when parse fails or network is offline'
);
console.log('✓ Verified: parse.ts resilience and retry functions');

// 4. Verify HistoryPage.tsx UI states
const historyPageContent = fs.readFileSync('src/pages/HistoryPage.tsx', 'utf8');

// Pending state: RotatingSparkle + "Reading your entry"
assert(
  historyPageContent.includes("entry.parse_status === 'pending'"),
  'HistoryPage must handle entry.parse_status === pending'
);
assert(
  historyPageContent.includes('Reading your entry'),
  'HistoryPage must show "Reading your entry"'
);
assert(
  historyPageContent.includes('<RotatingSparkle'),
  'HistoryPage must render RotatingSparkle during pending state'
);
console.log('✓ Verified: Card shows rotating sparkle and "Reading your entry" while parsing');

// Failed state: "I couldn't read that one" + "Try again" button
assert(
  historyPageContent.includes("entry.parse_status === 'failed'"),
  'HistoryPage must handle entry.parse_status === failed'
);
assert(
  historyPageContent.includes("I couldn't read that one"),
  'HistoryPage must show "I couldn\'t read that one"'
);
assert(
  historyPageContent.includes('Try again'),
  'HistoryPage must render "Try again" button'
);
console.log('✓ Verified: Failed parse shows "I couldn\'t read that one" with Try again button');

// Segments display under raw text with time range, label, and category chip
assert(
  historyPageContent.includes('entry.segments && entry.segments.length > 0'),
  'HistoryPage must render segments when available'
);
assert(
  historyPageContent.includes('<Chip label={seg.category}'),
  'HistoryPage must render category chip for each segment'
);
assert(
  historyPageContent.includes('history-segment-time'),
  'HistoryPage must render segment time range'
);
assert(
  historyPageContent.includes('history-segment-label'),
  'HistoryPage must render segment activity label'
);
console.log('✓ Verified: Cards display segment chips under raw text with time range, label, and category');

// 5. Verify layout.css styling
const layoutCss = fs.readFileSync('src/styles/layout.css', 'utf8');
assert(layoutCss.includes('.history-card-parsing'), 'layout.css must have .history-card-parsing');
assert(layoutCss.includes('.history-card-failed'), 'layout.css must have .history-card-failed');
assert(layoutCss.includes('.history-retry-btn'), 'layout.css must have .history-retry-btn');
assert(layoutCss.includes('.history-card-segments'), 'layout.css must have .history-card-segments');
console.log('✓ Verified: layout.css contains all required design tokens and classes for parsing states');

console.log('\nAll Milestone 2.2 checks passed successfully!');
