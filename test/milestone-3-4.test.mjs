/**
 * Test Suite for Milestone 3.4: Settings, snooze, and pause
 */

import assert from 'assert';
import {
  computeNextReminderTime,
  formatFriendlyTime,
  getLocalHour,
  COMMON_TIMEZONES,
} from '../src/lib/settings.ts';

console.log('--- Testing Milestone 3.4: Settings, snooze, and pause ---');

// ==========================================
// 1. Next Scheduled Reminder Computation
// ==========================================
console.log('\n[Check 1] Computing next scheduled reminder time...');

// 1.1 Inside active window: 10:15 AM today in America/Phoenix -> should return 11:00 AM today
const baseDate = new Date('2026-11-15T17:15:00Z'); // 10:15 AM MST
const next11am = computeNextReminderTime(
  {
    reminders_enabled: true,
    timezone: 'America/Phoenix',
    reminder_start_hour: 8,
    reminder_end_hour: 23,
    snooze_until: null,
  },
  baseDate
);

assert.ok(next11am, 'Must return next reminder date');
assert.strictEqual(getLocalHour(next11am, 'America/Phoenix'), 11, 'Next reminder is 11:00 AM');
assert.strictEqual(next11am.getMinutes(), 0, 'Minute is 0 (top of hour)');

// 1.2 After last reminder hour: 11:30 PM (23:30) in America/Phoenix -> should jump to 8:00 AM tomorrow
const lateNight = new Date('2026-11-16T06:30:00Z'); // 23:30 MST
const nextTomorrow8am = computeNextReminderTime(
  {
    reminders_enabled: true,
    timezone: 'America/Phoenix',
    reminder_start_hour: 8,
    reminder_end_hour: 23,
    snooze_until: null,
  },
  lateNight
);

assert.ok(nextTomorrow8am, 'Must return next reminder date');
assert.strictEqual(getLocalHour(nextTomorrow8am, 'America/Phoenix'), 8, 'Jumps to 8:00 AM next day');
assert.ok(nextTomorrow8am.getTime() > lateNight.getTime(), 'Next reminder is strictly in future');

// 1.3 Early morning quiet hours: 2:15 AM in America/Phoenix -> should jump to 8:00 AM today
const earlyMorning = new Date('2026-11-15T09:15:00Z'); // 02:15 MST
const nextMorning8am = computeNextReminderTime(
  {
    reminders_enabled: true,
    timezone: 'America/Phoenix',
    reminder_start_hour: 8,
    reminder_end_hour: 23,
    snooze_until: null,
  },
  earlyMorning
);

assert.ok(nextMorning8am, 'Must return next reminder date');
assert.strictEqual(getLocalHour(nextMorning8am, 'America/Phoenix'), 8, 'Advances to 8:00 AM today');

console.log('✓ Next scheduled reminder time calculated accurately across day boundaries');

// ==========================================
// 2. SPEC.md Check 1: Snooze Logic
// "Snoozing skips the next hourly reminder and resumes after it."
// ==========================================
console.log('\n[Check 2] Testing snooze behavior (SPEC.md Check 1)...');

// Current time: 10:15 AM (next would normally be 11:00 AM)
// User snoozes for 1 hour -> snooze_until = 11:15 AM
const snoozeUntil = new Date('2026-11-15T18:15:00Z').toISOString(); // 11:15 AM MST

const nextAfterSnooze = computeNextReminderTime(
  {
    reminders_enabled: true,
    timezone: 'America/Phoenix',
    reminder_start_hour: 8,
    reminder_end_hour: 23,
    snooze_until: snoozeUntil,
  },
  baseDate // 10:15 AM MST
);

assert.ok(nextAfterSnooze, 'Must return next reminder after snooze');
assert.strictEqual(
  getLocalHour(nextAfterSnooze, 'America/Phoenix'),
  12,
  'Must skip 11:00 AM reminder and resume at 12:00 PM'
);
assert.ok(
  nextAfterSnooze.getTime() > new Date(snoozeUntil).getTime(),
  'Next reminder is strictly after snooze_until'
);

console.log('✓ Snoozing for 1 hour skips the 11:00 AM reminder and resumes at 12:00 PM');

// ==========================================
// 3. SPEC.md Check 2: Pause and Resume Logic
// "Turning reminders off stops all notifications. Turning them on restores them."
// ==========================================
console.log('\n[Check 3] Testing turning reminders off and on (SPEC.md Check 2)...');

// Turning off:
const turnedOff = computeNextReminderTime({
  reminders_enabled: false,
  timezone: 'America/Phoenix',
  reminder_start_hour: 8,
  reminder_end_hour: 23,
  snooze_until: null,
});
assert.strictEqual(turnedOff, null, 'When reminders_enabled is false, next reminder must be null (paused)');

// Turning on:
const turnedOn = computeNextReminderTime({
  reminders_enabled: true,
  timezone: 'America/Phoenix',
  reminder_start_hour: 8,
  reminder_end_hour: 23,
  snooze_until: null,
});
assert.ok(turnedOn !== null, 'When reminders_enabled is true, next reminder is restored');

console.log('✓ Turning reminders off stops scheduling; turning them on restores next reminder');

// ==========================================
// 4. Friendly Time Formatting
// ==========================================
console.log('\n[Check 4] Formatting friendly reminder strings...');

const formattedToday = formatFriendlyTime(next11am, 'America/Phoenix', baseDate);
assert.strictEqual(formattedToday, 'Today at 11:00 AM', 'Formatted as Today at 11:00 AM');

const formattedTomorrow = formatFriendlyTime(nextTomorrow8am, 'America/Phoenix', lateNight);
assert.strictEqual(formattedTomorrow, 'Tomorrow at 8:00 AM', 'Formatted as Tomorrow at 8:00 AM');

console.log('✓ Friendly time formatting verified');

// ==========================================
// 5. Timezones List
// ==========================================
console.log('\n[Check 5] Verifying timezone list...');

assert.ok(COMMON_TIMEZONES.includes('America/Phoenix'), 'Must include America/Phoenix');
assert.ok(COMMON_TIMEZONES.includes('America/Los_Angeles'), 'Must include America/Los_Angeles');
assert.ok(COMMON_TIMEZONES.includes('America/New_York'), 'Must include America/New_York');
assert.strictEqual(COMMON_TIMEZONES[0], 'America/Phoenix', 'Default timezone is first in list');

console.log('✓ Timezone list verified');

console.log('\n=============================================');
console.log('ALL MILESTONE 3.4 TESTS PASSED SUCCESSFULLY!');
console.log('=============================================\n');
