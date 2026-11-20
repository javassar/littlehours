import fs from 'fs';
import assert from 'assert';

console.log('--- Testing Locked App-Shell Layout (Fix iOS Top Blur) ---');

// 1. Check src/styles/base.css
const baseCss = fs.readFileSync('src/styles/base.css', 'utf8');

console.log('\n[Check 1] Verify html, body, #root viewport lock in base.css...');
assert(
  baseCss.includes('html, body, #root') || (baseCss.includes('html') && baseCss.includes('body') && baseCss.includes('#root')),
  'base.css must define html, body, and #root lock'
);
assert(baseCss.includes('height: 100dvh;'), 'base.css must include height: 100dvh;');
assert(baseCss.includes('overflow: hidden;'), 'base.css must include overflow: hidden;');
assert(baseCss.includes('background-color: #F6EDEA;'), 'base.css must set background-color: #F6EDEA;');
console.log('✓ html, body, #root locked to 100dvh, overflow: hidden, background-color: #F6EDEA.');

// 2. Check src/styles/layout.css for .app-wrapper, .app-main, and .pb-28
const layoutCss = fs.readFileSync('src/styles/layout.css', 'utf8');

console.log('\n[Check 2] Verify .app-wrapper flex-column layout...');
assert(layoutCss.includes('.app-wrapper'), 'layout.css must contain .app-wrapper');
assert(layoutCss.includes('height: 100dvh;'), '.app-wrapper must have height: 100dvh;');
assert(layoutCss.includes('overflow: hidden;'), '.app-wrapper must have overflow: hidden;');
assert(layoutCss.includes('display: flex;'), '.app-wrapper must have display: flex;');
assert(layoutCss.includes('flex-direction: column;'), '.app-wrapper must have flex-direction: column;');
console.log('✓ .app-wrapper verified: display flex column, height 100dvh, overflow hidden.');

console.log('\n[Check 3] Verify .app-main scroll container and .pb-28...');
assert(layoutCss.includes('.app-main'), 'layout.css must define .app-main');
assert(layoutCss.includes('overflow-y: auto;'), '.app-main must have overflow-y: auto;');
assert(layoutCss.includes('-webkit-overflow-scrolling: touch;'), '.app-main must have -webkit-overflow-scrolling: touch;');
assert(layoutCss.includes('flex: 1;'), '.app-main must have flex: 1;');
assert(layoutCss.includes('.pb-28'), 'layout.css must define .pb-28');
assert(layoutCss.includes('padding-bottom: 7rem;'), '.pb-28 must provide generous padding-bottom (7rem);');
console.log('✓ .app-main and .pb-28 verified: scrollable container with momentum touch scrolling and generous bottom padding.');

// 3. Check src/components/Header.css
const headerCss = fs.readFileSync('src/components/Header.css', 'utf8');

console.log('\n[Check 4] Verify Header flex child and positioning...');
assert(!headerCss.includes('position: sticky;'), 'Header must NOT have position: sticky;');
assert(!headerCss.includes('position: fixed;'), 'Header must NOT have position: fixed;');
assert(headerCss.includes('flex-shrink: 0;'), 'Header must have flex-shrink: 0;');
assert(headerCss.includes('background-color: #F6EDEA;'), 'Header must have solid #F6EDEA background-color;');
console.log('✓ Header verified: normal flex child with flex-shrink: 0, solid #F6EDEA background, no sticky/fixed positioning.');

// 4. Check src/App.tsx
const appTsx = fs.readFileSync('src/App.tsx', 'utf8');

console.log('\n[Check 5] Verify App.tsx component structure...');
assert(appTsx.includes('className="app-wrapper"'), 'App.tsx must wrap layout in .app-wrapper');
assert(appTsx.includes('className="app-main pb-28"'), 'App.tsx must render <main className="app-main pb-28">');
assert(appTsx.includes('overflowY: \'auto\''), 'App.tsx main element must have overflowY: auto');
assert(appTsx.includes('WebkitOverflowScrolling: \'touch\''), 'App.tsx main element must have WebkitOverflowScrolling: touch');
console.log('✓ App.tsx verified: wraps in .app-wrapper, <main> configured as scrollable container with .pb-28.');

console.log('\n--- All locked app-shell checks passed successfully! ---');
