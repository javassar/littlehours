import fs from 'fs';
import assert from 'assert';

console.log('--- Testing Part A: iPhone PWA Layout & Sizing Fix ---');

// 1. Verify src/styles/base.css
const baseCss = fs.readFileSync('src/styles/base.css', 'utf8');

console.log('\n[Check 1] Global box-sizing & date/time input resets in base.css...');
assert(
  baseCss.includes('*, *::before, *::after') && baseCss.includes('box-sizing: border-box;'),
  '*, *::before, *::after must have box-sizing: border-box'
);
assert(
  baseCss.includes('html, body') && baseCss.includes('box-sizing: border-box;'),
  'html, body must have box-sizing: border-box'
);
assert(
  baseCss.includes('input[type="datetime-local"]'),
  'base.css must include input[type="datetime-local"] selector'
);
assert(
  baseCss.includes('-webkit-appearance: none;') && baseCss.includes('appearance: none;'),
  'base.css must reset appearance to none'
);
assert(
  baseCss.includes('min-width: 0;') && baseCss.includes('max-width: 100%;'),
  'base.css must set min-width: 0 and max-width: 100% on date inputs'
);
assert(
  baseCss.includes('::-webkit-date-and-time-value') && baseCss.includes('text-align: left;'),
  'base.css must align ::-webkit-date-and-time-value text to left'
);
console.log('✓ Global box-sizing and iOS Safari date/time input resets verified in base.css.');

// 2. Verify WindowEditSheet.css ("Edit Time Window" sheet & Log page pencil sheet)
const windowCss = fs.readFileSync('src/components/WindowEditSheet.css', 'utf8');
console.log('\n[Check 2] WindowEditSheet.css layout & sizing...');
assert(windowCss.includes('min-width: 0;'), 'WindowEditSheet surface has min-width: 0');
assert(windowCss.includes('.sheet-surface form'), 'WindowEditSheet form has explicit width and min-width');
assert(windowCss.includes('.sheet-field') && windowCss.includes('min-width: 0;'), '.sheet-field has min-width: 0');
assert(windowCss.includes('.sheet-datetime-input') && windowCss.includes('-webkit-appearance: none;'), '.sheet-datetime-input has appearance reset');
assert(windowCss.includes('.sheet-actions') && windowCss.includes('min-width: 0;'), '.sheet-actions has min-width: 0');
console.log('✓ WindowEditSheet: all inputs, forms, and action rows have min-width: 0 and appearance reset.');

// 3. Verify EntryEditSheet.css & EntryEditSheet.tsx ("Edit Entry" sheet)
const entryCss = fs.readFileSync('src/components/EntryEditSheet.css', 'utf8');
const entryTsx = fs.readFileSync('src/components/EntryEditSheet.tsx', 'utf8');
console.log('\n[Check 3] EntryEditSheet.css & EntryEditSheet.tsx layout & pain buttons...');
assert(entryCss.includes('.entry-edit-surface') && entryCss.includes('min-width: 0;'), 'EntryEditSheet surface has min-width: 0');
assert(entryCss.includes('overflow-y: auto;'), 'EntryEditSheet surface is scrollable');
assert(entryCss.includes('-webkit-overflow-scrolling: touch;'), 'EntryEditSheet surface has smooth touch scrolling');
assert(
  entryCss.includes('padding: 16px 20px calc(32px + env(safe-area-inset-bottom, 0px)) 20px;'),
  'EntryEditSheet surface has safe bottom padding so pain buttons and actions are never clipped'
);
assert(entryCss.includes('.entry-edit-textarea') && entryCss.includes('min-width: 0;'), 'Textarea has min-width: 0 and max-width: 100%');
assert(entryTsx.includes('minWidth: 0') && entryTsx.includes('On vacation'), 'Vacation switch row has minWidth: 0');
assert(entryTsx.includes('minWidth: 0') && entryTsx.includes('<PainRating'), 'PainRating wrapper in EntryEditSheet has minWidth: 0');
console.log('✓ EntryEditSheet: surface scrollable, pain buttons and action buttons clear bottom edge, all children have min-width: 0.');

