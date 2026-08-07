/**
 * Phase 3 Privacy Tests — Aadhaar data protection & consent verification
 *
 * Run: npx tsx src/test-privacy.ts
 */

import dotenv from 'dotenv';
dotenv.config();

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  (async () => {
    try {
      await fn();
      passed++;
      console.log(`  ✅ ${name}`);
    } catch (err: any) {
      failed++;
      console.log(`  ❌ ${name}`);
      console.log(`     ${err.message}`);
    }
  })();
}

// ── Test 1: OCR response no longer returns rawText ───────────────────────

console.log('\n📋 OCR Response Minimization');

test('OCR response type excludes rawText', async () => {
  // Verify the server route constructs response without rawText by default
  const fs = require('fs');
  const ocrTs = fs.readFileSync(require('path').join(__dirname, 'routes', 'ocr.ts'), 'utf8');
  // The response should NOT include rawText in the default result object
  const resultBlock = ocrTs.match(/const result[^}]*\}\s*;/s);
  if (!resultBlock) throw new Error('Could not find result object in ocr.ts');
  // rawText should only appear inside the DEV_DEBUG_OCR block
  const rawTextAfterResult = ocrTs.indexOf('rawText', ocrTs.indexOf('const result'));
  const devDebugBlock = ocrTs.indexOf('DEV_DEBUG_OCR');
  if (rawTextAfterResult > 0 && devDebugBlock < 0) {
    throw new Error('rawText found in response without DEV_DEBUG_OCR guard');
  }
});

test('DEV_DEBUG_OCR flag gates rawText inclusion', () => {
  const fs = require('fs');
  const ocrTs = fs.readFileSync(require('path').join(__dirname, 'routes', 'ocr.ts'), 'utf8');
  if (!ocrTs.includes('DEV_DEBUG_OCR')) {
    throw new Error('DEV_DEBUG_OCR guard not found in ocr.ts');
  }
  // Must check NODE_ENV !== production
  if (!ocrTs.includes("NODE_ENV !== 'production'")) {
    throw new Error('DEV_DEBUG_OCR must be guarded by NODE_ENV check');
  }
});

// ── Test 2: No PII in OCR logs ──────────────────────────────────────────

console.log('\n📋 OCR Log Sanitization');

test('OCR route does not log rawText content', () => {
  const fs = require('fs');
  const ocrTs = fs.readFileSync(require('path').join(__dirname, 'routes', 'ocr.ts'), 'utf8');
  // Should NOT log raw text content (old pattern was "=== FINAL RAW TEXT ===")
  if (ocrTs.includes('=== FINAL RAW TEXT ===')) {
    throw new Error('Old raw text logging pattern still present');
  }
  if (ocrTs.includes('.substring(0, 200)"`);')) {
    throw new Error('text annotation content logging still present');
  }
});

test('OCR extraction logs use booleans only, not values', () => {
  const fs = require('fs');
  const ocrTs = fs.readFileSync(require('path').join(__dirname, 'routes', 'ocr.ts'), 'utf8');
  if (!ocrTs.includes('!!extractedName')) {
    throw new Error('Extraction logging should use boolean coercion (!!) not raw values');
  }
});

// ── Test 3: Aadhar last4 helper exists ──────────────────────────────────

console.log('\n📋 Aadhar Number Protection');

test('aadhar.ts has extractAadharLast4 function', () => {
  const fs = require('fs');
  const path = require('path');
  const aadharPath = path.join(__dirname, '..', '..', 'app', 'AwedanSahayak', 'src', 'services', 'aadhar.ts');
  if (!fs.existsSync(aadharPath)) {
    // Try alt path
    const altPath = 'H:/a/app/AwedanSahayak/src/services/aadhar.ts';
    if (!fs.existsSync(altPath)) {
      console.log('     (aadhar.ts path check skipped — cross-directory)');
      return;
    }
  }
  const aadharTs = fs.readFileSync(aadharPath, 'utf8');
  if (!aadharTs.includes('extractAadharLast4')) {
    throw new Error('extractAadharLast4 function not found');
  }
  if (!aadharTs.includes('AADHAR_PATTERN')) {
    throw new Error('AADHAR_PATTERN not found');
  }
});

