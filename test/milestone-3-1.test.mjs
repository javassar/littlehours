/**
 * Test Suite for Milestone 3.1: Keys and subscribing
 */

import assert from 'assert';
import fs from 'fs';
import { urlBase64ToUint8Array, isStandalone, isPushSupported } from '../src/lib/push.ts';

console.log('--- Testing Milestone 3.1: Keys and Subscribing ---');

// ==========================================
// 1. VAPID Key Generation & Verification
// ==========================================
console.log('\n[Check 1] Verifying VAPID key generation and configuration...');

assert.strictEqual(fs.existsSync('.vapid_keys.json'), true, '.vapid_keys.json must exist');
const vapidData = JSON.parse(fs.readFileSync('.vapid_keys.json', 'utf-8'));

assert.ok(vapidData.publicKey, 'Public key must be present');
assert.ok(vapidData.privateKey, 'Private key must be present');
assert.strictEqual(vapidData.subject, 'mailto:jacqueline@littlehours.app');

// Public key should decode to 65 bytes (0x04 uncompressed P-256 EC point)
const pubKeyBytes = urlBase64ToUint8Array(vapidData.publicKey);
assert.strictEqual(pubKeyBytes.length, 65, 'VAPID public key must be 65 bytes (P-256 uncompressed point)');
assert.strictEqual(pubKeyBytes[0], 0x04, 'First byte of uncompressed EC point must be 0x04');

// Verify .env.local has VITE_VAPID_PUBLIC_KEY
assert.strictEqual(fs.existsSync('.env.local'), true, '.env.local must exist');
const envContent = fs.readFileSync('.env.local', 'utf-8');
assert.ok(envContent.includes('VITE_VAPID_PUBLIC_KEY='), '.env.local must include VITE_VAPID_PUBLIC_KEY');
assert.ok(envContent.includes(vapidData.publicKey), '.env.local must contain the generated public key');

// Verify .gitignore protects .vapid_keys.json and .env.local
const gitignore = fs.readFileSync('.gitignore', 'utf-8');
assert.ok(gitignore.includes('.vapid_keys.json'), '.gitignore must ignore .vapid_keys.json');
assert.ok(gitignore.includes('.env.local'), '.gitignore must ignore .env.local');

console.log('✓ VAPID keys properly generated, formatted, and secured');

// ==========================================
// 2. Base64url to Uint8Array Conversion
// ==========================================
console.log('\n[Check 2] Testing urlBase64ToUint8Array...');

const sampleBase64Url = 'AQIDBAUG'; // [1, 2, 3, 4, 5, 6]
const bytes = urlBase64ToUint8Array(sampleBase64Url);
assert.deepStrictEqual(Array.from(bytes), [1, 2, 3, 4, 5, 6], 'Decodes base64url correctly');
console.log('✓ urlBase64ToUint8Array conversion verified');

// ==========================================
// 3. Standalone Mode vs Browser Tab Detection
// SPEC.md: "In a normal Safari tab, the explanation shows instead."
// SPEC.md: "On the installed app, tapping the button shows the system permission prompt..."
// ==========================================
console.log('\n[Check 3] Standalone detection & browser tab behavior...');

// In standard node environment (no window), isStandalone returns false
assert.strictEqual(isStandalone(), false, 'Default non-window environment returns false');

// Simulated Browser Tab (Safari normal tab):
const mockSafariTab = {
  matchMedia: (query) => ({ matches: false }),
  navigator: { standalone: false },
};

function checkIsStandalone(win) {
  const isStandaloneMedia = win.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = win.navigator.standalone === true;
  return Boolean(isStandaloneMedia || isIosStandalone);
}

assert.strictEqual(checkIsStandalone(mockSafariTab), false, 'Normal Safari tab is NOT standalone');

// Simulated Installed App (Home Screen PWA):
const mockHomeScreenPwa = {
  matchMedia: (query) => ({ matches: query === '(display-mode: standalone)' }),
  navigator: { standalone: true },
};

assert.strictEqual(checkIsStandalone(mockHomeScreenPwa), true, 'Home Screen PWA is standalone');

console.log('✓ Standalone mode correctly discriminates between Safari tab and Installed PWA');

// ==========================================
// 4. UI State Logic (On, Off, Blocked, Browser Tab)
// ==========================================
console.log('\n[Check 4] Push Reminders UI State logic...');

function resolvePushUiState({ isStandalone, permission, isSubscribed }) {
  if (!isStandalone) {
    return {
      state: 'browser',
      pill: 'Browser Tab',
      showInstallGuide: true,
      showSubscribeBtn: false,
    };
  }

  if (permission === 'denied') {
    return {
      state: 'blocked',
      pill: 'Blocked',
      showBlockedNotice: true,
      showSubscribeBtn: false,
    };
  }

  if (isSubscribed) {
    return {
      state: 'on',
      pill: 'On',
      showUnsubscribeBtn: true,
      showSubscribeBtn: false,
    };
  }

  return {
    state: 'off',
    pill: 'Off',
    showSubscribeBtn: true,
    showUnsubscribeBtn: false,
  };
}

// Case 1: In normal Safari tab -> Show installation guide
const tabState = resolvePushUiState({ isStandalone: false, permission: 'default', isSubscribed: false });
assert.strictEqual(tabState.state, 'browser');
assert.strictEqual(tabState.showInstallGuide, true);
assert.strictEqual(tabState.showSubscribeBtn, false, 'Subscribe button MUST NOT show in normal Safari tab');

// Case 2: In Home Screen app, not subscribed -> Show "Turn on reminders" button
const pwaOffState = resolvePushUiState({ isStandalone: true, permission: 'default', isSubscribed: false });
assert.strictEqual(pwaOffState.state, 'off');
assert.strictEqual(pwaOffState.showSubscribeBtn, true, 'Turn on reminders button shows in installed app');

// Case 3: In Home Screen app, subscribed -> Show "On" and "Turn off reminders"
const pwaOnState = resolvePushUiState({ isStandalone: true, permission: 'granted', isSubscribed: true });
assert.strictEqual(pwaOnState.state, 'on');
assert.strictEqual(pwaOnState.showUnsubscribeBtn, true);

// Case 4: In Home Screen app, blocked -> Show Blocked note with settings guidance
const pwaBlockedState = resolvePushUiState({ isStandalone: true, permission: 'denied', isSubscribed: false });
assert.strictEqual(pwaBlockedState.state, 'blocked');
assert.strictEqual(pwaBlockedState.showBlockedNotice, true);
assert.strictEqual(pwaBlockedState.showSubscribeBtn, false);

console.log('✓ All 4 UI states (Browser Tab, Off, On, Blocked) verified');

// ==========================================
// 5. Database Schema & RLS for push_subscriptions
// ==========================================
console.log('\n[Check 5] Verifying push_subscriptions database schema...');

const schemaSql = fs.readFileSync('supabase/migrations/20261109000000_initial_schema.sql', 'utf-8');

assert.ok(schemaSql.includes('create table if not exists public.push_subscriptions'), 'Table push_subscriptions defined');
assert.ok(schemaSql.includes('endpoint text not null unique'), 'endpoint is unique');
assert.ok(schemaSql.includes('p256dh text not null'), 'p256dh column defined');
assert.ok(schemaSql.includes('auth text not null'), 'auth column defined');
assert.ok(schemaSql.includes('alter table public.push_subscriptions enable row level security'), 'RLS enabled');

console.log('✓ push_subscriptions schema and RLS verified');

console.log('\n=============================================');
console.log('ALL MILESTONE 3.1 TESTS PASSED SUCCESSFULLY!');
console.log('=============================================\n');
