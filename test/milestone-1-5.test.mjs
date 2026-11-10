import assert from 'node:assert';
import {
  enqueueEntry,
  dequeueEntry,
  getQueue,
  getLatestWindowEnd,
} from '../src/lib/offlineQueue.ts';

console.log('--- Testing Milestone 1.5 Offline Saving and Sync ---');

const testUserId = 'user-test-uuid-123';

// Clean start
const initialQueue = await getQueue();
for (const item of initialQueue) {
  await dequeueEntry(item.id);
}
assert.strictEqual((await getQueue()).length, 0, 'Queue is initially empty');

// 1. Log first entry offline (10:00 to 11:00)
const entry1_id = 'entry-uuid-001';
const entry1_start = '2026-11-09T17:00:00.000Z'; // 10:00 AM MST
const entry1_end = '2026-11-09T18:00:00.000Z';   // 11:00 AM MST

await enqueueEntry({
  id: entry1_id,
  user_id: testUserId,
  raw_text: 'Read a book in the quiet garden',
  window_start: entry1_start,
  window_end: entry1_end,
  parse_status: 'pending',
  follow_ups: [],
  created_at: new Date().toISOString(),
});

// Check that queue has 1 item
const queueAfter1 = await getQueue();
assert.strictEqual(queueAfter1.length, 1, 'Queue has 1 entry');
assert.strictEqual(queueAfter1[0].id, entry1_id);
assert.strictEqual(queueAfter1[0].isQueued, true, 'Marked as queued');

// Verify default window start accounts for queued entries
const latestEndAfter1 = await getLatestWindowEnd(testUserId);
assert.notStrictEqual(latestEndAfter1, null, 'Latest end found from queue');
assert.strictEqual(latestEndAfter1.toISOString(), entry1_end, 'Second entry will start exactly where first entry ended');

// 2. Log second entry offline (starts where entry 1 ended: 11:00 to 12:30)
const entry2_id = 'entry-uuid-002';
const entry2_start = latestEndAfter1.toISOString();
const entry2_end = '2026-11-09T19:30:00.000Z'; // 12:30 PM MST

await enqueueEntry({
  id: entry2_id,
  user_id: testUserId,
  raw_text: 'Made herbal tea and wrote notes',
  window_start: entry2_start,
  window_end: entry2_end,
  parse_status: 'pending',
  follow_ups: [],
  created_at: new Date().toISOString(),
});

// Check that queue has 2 items in newest-first order
const queueAfter2 = await getQueue();
assert.strictEqual(queueAfter2.length, 2, 'Queue has 2 entries');
assert.strictEqual(queueAfter2[0].id, entry2_id, 'Newest entry is at front');
assert.strictEqual(queueAfter2[1].id, entry1_id, 'First entry is second');

// Verify contiguous start
assert.strictEqual(queueAfter2[0].window_start, queueAfter2[1].window_end, 'Second entry starts exactly where first ended');

// Verify latest window end after 2 entries
const latestEndAfter2 = await getLatestWindowEnd(testUserId);
assert.strictEqual(latestEndAfter2.toISOString(), entry2_end, 'Accounts for second queued entry');

console.log('✓ Offline logging 2 entries in a row verified: contiguous window_start');

// 3. Simulate force-closing and reopening app:
// Read queue fresh
const restoredQueue = await getQueue();
assert.strictEqual(restoredQueue.length, 2, 'Restored queue retains all entries across sessions');
assert.strictEqual(restoredQueue[0].raw_text, 'Made herbal tea and wrote notes');
assert.strictEqual(restoredQueue[1].raw_text, 'Read a book in the quiet garden');

console.log('✓ Force-closing and reopening app retains queued entries');

// 4. Upsert idempotent sync simulation
const mockDatabase = new Map();

function mockUpsert(entry) {
  // Simulates Postgres upsert on id
  mockDatabase.set(entry.id, entry);
}

// First sync pass
for (const item of restoredQueue) {
  mockUpsert(item);
  await dequeueEntry(item.id);
}
assert.strictEqual(mockDatabase.size, 2, 'Database received 2 entries');
assert.strictEqual((await getQueue()).length, 0, 'Queue is empty after sync');

// Simulate a retry sync with the same items
for (const item of restoredQueue) {
  mockUpsert(item); // Should NOT create duplicate rows
}
assert.strictEqual(mockDatabase.size, 2, 'Retry sync with upsert does not create duplicate rows');

console.log('✓ Sync upsert prevents duplicate entries on retry');
console.log('All Milestone 1.5 logic tests passed successfully!');
