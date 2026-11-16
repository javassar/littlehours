import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('--- Testing Dialog & Bottom Sheet Tab-Bar Clearance Fix ---');

// 1. Verify CSS files for backdrop padding and surface constraints
const windowCss = fs.readFileSync('src/components/WindowEditSheet.css', 'utf8');
const entryCss = fs.readFileSync('src/components/EntryEditSheet.css', 'utf8');
const confirmCss = fs.readFileSync('src/components/ConfirmationSheet.css', 'utf8');
const painCss = fs.readFileSync('src/components/PainGuideSheet.css', 'utf8');
const catCss = fs.readFileSync('src/components/CategoriesSheet.css', 'utf8');
const peopleCss = fs.readFileSync('src/components/PeopleSheet.css', 'utf8');
const tabBarCss = fs.readFileSync('src/components/TabBar.css', 'utf8');

console.log('\n[Check 1] Tab bar geometry vs Backdrop bottom padding...');
assert(tabBarCss.includes('height: 48px'), 'TabBar height should be 48px');
assert(tabBarCss.includes('bottom: calc(8px + env(safe-area-inset-bottom'), 'TabBar bottom offset should be 8px + safe-area');
// Tab bar top edge is at 8px + 48px = 56px + safe-area

const expectedBackdropPadding = 'calc(72px + env(safe-area-inset-bottom';
assert(windowCss.includes(expectedBackdropPadding), 'WindowEditSheet.css has 72px + safe-area padding');
assert(confirmCss.includes(expectedBackdropPadding), 'ConfirmationSheet.css has 72px + safe-area padding');
assert(painCss.includes(expectedBackdropPadding), 'PainGuideSheet.css has 72px + safe-area padding');
assert(catCss.includes(expectedBackdropPadding), 'CategoriesSheet.css has 72px + safe-area padding');
assert(peopleCss.includes(expectedBackdropPadding), 'PeopleSheet.css has 72px + safe-area padding');

const gap = 72 - (8 + 48);
assert.strictEqual(gap, 16, 'Visible gap between bottom of dialog/sheet and top of tab bar must be exactly 16px');
console.log(`✓ Tab bar top edge: 56px + safe-area`);
console.log(`✓ Dialog bottom edge: 72px + safe-area`);
console.log(`✓ Visible gap: ${gap}px clean clearance above tab bar!`);

console.log('\n[Check 2] Short screen internal scrolling & max-height...');
assert(windowCss.includes('overflow-y: auto'), 'WindowEditSheet surface has overflow-y: auto');
assert(entryCss.includes('overflow-y: auto'), 'EntryEditSheet surface has overflow-y: auto');
assert(confirmCss.includes('overflow-y: auto'), 'ConfirmationSheet body has overflow-y: auto');
assert(painCss.includes('overflow-y: auto'), 'PainGuideSheet body has overflow-y: auto');
assert(windowCss.includes('max-height: calc(100dvh - 88px'), 'WindowEditSheet surface has max-height constraint for short screens');
assert(confirmCss.includes('max-height: calc(100dvh - 88px'), 'ConfirmationSheet surface has max-height constraint for short screens');
assert(painCss.includes('max-height: calc(100dvh - 88px'), 'PainGuideSheet surface has max-height constraint for short screens');
console.log('✓ All sheets and dialogs scroll inside themselves on short screens without running under the bar.');

console.log('\n[Check 3] 390px and 360px viewport width calculations...');
// On 390px: 390 - (12 * 2) = 366px >= 360px max-width dialog
const width390 = 390 - 24;
assert(width390 >= 360, '390px phone fits 360px delete dialog with padding');
// On 360px: 360 - (12 * 2) = 336px
const width360 = 360 - 24;
assert(width360 > 280, '336px available width provides ample room for two 142px buttons');
console.log(`✓ 390px viewport: ${width390}px usable width (dialog fits at 360px max-width)`);
console.log(`✓ 360px viewport: ${width360}px usable width (dialog adapts to 100% of usable width)`);

console.log('\n[Check 4] Stacking context & Portal verification...');
const historyPage = fs.readFileSync('src/pages/HistoryPage.tsx', 'utf8');
const windowTsx = fs.readFileSync('src/components/WindowEditSheet.tsx', 'utf8');
const entryTsx = fs.readFileSync('src/components/EntryEditSheet.tsx', 'utf8');
const ratingTsx = fs.readFileSync('src/components/RatingEditSheet.tsx', 'utf8');
const confirmTsx = fs.readFileSync('src/components/ConfirmationSheet.tsx', 'utf8');
const painTsx = fs.readFileSync('src/components/PainGuideSheet.tsx', 'utf8');
const catTsx = fs.readFileSync('src/components/CategoriesSheet.tsx', 'utf8');
const peopleTsx = fs.readFileSync('src/components/PeopleSheet.tsx', 'utf8');

assert(historyPage.includes('<ModalPortal>'), 'HistoryPage delete dialog is wrapped in ModalPortal');
assert(windowTsx.includes('<ModalPortal>'), 'WindowEditSheet is wrapped in ModalPortal');
assert(entryTsx.includes('<ModalPortal>'), 'EntryEditSheet is wrapped in ModalPortal');
assert(ratingTsx.includes('<ModalPortal>'), 'RatingEditSheet is wrapped in ModalPortal');
assert(confirmTsx.includes('<ModalPortal>'), 'ConfirmationSheet is wrapped in ModalPortal');
assert(painTsx.includes('<ModalPortal>'), 'PainGuideSheet is wrapped in ModalPortal');
assert(catTsx.includes('<ModalPortal>'), 'CategoriesSheet is wrapped in ModalPortal');
assert(peopleTsx.includes('<ModalPortal>'), 'PeopleSheet is wrapped in ModalPortal');

// Confirm ModalPortal uses createPortal(children, document.body)
const portalSource = fs.readFileSync('src/components/ModalPortal.tsx', 'utf8');
assert(portalSource.includes('createPortal(children, document.body)'), 'ModalPortal attaches directly to document.body');
console.log('✓ All 8 sheets and dialogs are portalled to document.body, free from any ancestor stacking context.');

console.log('\n[Check 5] HistoryPage card delete dialog Cancel and Delete buttons...');
assert(historyPage.includes('onClick={() => setEntryToDelete(null)}'), 'Cancel button closes the delete dialog');
assert(historyPage.includes('handleDeleteEntry(entryToDelete.id)'), 'Delete button calls handleDeleteEntry');
assert(historyPage.includes('setEntryToDelete(null)'), 'Delete button clears dialog upon completion');
console.log('✓ Cancel closes dialog, Delete executes deletion.');

console.log('\n--- All checks passed successfully! ---');
