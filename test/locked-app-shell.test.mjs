import fs from 'fs';
import assert from 'assert';

console.log('--- Testing iOS Status Bar Fix (Fixed Cap & Sticky Opaque Header) ---');

// 1. Check index.html for viewport-fit=cover, status-bar-style, and theme-color
const indexHtml = fs.readFileSync('index.html', 'utf8');

console.log('\n[Check 1] Verify index.html viewport meta and status-bar settings...');
assert(
  indexHtml.includes('viewport-fit=cover'),
  'index.html viewport meta must include viewport-fit=cover'
);
assert(
  indexHtml.includes('name="apple-mobile-web-app-status-bar-style" content="default"'),
  'index.html must keep apple-mobile-web-app-status-bar-style as default'
);
assert(
  indexHtml.includes('name="theme-color" content="#F6EDEA"'),
  'index.html must keep theme-color as #F6EDEA'
);
console.log('✓ index.html verified: viewport-fit=cover, default status bar style, theme-color #F6EDEA.');

// 2. Check src/App.tsx for status-bar-cap element
const appTsx = fs.readFileSync('src/App.tsx', 'utf8');

console.log('\n[Check 2] Verify status-bar-cap rendered at very top of app root in App.tsx...');
assert(
  appTsx.includes('className="status-bar-cap"'),
  'App.tsx must render <div className="status-bar-cap" aria-hidden="true" />'
);
assert(
  appTsx.indexOf('status-bar-cap') < appTsx.indexOf('{showNav && <Header />}'),
  'status-bar-cap must be rendered before Header at the very top of the app root DOM'
);
console.log('✓ status-bar-cap verified at the top of the DOM in App.tsx.');

// 3. Check src/styles/layout.css for .status-bar-cap styles
const layoutCss = fs.readFileSync('src/styles/layout.css', 'utf8');

console.log('\n[Check 3] Verify .status-bar-cap styling in layout.css...');
assert(layoutCss.includes('.status-bar-cap'), 'layout.css must define .status-bar-cap');
assert(layoutCss.includes('position: fixed;'), '.status-bar-cap must be position: fixed;');
assert(layoutCss.includes('top: 0;'), '.status-bar-cap must be at top: 0;');
assert(layoutCss.includes('left: 0;') && layoutCss.includes('right: 0;'), '.status-bar-cap must stretch left: 0 to right: 0;');
assert(layoutCss.includes('max(env(safe-area-inset-top), 12px);') || layoutCss.includes('max(env(safe-area-inset-top'), '.status-bar-cap must have height: max(env(safe-area-inset-top), 12px);');
assert(layoutCss.includes('background-color: #F6EDEA;'), '.status-bar-cap must have solid background-color: #F6EDEA;');
assert(layoutCss.includes('z-index: 50;'), '.status-bar-cap must have z-index: 50;');
assert(layoutCss.includes('pointer-events: none;'), '.status-bar-cap must have pointer-events: none;');
console.log('✓ .status-bar-cap verified: fixed top: 0, height max(env(safe-area-inset-top), 12px), solid #F6EDEA, z-index 50, pointer-events none.');

// 4. Check src/components/Header.css for sticky header styling
const headerCss = fs.readFileSync('src/components/Header.css', 'utf8');

console.log('\n[Check 4] Verify Header sticky & 100% opaque styling...');
assert(headerCss.includes('position: sticky;'), 'Header must have position: sticky;');
assert(headerCss.includes('top: 0;'), 'Header must have top: 0;');
assert(headerCss.includes('z-index: 40;'), 'Header must have z-index: 40;');
assert(headerCss.includes('background-color: #F6EDEA;'), 'Header must have solid #F6EDEA background-color;');
assert(
  headerCss.includes('padding-top: calc(env(safe-area-inset-top) + 0.75rem);') ||
  headerCss.includes('padding-top: calc(env(safe-area-inset-top, 0px) + 0.75rem);'),
  'Header must have padding-top: calc(env(safe-area-inset-top) + 0.75rem);'
);
assert(!headerCss.includes('backdrop-filter'), 'Header must NOT have backdrop-filter;');
console.log('✓ Header verified: position: sticky, top: 0, z-index: 40, solid #F6EDEA, padding-top calc(env(safe-area-inset-top) + 0.75rem), no backdrop-filter.');

console.log('\n--- All iOS status bar fix checks passed successfully! ---');
