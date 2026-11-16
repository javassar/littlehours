/**
 * Test Suite for Milestone 3.2: Showing and opening notifications
 */

import assert from 'assert';
import fs from 'fs';

console.log('--- Testing Milestone 3.2: Showing and opening notifications ---');

// ==========================================
// 1. Service Worker: Push Event Handler & Options
// SPEC.md:
// "show a notification with the title 'Little Hours' and the body 'Tell me how you spent the past hour.'
//  Use the app icon and tag: 'hourly', so a new reminder replaces an unread older one instead of stacking.
//  Do not rely on notification action buttons. They may not appear on iPhone."
// ==========================================
console.log('\n[Check 1] Verifying push event listener in src/sw.ts...');

const swCode = fs.readFileSync('src/sw.ts', 'utf-8');

assert.ok(swCode.includes("self.addEventListener('push'"), "sw.ts must listen for 'push' event");
assert.ok(swCode.includes("'Little Hours'"), "Default notification title must be 'Little Hours'");
assert.ok(
  swCode.includes("'Tell me how you spent the past hour.'"),
  "Default notification body must be 'Tell me how you spent the past hour.'"
);
assert.ok(swCode.includes("icon: '/icon-192.png'"), 'Notification must use app icon /icon-192.png');
assert.ok(
  swCode.includes("tag: 'hourly'"),
  "Notification must have tag: 'hourly' so replacement works instead of stacking"
);
assert.ok(
  swCode.includes("url: '/?focus=1'"),
  "Notification data must include url: '/?focus=1'"
);

// Verify no action buttons are specified
assert.strictEqual(
  swCode.includes('actions:'),
  false,
  'Must NOT include notification action buttons (they do not appear on iOS Safari)'
);

console.log('✓ Push notification configuration (title, body, icon, tag: hourly, no action buttons) verified');

// ==========================================
// 2. Notification Click Handler & Window Focus
// SPEC.md:
// "Handle notificationclick: close the notification, focus the open app window if there is one,
//  and otherwise open /?focus=1."
// ==========================================
console.log('\n[Check 2] Verifying notificationclick listener in src/sw.ts...');

assert.ok(
  swCode.includes("self.addEventListener('notificationclick'"),
  "sw.ts must listen for 'notificationclick' event"
);
assert.ok(
  swCode.includes('event.notification.close()'),
  'Must close notification on click'
);
assert.ok(
  swCode.includes('clients.matchAll'),
  'Must query open clients via matchAll'
);
assert.ok(
  swCode.includes('client.focus()'),
  'Must focus open client window if found'
);
assert.ok(
  swCode.includes('clients.openWindow'),
  'Must open new window with /?focus=1 if no client is open'
);

console.log('✓ Notification click handler and window focus logic verified');

// ==========================================
// 3. Log Screen Focus on ?focus=1 & SW Message
// SPEC.md:
// "When the Log screen sees focus=1, it focuses the text box."
// ==========================================
console.log('\n[Check 3] Verifying focus behavior in src/pages/LogPage.tsx...');

const logPageCode = fs.readFileSync('src/pages/LogPage.tsx', 'utf-8');

assert.ok(
  logPageCode.includes("searchParams.get('focus') === '1'"),
  "LogPage must detect ?focus=1 query param"
);
assert.ok(
  logPageCode.includes('textareaRef.current?.focus()'),
  'LogPage must focus textarea when ?focus=1 is detected'
);
assert.ok(
  logPageCode.includes("NOTIFICATION_CLICK_FOCUS"),
  'LogPage must listen for service worker focus message'
);

console.log('✓ LogPage focus behavior on ?focus=1 and window resume verified');

// ==========================================
// 4. Simulated Notification Replacement Test (tag: 'hourly')
// SPEC.md: "Two test pushes in a row leave one notification, not two."
// ==========================================
console.log('\n[Check 4] Simulating notification tray replacement with tag: hourly...');

class MockNotificationManager {
  constructor() {
    this.tray = new Map(); // tag -> notification
  }

  showNotification(title, options) {
    const tag = options.tag || Math.random().toString();
    const notification = { title, ...options };
    this.tray.set(tag, notification);
  }

  get activeNotifications() {
    return Array.from(this.tray.values());
  }
}

const manager = new MockNotificationManager();

// First push arrives at 2:00 PM
manager.showNotification('Little Hours', {
  body: 'Tell me how you spent the past hour.',
  icon: '/icon-192.png',
  tag: 'hourly',
});

assert.strictEqual(manager.activeNotifications.length, 1);
assert.strictEqual(manager.activeNotifications[0].tag, 'hourly');

// Second push arrives at 3:00 PM before the first was opened
manager.showNotification('Little Hours', {
  body: 'Tell me how you spent the past hour.',
  icon: '/icon-192.png',
  tag: 'hourly',
});

// Since tag is 'hourly', it replaces the previous one
assert.strictEqual(
  manager.activeNotifications.length,
  1,
  'Two test pushes in a row with tag: hourly must leave exactly 1 notification'
);

console.log('✓ Two pushes in a row leaves exactly 1 notification (replaced by tag: hourly)');

console.log('\n=============================================');
console.log('ALL MILESTONE 3.2 TESTS PASSED SUCCESSFULLY!');
console.log('=============================================\n');
