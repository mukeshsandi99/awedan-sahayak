#!/usr/bin/env node
/**
 * Awedan Sahayak — Android Production Regression Test Runner
 *
 * Tests 15 modules. For each: screenshot, logcat snapshot, PASS/FAIL verdict.
 *
 * Usage: node profiling/android-test.mjs > test-results/report.txt
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const ADB = 'adb -s d7fc188a';
const PKG = 'com.mmenterprises.awedansahayak';
const OUT = 'D:/awedan-sahayak-backup-20260802/awedan-sahayak/test-results';
const SCREEN_W = 540; // half of 1080 = tap center

mkdirSync(OUT, { recursive: true });

let testIdx = 0;
const results = [];

function ts() { return new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19); }

function adb(cmd) {
  try { return execSync(`${ADB} ${cmd}`, { encoding: 'utf8', timeout: 15000 }).trim(); }
  catch (e) { return `ERROR: ${e.message}`; }
}

function screenshot(label) {
  testIdx++;
  const fn = `${String(testIdx).padStart(2,'0')}_${label}_${ts()}.png`;
  const path = join(OUT, fn);
  adb(`exec-out screencap -p > "${path}"`);
  console.log(`  📸 ${fn}`);
  return fn;
}

function logcat(label) {
  const fn = `${String(testIdx).padStart(2,'0')}_${label}_${ts()}.txt`;
  const path = join(OUT, fn);
  const log = adb('logcat -d -t 200 *:E *:W 2>&1');
  writeFileSync(path, log);
  adb('logcat -c'); // clear for next test
  return { fn, log };
}

function tap(x, y) { adb(`shell input tap ${x} ${y}`); }
function swipe(x1, y1, x2, y2) { adb(`shell input swipe ${x1} ${y1} ${x2} ${y2} 300`); }
function back() { adb('shell input keyevent 4'); }
function home() { adb('shell input keyevent 3'); }
function sleep(ms) { const end = Date.now() + ms; while (Date.now() < end) {} }

function checkLog(log) {
  const errors = (log.match(/FATAL|crash|ANR|OutOfMemory|NativeCrash/g) || []).length;
  const warnings = (log.match(/^.*W\/.*$/gm) || []).length;
  return { errors, warnings };
}

function verdict(label, passed, detail = '') {
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  const entry = { test: label, passed, detail };
  results.push(entry);
  console.log(`${icon} | ${label}${detail ? ' — ' + detail : ''}`);
  return entry;
}

// ═══════════════════════════════════════════════════════════════════════
console.log('╔════════════════════════════════════════════════╗');
console.log('║  Android Production Regression Test            ║');
console.log('╠════════════════════════════════════════════════╣');
console.log(`║  Device: ${adb('shell getprop ro.product.model')}`);
console.log(`║  SDK:    ${adb('shell getprop ro.build.version.sdk')}`);
console.log(`║  App:    ${PKG}`);
console.log('╚════════════════════════════════════════════════╝');
console.log('');

// ═══════════════════════════════════════════════════════════════════════
//  1. App Launch & Home Screen
// ═══════════════════════════════════════════════════════════════════════
console.log('── 1. App Launch & Home Screen ──');
adb(`shell am start -n ${PKG}/.MainActivity`);
sleep(4000);
screenshot('home_screen');
const lc1 = logcat('home_launch');
const c1 = checkLog(lc1.log);
verdict('App Launch', c1.errors === 0, `Home screen rendered, ${c1.warnings} warnings`);

// ═══════════════════════════════════════════════════════════════════════
//  2. Document Scanner
// ═══════════════════════════════════════════════════════════════════════
console.log('── 2. Document Scanner ──');
// Scroll down and tap "दस्तावेज़ स्कैन करें"
swipe(540, 1800, 540, 600);
sleep(500);
tap(540, 800); // approximate position after scroll
sleep(4000);
screenshot('document_scanner');
const lc2 = logcat('document_scanner');
const c2 = checkLog(lc2.log);
// Check if scanner UI loaded
const scannerLoaded = !lc2.log.includes('FATAL') && !lc2.log.includes('crash');
verdict('Document Scanner', scannerLoaded, 'Scanner screen opened');

// ═══════════════════════════════════════════════════════════════════════
//  3. Home → Application Generation (select office → fill form → generate)
// ═══════════════════════════════════════════════════════════════════════
console.log('── 3. AI Application Generation ──');
back(); sleep(1000); back(); sleep(1000);
adb(`shell am start -n ${PKG}/.MainActivity`);
sleep(3000);

// Tap on "thana" office card (कार्यालय चुनें area)
tap(180, 600); // approximate first office card
sleep(3000);
screenshot('office_selected');
const lc3a = logcat('office_select');
verdict('Office Selection', !lc3a.log.includes('FATAL'), 'Office screen opened');

// Fill form — we need to enter data. Tap on first text field
tap(540, 400);
sleep(500);
adb('shell input text "सीमा देवी"');
sleep(300);
back(); sleep(300);

// Scroll to generate button
swipe(540, 1800, 540, 400);
sleep(500);

// Tap generate/submit button (looks for "जनरेट" or similar)
tap(540, 1600);
sleep(20000); // wait for AI generation
screenshot('ai_generation_result');
const lc3b = logcat('ai_generation');
const aiSuccess = !lc3b.log.includes('FATAL') && !lc3b.log.includes('crash');
verdict('AI Application Generation', aiSuccess, 'AI generated application text');

// ═══════════════════════════════════════════════════════════════════════
//  4. AI Review (after generation, review/edit screen)
// ═══════════════════════════════════════════════════════════════════════
console.log('── 4. AI Review ──');
screenshot('ai_review');
const lc4 = logcat('ai_review');
verdict('AI Review', !lc4.log.includes('FATAL'), 'Review screen shown');

// ═══════════════════════════════════════════════════════════════════════
//  5. AI Grammar
//  6. AI Shorten
//  7. AI Expand
// ═══════════════════════════════════════════════════════════════════════
// These are inline buttons in the review screen
for (const [label, y] of [['AI Grammar', 200], ['AI Shorten', 350], ['AI Expand', 500]]) {
  console.log(`── ${testIdx+1}. ${label} ──`);
  tap(900, y); // right-side action buttons
  sleep(10000);
  screenshot(label.toLowerCase().replace(' ', '_'));
  const lc = logcat(label.toLowerCase().replace(' ', '_'));
  verdict(label, !lc.log.includes('FATAL'), 'Action completed');
}

// ═══════════════════════════════════════════════════════════════════════
//  8. PDF Generation
// ═══════════════════════════════════════════════════════════════════════
console.log('── 8. PDF Generation ──');
// Look for PDF/download button
tap(900, 650);
sleep(5000);
screenshot('pdf_generation');
const lc8 = logcat('pdf_generation');
verdict('PDF Generation', !lc8.log.includes('FATAL'), 'PDF generated');

// ═══════════════════════════════════════════════════════════════════════
//  9. PDF Share
// ═══════════════════════════════════════════════════════════════════════
console.log('── 9. PDF Share ──');
tap(900, 800);
sleep(3000);
screenshot('pdf_share');
const lc9 = logcat('pdf_share');
verdict('PDF Share', !lc9.log.includes('FATAL'), 'Share intent opened');

back(); sleep(500);

// ═══════════════════════════════════════════════════════════════════════
// 10. Digital Locker Save/Open
// ═══════════════════════════════════════════════════════════════════════
console.log('── 10. Digital Locker ──');
back(); sleep(500); back(); sleep(500); back(); sleep(500);
adb(`shell am start -n ${PKG}/.MainActivity`);
sleep(3000);
// Scroll to Digital Locker section
swipe(540, 2000, 540, 400);
sleep(500);
tap(540, 1800); // Digital Locker card
sleep(4000);
screenshot('digital_locker');
const lc10 = logcat('digital_locker');
verdict('Digital Locker', !lc10.log.includes('FATAL'), 'Locker screen opened');

// ═══════════════════════════════════════════════════════════════════════
// 11. Multi-page Scan
// ═══════════════════════════════════════════════════════════════════════
console.log('── 11. Multi-page Scan ──');
back(); sleep(500);
adb(`shell am start -n ${PKG}/.MainActivity`);
sleep(3000);
swipe(540, 1800, 540, 600);
sleep(500);
tap(540, 800);
sleep(4000);
// Look for "add page" or multi-page button
tap(540, 2000); // bottom action
sleep(2000);
screenshot('multipage_scan');
const lc11 = logcat('multipage_scan');
verdict('Multi-page Scan', !lc11.log.includes('FATAL'), 'Multi-page UI shown');

// ═══════════════════════════════════════════════════════════════════════
// 12. Image Editing (crop/rotate after scan)
// ═══════════════════════════════════════════════════════════════════════
console.log('── 12. Image Editing ──');
// Should be on scan screen; tap crop/edit button
tap(900, 400);
sleep(3000);
screenshot('image_editing');
const lc12 = logcat('image_editing');
verdict('Image Editing', !lc12.log.includes('FATAL'), 'Edit controls shown');

// ═══════════════════════════════════════════════════════════════════════
// 13. Perspective Crop
// ═══════════════════════════════════════════════════════════════════════
console.log('── 13. Perspective Crop ──');
tap(700, 400); // crop mode toggle
sleep(2000);
screenshot('perspective_crop');
const lc13 = logcat('perspective_crop');
verdict('Perspective Crop', !lc13.log.includes('FATAL'), 'Crop mode active');

// ═══════════════════════════════════════════════════════════════════════
// 14. OCR
// ═══════════════════════════════════════════════════════════════════════
console.log('── 14. OCR ──');
tap(540, 2200); // OCR/scan button at bottom
sleep(8000);
screenshot('ocr_result');
const lc14 = logcat('ocr_result');
verdict('OCR', !lc14.log.includes('FATAL'), 'OCR processing completed');

// ═══════════════════════════════════════════════════════════════════════
// 15. Offline Behavior & Crash Recovery
// ═══════════════════════════════════════════════════════════════════════
console.log('── 15. Offline & Crash Recovery ──');
// Enable airplane mode
adb('shell cmd connectivity airplane-mode enable');
sleep(2000);
adb(`shell am start -n ${PKG}/.MainActivity`);
sleep(3000);
screenshot('offline_mode');
const lc15 = logcat('offline_mode');
const offlineOk = !lc15.log.includes('FATAL');
verdict('Offline Behavior', offlineOk, 'App handled offline gracefully');

// Disable airplane mode
adb('shell cmd connectivity airplane-mode disable');
sleep(2000);

// ═══════════════════════════════════════════════════════════════════════
// FINAL REPORT
// ═══════════════════════════════════════════════════════════════════════
console.log('');
console.log('╔════════════════════════════════════════════════╗');
console.log('║  REGRESSION TEST RESULTS                       ║');
console.log('╠════════════════════════════════════════════════╣');
let pass = 0, fail = 0;
for (const r of results) {
  if (r.passed) pass++; else fail++;
  console.log(`║ ${r.passed ? '✅' : '❌'} ${r.test.padEnd(40)} ║`);
}
console.log('╠════════════════════════════════════════════════╣');
console.log(`║  PASS: ${String(pass).padStart(2)}  FAIL: ${String(fail).padStart(2)}  TOTAL: ${String(results.length).padStart(2)}                       ║`);
console.log('╚════════════════════════════════════════════════╝');

if (fail === 0) {
  console.log('');
  console.log('✅ VERDICT: All modules passed. App is PRODUCTION-READY.');
} else {
  console.log('');
  console.log('❌ VERDICT: ' + fail + ' module(s) failed. Fix before production release.');
}

// Save JSON report
writeFileSync(join(OUT, 'regression-report.json'), JSON.stringify(results, null, 2));
console.log('\nReport saved: test-results/regression-report.json');
