import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('--- Testing Milestone 1.7 Installable app and deploy ---');

// 1. Verify vercel.json
const vercelRaw = fs.readFileSync('vercel.json', 'utf8');
const vercelJson = JSON.parse(vercelRaw);
assert(Array.isArray(vercelJson.rewrites), 'vercel.json must have rewrites array');
assert.strictEqual(vercelJson.rewrites[0].source, '/(.*)', 'vercel.json must match all paths /(.*)');
assert.strictEqual(vercelJson.rewrites[0].destination, '/index.html', 'vercel.json destination must be /index.html');
console.log('✓ vercel.json rewrite configuration verified');

// 2. Verify apple-touch-icon (180x180)
const appleIcon = fs.readFileSync('public/apple-touch-icon.png');
const appleW = appleIcon.readUInt32BE(16);
const appleH = appleIcon.readUInt32BE(20);
assert.strictEqual(appleW, 180, 'Apple touch icon width must be 180px');
assert.strictEqual(appleH, 180, 'Apple touch icon height must be 180px');
console.log('✓ 180px Apple touch icon verified');

// 3. Verify other icons
const icon192 = fs.readFileSync('public/icon-192.png');
assert.strictEqual(icon192.readUInt32BE(16), 192);
assert.strictEqual(icon192.readUInt32BE(20), 192);

const icon512 = fs.readFileSync('public/icon-512.png');
assert.strictEqual(icon512.readUInt32BE(16), 512);
assert.strictEqual(icon512.readUInt32BE(20), 512);

const icon512m = fs.readFileSync('public/icon-512-maskable.png');
assert.strictEqual(icon512m.readUInt32BE(16), 512);
assert.strictEqual(icon512m.readUInt32BE(20), 512);
console.log('✓ 192px, 512px, and 512px maskable icons verified');

// 4. Verify index.html meta and apple-touch-icon link
const indexHtml = fs.readFileSync('index.html', 'utf8');
assert(indexHtml.includes('rel="apple-touch-icon"'), 'index.html must link apple-touch-icon');
assert(indexHtml.includes('name="theme-color" content="#F6EDEA"'), 'theme-color must be #F6EDEA');
assert(
  indexHtml.includes('name="mobile-web-app-capable" content="yes"') ||
    indexHtml.includes('name="apple-mobile-web-app-capable" content="yes"'),
  'mobile-web-app-capable must be yes'
);
console.log('✓ index.html PWA tags verified');

// 5. Verify sw.ts
const swTs = fs.readFileSync('src/sw.ts', 'utf8');
assert(swTs.includes('precacheAndRoute'), 'sw.ts must call precacheAndRoute');
assert(swTs.includes('createHandlerBoundToURL'), 'sw.ts must handle offline navigation to index.html');
console.log('✓ src/sw.ts precache and offline app shell caching verified');

// 6. Verify InstallBanner component
const bannerTs = fs.readFileSync('src/components/InstallBanner.tsx', 'utf8');
assert(bannerTs.includes('Tap Share, then Add to Home Screen.'), 'Banner must have exact required text');
assert(bannerTs.includes('display-mode: standalone'), 'Banner must check standalone display mode');
assert(bannerTs.includes('localStorage'), 'Banner must use localStorage for dismiss state');
console.log('✓ InstallBanner component verified');

console.log('All Milestone 1.7 logic and asset checks passed successfully!');