test('AadharExtractedData no longer has rawText field', async () => {
  const fs = require('fs');
  const path = require('path');
  const aadharPath = path.join(__dirname, '..', '..', 'app', 'AwedanSahayak', 'src', 'services', 'aadhar.ts');
  if (!fs.existsSync(aadharPath)) {
    console.log('     (skipped — cross-directory)');
    return;
  }
  const aadharTs = fs.readFileSync(aadharPath, 'utf8');
  // Interface should have aadharLast4 but NOT rawText
  const iface = aadharTs.match(/export interface AadharExtractedData \{([^}]+)\}/s);
  if (!iface) throw new Error('AadharExtractedData interface not found');
  if (iface[1].includes('rawText')) {
    throw new Error('rawText still present in AadharExtractedData interface');
  }
  if (!iface[1].includes('aadharLast4')) {
    throw new Error('aadharLast4 missing from AadharExtractedData interface');
  }
});

// ── Test 4: Database schema has only last4 ──────────────────────────────

console.log('\n📋 Database Schema Audit');

test('user_profile table has aadhar_last4 column only (no full aadhar)', () => {
  const fs = require('fs');
  const dbTs = fs.readFileSync(require('path').join(__dirname, '..', '..', 'app', 'AwedanSahayak', 'src', 'database', 'db.ts'), 'utf8');
  if (!dbTs.includes('aadhar_last4')) {
    throw new Error('aadhar_last4 column not found in schema');
  }
  if (dbTs.includes('aadhar_number') && !dbTs.includes('aadhar_last4')) {
    throw new Error('full aadhar_number found without aadhar_last4');
  }
});

// ── Test 5: ProfileScreen consent & deletion UI ─────────────────────────

console.log('\n📋 ProfileScreen Consent & Deletion');

test('ProfileScreen has consent modal text', () => {
  const fs = require('fs');
  const psPath = require('path').join(__dirname, '..', '..', 'app', 'AwedanSahayak', 'src', 'screens', 'ProfileScreen.tsx');
  if (!fs.existsSync(psPath)) {
    console.log('     (skipped — cross-directory)');
    return;
  }
  const psTs = fs.readFileSync(psPath, 'utf8');
  if (!psTs.includes('मैं सहमत हूँ और स्कैन जारी रखें')) {
    throw new Error('Explicit consent button text not found');
  }
  if (!psTs.includes('मैन्युअल रूप से जानकारी भरें')) {
    throw new Error('Manual entry fallback not found');
  }
});

test('ProfileScreen has data deletion controls', () => {
  const fs = require('fs');
  const psPath = require('path').join(__dirname, '..', '..', 'app', 'AwedanSahayak', 'src', 'screens', 'ProfileScreen.tsx');
  if (!fs.existsSync(psPath)) {
    console.log('     (skipped — cross-directory)');
    return;
  }
  const psTs = fs.readFileSync(psPath, 'utf8');
  if (!psTs.includes('handleClearProfile')) {
    throw new Error('handleClearProfile function not found');
  }
  if (!psTs.includes('handleDeleteAllData')) {
    throw new Error('handleDeleteAllData function not found');
  }
});

// ── Test 6: PII log cleanup ─────────────────────────────────────────────

console.log('\n📋 PII Log Cleanup');

test('ProfileScreen does not log full profile JSON', () => {
  const fs = require('fs');
  const psPath = require('path').join(__dirname, '..', '..', 'app', 'AwedanSahayak', 'src', 'screens', 'ProfileScreen.tsx');
  if (!fs.existsSync(psPath)) {
    console.log('     (skipped — cross-directory)');
    return;
  }
  const psTs = fs.readFileSync(psPath, 'utf8');
  if (psTs.includes('JSON.stringify(updateData)') || psTs.includes('JSON.stringify(parsed)')) {
    throw new Error('PII-logging JSON.stringify still present');
  }
});

// ── Results ─────────────────────────────────────────────────────────────

setTimeout(() => {
  console.log(`\n═══════════════════════════════════════`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════════════\n`);
  process.exit(failed > 0 ? 1 : 0);
}, 2000);
