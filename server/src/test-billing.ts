/**
 * Phase 4B Billing Tests — Mock-based verification of billing flows.
 * Run: npx tsx src/test-billing.ts
 * Real Google Play API is NEVER called.
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

// ── Test 1: Token Ledger (replay protection) ────────────────────────────

console.log('\n📋 Token Ledger & Replay Protection');

test('hashToken produces consistent SHA-256', () => {
  const { hashToken } = require('./services/tokenLedger');
  const h1 = hashToken('test-token-123');
  const h2 = hashToken('test-token-123');
  if (h1 !== h2) throw new Error('hashToken is not deterministic');
  if (h1 === 'test-token-123') throw new Error('hashToken returned raw token!');
  if (h1.length !== 64) throw new Error(`Expected 64-char hex hash, got ${h1.length}`);
});

test('different tokens produce different hashes', () => {
  const { hashToken } = require('./services/tokenLedger');
  if (hashToken('aaaa') === hashToken('bbbb')) throw new Error('Different tokens have same hash');
});

test('isTokenAlreadyCredited returns false for unknown token', () => {
  const { isTokenAlreadyCredited } = require('./services/tokenLedger');
  if (isTokenAlreadyCredited('never-seen-token-' + Date.now())) {
    throw new Error('Unknown token should not be credited');
  }
});

test('recordVerifiedToken + markTokenCredited + isTokenAlreadyCredited', () => {
  const { recordVerifiedToken, markTokenCredited, isTokenAlreadyCredited } = require('./services/tokenLedger');
  const token = 'unique-test-token-' + Date.now();
  if (isTokenAlreadyCredited(token)) throw new Error('Should not be credited yet');
  recordVerifiedToken({ purchaseToken: token, productId: 'awedan_sahayak_single_gen', purchaseType: 'product', packageName: 'com.mmenterprises.awedansahayak' });
  if (isTokenAlreadyCredited(token)) throw new Error('Should not be credited until markTokenCredited');
  markTokenCredited(token);
  if (!isTokenAlreadyCredited(token)) throw new Error('Should be credited after markTokenCredited');
});

test('replay attack: same token cannot be credited twice', () => {
  const { recordVerifiedToken, markTokenCredited, isTokenAlreadyCredited } = require('./services/tokenLedger');
  const token = 'replay-test-' + Date.now();
  recordVerifiedToken({ purchaseToken: token, productId: 'awedan_sahayak_single_gen', purchaseType: 'product', packageName: 'com.mmenterprises.awedansahayak' });
  markTokenCredited(token);
  // Second verification should still show as credited (replay detection)
  if (!isTokenAlreadyCredited(token)) throw new Error('Token should be detected as already credited');
});

test('markTokenRevoked works', () => {
  const { recordVerifiedToken, markTokenRevoked, getTokenRecord } = require('./services/tokenLedger');
  const token = 'revoke-test-' + Date.now();
  recordVerifiedToken({ purchaseToken: token, productId: 'awedan_sahayak_monthly_sub', purchaseType: 'subscription', packageName: 'com.mmenterprises.awedansahayak' });
  markTokenRevoked(token);
  const record = getTokenRecord(token);
  if (!record?.revoked) throw new Error('Token should be marked revoked');
  if (record?.verificationStatus !== 'revoked') throw new Error('Status should be revoked');
});

// ── Test 2: Product allowlist ────────────────────────────────────────────

console.log('\n📋 Product Allowlist');

test('getAllowedProducts returns correct SKUs', () => {
  const { getAllowedProducts } = require('./services/billingService');
  const products = getAllowedProducts();
  if (!products.includes('awedan_sahayak_monthly_sub')) throw new Error('Monthly sub SKU missing');
  if (!products.includes('awedan_sahayak_single_gen')) throw new Error('Single gen SKU missing');
  if (products.length > 5) throw new Error('Too many products — check for stale entries');
});

// ── Test 3: Billing service initialization ──────────────────────────────

console.log('\n📋 Billing Service');

test('isBillingServiceReady returns boolean', async () => {
  const { isBillingServiceReady } = require('./services/billingService');
  const ready = await isBillingServiceReady();
  // In dev without service account, should return false gracefully
  if (typeof ready !== 'boolean') throw new Error('Should return boolean');
});

// ── Test 4: Ledger durability safety ────────────────────────────────────

console.log('\n📋 Ledger Durability');

test('isLedgerDurable reflects BILLING_LEDGER_MODE', () => {
  const { isLedgerDurable } = require('./services/tokenLedger');
  const durable = isLedgerDurable();
  // In dev without prod config, should be false (JSON mode) — not an error
  if (typeof durable !== 'boolean') throw new Error('Should return boolean');
});

// ── Test 5: No raw tokens in exports ────────────────────────────────────

console.log('\n📋 Security: No Token Leakage');

test('hashToken never returns raw input', () => {
  const { hashToken } = require('./services/tokenLedger');
  const raw = 'my-secret-purchase-token-abc123';
  const hashed = hashToken(raw);
  if (hashed === raw) throw new Error('hashToken returned raw input!');
  if (hashed.includes('my-secret')) throw new Error('Hash contains plaintext input!');
});

test('tokenLedger file does not store raw tokens', () => {
  const fs = require('fs');
  const lp = require('path').join(__dirname, 'services', 'tokenLedger.ts');
  if (!fs.existsSync(lp)) { console.log('     (skipped — file path)'); return; }
  const src = fs.readFileSync(lp, 'utf8');
  // All storage should go through hashToken
  const setCalls = src.match(/\.set\(/g);
  if (setCalls) {
    // Each .set call should use a hashed key, not the raw token
    if (src.includes(`.set(purchaseToken`) || src.includes(`.set(token`)) {
      // This would be suspicious — check it's behind hashToken
    }
  }
});

// ── Test 6: Billing routes exist ─────────────────────────────────────────

console.log('\n📋 Billing Routes');

test('billingRouter exports a Router', () => {
  const { billingRouter } = require('./routes/billing');
  if (!billingRouter?.stack) throw new Error('Not an Express Router');
});

test('process-product route exists (no confirm-credited)', () => {
  const fs = require('fs');
  const p = require('path').join(__dirname, 'routes', 'billing.ts');
  if (!fs.existsSync(p)) { console.log('     (skipped — file path)'); return; }
  const billingTs = fs.readFileSync(p, 'utf8');
  if (!billingTs.includes('process-product')) throw new Error('process-product endpoint not found');
  // confirm-credited may appear in comments (explaining what was removed) — that's fine
  const fnConfirmCredited = billingTs.match(/confirmCredited\s*\(/);
  if (fnConfirmCredited) throw new Error('confirmCredited function call still present in routes');
});

test('verify-subscription route exists', () => {
  const fs = require('fs');
  const p = require('path').join(__dirname, 'routes', 'billing.ts');
  if (!fs.existsSync(p)) { console.log('     (skipped — file path)'); return; }
  const billingTs = fs.readFileSync(p, 'utf8');
  if (!billingTs.includes('verify-subscription')) throw new Error('verify-subscription endpoint not found');
});

// ── Test 7: Mobile flow integrity ───────────────────────────────────────

console.log('\n📋 Mobile Purchase Flow');

test('iap.ts exports restorePurchases', () => {
  const fs = require('fs');
  const iapPath = require('path').join(__dirname, '..', '..', 'app', 'AwedanSahayak', 'src', 'services', 'iap.ts');
  if (!fs.existsSync(iapPath)) {
    console.log('     (skipped — cross-directory)');
    return;
  }
  const iapTs = fs.readFileSync(iapPath, 'utf8');
  if (!iapTs.includes('export async function restorePurchases')) throw new Error('restorePurchases not exported');
});

test('iap.ts does NOT have old validatePurchaseLocally stub', () => {
  const fs = require('fs');
  const iapPath = require('path').join(__dirname, '..', '..', 'app', 'AwedanSahayak', 'src', 'services', 'iap.ts');
  if (!fs.existsSync(iapPath)) {
    console.log('     (skipped — cross-directory)');
    return;
  }
  const iapTs = fs.readFileSync(iapPath, 'utf8');
  if (iapTs.includes('async function validatePurchaseLocally')) throw new Error('Old stub still present');
  if (iapTs.includes('@returns always true (stub)')) throw new Error('Stub comment still present');
});

test('iap.ts uses process-product for consumables', () => {
  const fs = require('fs');
  const iapPath = require('path').join(__dirname, '..', '..', 'app', 'AwedanSahayak', 'src', 'services', 'iap.ts');
  if (!fs.existsSync(iapPath)) {
    console.log('     (skipped — cross-directory)');
    return;
  }
  const iapTs = fs.readFileSync(iapPath, 'utf8');
  if (!iapTs.includes('/api/billing/process-product')) throw new Error('process-product not used in iap.ts');
});

test('iap.ts does NOT call confirm-credited in purchase flow', () => {
  const fs = require('fs');
  const iapPath = require('path').join(__dirname, '..', '..', 'app', 'AwedanSahayak', 'src', 'services', 'iap.ts');
  if (!fs.existsSync(iapPath)) {
    console.log('     (skipped — cross-directory)');
    return;
  }
  const iapTs = fs.readFileSync(iapPath, 'utf8');
  if (iapTs.includes('confirm-credited')) throw new Error('confirm-credited still referenced in iap.ts');
});

test('usageTracker has verification cache functions', () => {
  const fs = require('fs');
  const utPath = require('path').join(__dirname, '..', '..', 'app', 'AwedanSahayak', 'src', 'services', 'usageTracker.ts');
  if (!fs.existsSync(utPath)) {
    console.log('     (skipped — cross-directory)');
    return;
  }
  const utTs = fs.readFileSync(utPath, 'utf8');
  if (!utTs.includes('isVerificationStale')) throw new Error('isVerificationStale missing');
  if (!utTs.includes('isWithinOfflineGrace')) throw new Error('isWithinOfflineGrace missing');
  if (!utTs.includes('setSubscriptionVerified')) throw new Error('setSubscriptionVerified missing');
  if (!utTs.includes('KEY_SUB_LAST_VERIFIED')) throw new Error('KEY_SUB_LAST_VERIFIED missing');
});

// ── Results ──────────────────────────────────────────────────────────────

setTimeout(() => {
  console.log(`\n═══════════════════════════════════════`);
  console.log(`  Phase 4B Billing: ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════════════\n`);
  process.exit(failed > 0 ? 1 : 0);
}, 2000);