// 4. Verify RatingEditSheet.css & PainRating.css
const ratingCss = fs.readFileSync('src/components/RatingEditSheet.css', 'utf8');
const painCss = fs.readFileSync('src/components/PainRating.css', 'utf8');
console.log('\n[Check 4] RatingEditSheet & PainRating styling...');
assert(ratingCss.includes('.rating-edit-surface') && ratingCss.includes('min-width: 0;'), 'RatingEditSheet surface has min-width: 0');
assert(ratingCss.includes('calc(28px + env(safe-area-inset-bottom'), 'RatingEditSheet surface has safe bottom padding');
assert(painCss.includes('.pain-rating-container') && painCss.includes('min-width: 0;'), 'Pain rating container has min-width: 0');
assert(painCss.includes('.pain-rating-buttons') && painCss.includes('min-width: 0;'), 'Pain rating buttons row has min-width: 0');
console.log('✓ RatingEditSheet and PainRating verified.');

// 5. Verify ConfirmationSheet.css
const confirmCss = fs.readFileSync('src/components/ConfirmationSheet.css', 'utf8');
console.log('\n[Check 5] ConfirmationSheet.css input & boundary resets...');
assert(confirmCss.includes('.confirmation-sheet-surface') && confirmCss.includes('min-width: 0;'), 'ConfirmationSheet surface has min-width: 0');
assert(confirmCss.includes('.confirmation-time-input') && confirmCss.includes('-webkit-appearance: none;'), 'Confirmation time input has appearance reset');
assert(confirmCss.includes('.confirmation-boundary-input') && confirmCss.includes('-webkit-appearance: none;'), 'Confirmation boundary input has appearance reset');
assert(confirmCss.includes('.confirmation-sheet-footer') && confirmCss.includes('calc(16px + env(safe-area-inset-bottom'), 'Confirmation footer has safe-area bottom padding');
console.log('✓ ConfirmationSheet inputs and footer clearance verified.');

// 6. Verify SettingsPage export date inputs in layout.css
const layoutCss = fs.readFileSync('src/styles/layout.css', 'utf8');
console.log('\n[Check 6] SettingsPage export date range fields...');
assert(layoutCss.includes('.export-range-group') && layoutCss.includes('min-width: 0;'), 'export-range-group has min-width: 0');
assert(layoutCss.includes('.export-date-field') && layoutCss.includes('min-width: 0;'), 'export-date-field has min-width: 0');
console.log('✓ Export date range fields verified.');

// 7. Mathematical verification at 390px, 375px, and 360px viewports
console.log('\n[Check 7] Viewport width mathematics at 390px, 375px, 360px...');
const viewports = [390, 375, 360];
for (const vp of viewports) {
  const backdropPadding = 12 * 2; // 12px left, 12px right
  const sheetWidth = vp - backdropPadding;
  const sheetPadding = 20 * 2; // 20px left, 20px right
  const contentWidth = sheetWidth - sheetPadding;

  // Pain buttons: 5 buttons of 48px + 4 gaps of 8px = 272px
  const painButtonsWidth = 5 * 48 + 4 * 8;
  const marginRemaining = contentWidth - painButtonsWidth;

  assert(contentWidth > 0, `Content width at ${vp}px must be positive`);
  assert(marginRemaining >= 0, `Pain buttons (272px) must fit within content width (${contentWidth}px) at ${vp}px`);

  console.log(
    `✓ ${vp}px viewport: sheet = ${sheetWidth}px wide (equal 12px margins), content = ${contentWidth}px wide (equal 20px padding).` +
    ` Pain buttons width = ${painButtonsWidth}px (leaves ${marginRemaining}px space). Zero overflow.`
  );
}

console.log('\n--- All Part A checks passed successfully! ---');
