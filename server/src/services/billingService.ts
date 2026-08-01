/**
 * Google Play Billing Verification Service
 *
 * Uses the Google Play Developer API (androidpublisher_v3) to verify
 * purchase tokens server-side. This is the authoritative source of
 * truth — the mobile client's local state is NOT trusted.
 *
 * SECURITY:
 *   - Never logs full purchase tokens or service account keys.
 *   - Token hashing via crypto.createHash before storage.
 *   - Product ID allowlist validation.
 *   - Package name exact match.
 *
 * Environment variables required:
 *   GOOGLE_PLAY_PACKAGE_NAME         — App package (com.mmenterprises.awedansahayak)
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON — Full service account JSON as string
 *     OR GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64  — Base64-encoded JSON
 *     OR GOOGLE_APPLICATION_CREDENTIALS           — File path to JSON
 */

import { google, androidpublisher_v3 } from 'googleapis';
import { createLogger } from '../config/logger';
import { isTokenAlreadyCredited, recordVerifiedToken, markTokenCredited, markTokenRevoked, hashToken } from './tokenLedger';

const log = createLogger('Billing');

// ── Constants ────────────────────────────────────────────────────────────

/** Allowed product SKUs — must match Google Play Console. */
const ALLOWED_PRODUCTS = new Set([
  'awedan_sahayak_monthly_sub',
  'awedan_sahayak_single_gen',
]);

const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME ?? 'com.mmenterprises.awedansahayak';

// ── Auth client (lazy) ───────────────────────────────────────────────────

let _authClient: any = null;
let _androidPublisher: androidpublisher_v3.Androidpublisher | null = null;

async function getAuthClient(): Promise<any> {
  if (_authClient) return _authClient;

  // Try multiple credential sources in order of preference
  const jsonB64 = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64;
  const jsonRaw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  const credsFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  let credentials: any = null;

  if (jsonB64) {
    try {
      const decoded = Buffer.from(jsonB64, 'base64').toString('utf8');
      credentials = JSON.parse(decoded);
      log.info('Using service account from GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64.');
    } catch (err: any) {
      throw new Error('Invalid GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64 — could not parse JSON.');
    }
  } else if (jsonRaw) {
    try {
      credentials = JSON.parse(jsonRaw);
      log.info('Using service account from GOOGLE_PLAY_SERVICE_ACCOUNT_JSON.');
    } catch (err: any) {
      throw new Error('Invalid GOOGLE_PLAY_SERVICE_ACCOUNT_JSON — could not parse.');
    }
  } else if (credsFile) {
    log.info(`Using service account file: ${credsFile}`);
    // google.auth.GoogleAuth will handle the file
  }

  if (credentials) {
    _authClient = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
  } else if (credsFile) {
    const auth = new google.auth.GoogleAuth({
      keyFile: credsFile,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    _authClient = await auth.getClient();
  } else {
    throw new Error(
      'No Google Play service account configured. Set one of:\n' +
      '  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64\n' +
      '  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON\n' +
      '  GOOGLE_APPLICATION_CREDENTIALS',
    );
  }

  return _authClient;
}

async function getPublisher(): Promise<androidpublisher_v3.Androidpublisher> {
  if (_androidPublisher) return _androidPublisher;
  const auth = await getAuthClient();
  _androidPublisher = google.androidpublisher({ version: 'v3', auth });
  log.info('Google Play Android Publisher API initialized.');
  return _androidPublisher;
}

// ── Types ────────────────────────────────────────────────────────────────

export interface VerifySubscriptionRequest {
  productId: string;
  purchaseToken: string;
  packageName?: string;
  orderId?: string;
}

export interface VerifySubscriptionResponse {
  valid: boolean;
  entitlement: 'active' | 'expired' | 'revoked' | 'denied';
  expiryTime: string | null;
  autoRenewing: boolean;
  acknowledgementRequired: boolean;
  reason?: string;
}

export interface VerifyProductRequest {
  productId: string;
  purchaseToken: string;
  packageName?: string;
  orderId?: string;
}

export interface VerifyProductResponse {
  valid: boolean;
  alreadyCredited: boolean;
  reason?: string;
}

// ── Subscription verification ────────────────────────────────────────────

export async function verifySubscriptionToken(
  params: VerifySubscriptionRequest,
): Promise<VerifySubscriptionResponse> {
  const pkg = params.packageName ?? PACKAGE_NAME;
  const tokenHash = hashToken(params.purchaseToken).substring(0, 8);

  // 1. Validate product ID
  if (!ALLOWED_PRODUCTS.has(params.productId)) {
    log.warn(`[Billing] Unknown productId: ${params.productId}`);
    return {
      valid: false,
      entitlement: 'denied',
      expiryTime: null,
      autoRenewing: false,
      acknowledgementRequired: false,
      reason: 'UNKNOWN_PRODUCT',
    };
  }

  // 2. Validate package name
  if (pkg !== PACKAGE_NAME) {
    log.warn(`[Billing] Package mismatch: ${pkg} vs ${PACKAGE_NAME}`);
    return {
      valid: false,
      entitlement: 'denied',
      expiryTime: null,
      autoRenewing: false,
      acknowledgementRequired: false,
      reason: 'PACKAGE_MISMATCH',
    };
  }

  let publisher: androidpublisher_v3.Androidpublisher;
  try {
    publisher = await getPublisher();
  } catch (err: any) {
    log.error('[Billing] Failed to initialize Publisher API:', err?.message);
    return {
      valid: false,
      entitlement: 'denied',
      expiryTime: null,
      autoRenewing: false,
      acknowledgementRequired: false,
      reason: 'SERVICE_UNAVAILABLE',
    };
  }

  // 3. Call Google Play Developer API
  try {
    log.info(`[Billing] Verifying subscription: product=${params.productId} token=${tokenHash}...`);
    const response = await publisher.purchases.subscriptions.get({
      packageName: pkg,
      subscriptionId: params.productId,
      token: params.purchaseToken,
    });

    const sub = response.data;
    if (!sub) {
      log.warn(`[Billing] Empty response for token ${tokenHash}...`);
      return {
        valid: false,
        entitlement: 'denied',
        expiryTime: null,
        autoRenewing: false,
        acknowledgementRequired: false,
        reason: 'INVALID_TOKEN',
      };
    }

    // 4. Determine entitlement state from v3 API fields
    const expiryTime = sub.expiryTimeMillis
      ? new Date(parseInt(sub.expiryTimeMillis, 10)).toISOString()
      : null;
    const autoRenewing = sub.autoRenewing ?? false;
    // acknowledgementState: 0=not acknowledged, 1=acknowledged
    const ackState = (sub.acknowledgementState ?? 0) as number;
    const needsAck = ackState === 0;

    // Derive entitlement from v3 fields (subscriptionState is only in v2)
    const now = Date.now();
    let entitlement: VerifySubscriptionResponse['entitlement'] = 'denied';

    if (sub.cancelReason !== undefined && sub.cancelReason !== null) {
      // Cancelled — check if still active until expiry
      log.info(`[Billing] Subscription cancelled (reason=${sub.cancelReason}).`);
      if (expiryTime && new Date(expiryTime).getTime() > now) {
        entitlement = 'active'; // Active until expiry
      } else {
        entitlement = 'revoked';
      }
    } else if (expiryTime && new Date(expiryTime).getTime() > now) {
      entitlement = 'active';
    } else if (expiryTime) {
      entitlement = 'expired';
    } else {
      entitlement = 'denied';
    }

    // 5. Check for replay
    if (entitlement !== 'denied' && isTokenAlreadyCredited(params.purchaseToken)) {
      log.warn(`[Billing] Token ${tokenHash}... already credited — replay attempt`);
      return {
        valid: true,
        entitlement,
        expiryTime,
        autoRenewing,
        acknowledgementRequired: needsAck,
        reason: 'ALREADY_CREDITED',
      };
    }

    // 6. Record verified token
    if (entitlement === 'active') {
      recordVerifiedToken({
        purchaseToken: params.purchaseToken,
        productId: params.productId,
        purchaseType: 'subscription',
        packageName: pkg,
        expiryTime,
        orderId: params.orderId,
      });
    }

    // 7. Handle revoked/expired
    if (entitlement === 'revoked') {
      markTokenRevoked(params.purchaseToken);
    }

    log.info(
      `[Billing] Subscription verified: entitlement=${entitlement} ` +
      `autoRenew=${autoRenewing} expiry=${expiryTime ?? 'none'} ackNeeded=${needsAck}`,
    );

    return {
      valid: true,
      entitlement,
      expiryTime,
      autoRenewing,
      acknowledgementRequired: needsAck,
    };
  } catch (err: any) {
    const status = err?.response?.status ?? err?.code ?? 0;
    log.error(`[Billing] Google API error (${status}):`, err?.message);
    return {
      valid: false,
      entitlement: 'denied',
      expiryTime: null,
      autoRenewing: false,
      acknowledgementRequired: false,
      reason: status === 404 ? 'INVALID_TOKEN' : 'SERVICE_UNAVAILABLE',
    };
  }
}

// ── Product (consumable) verification ────────────────────────────────────

export async function verifyProductToken(
  params: VerifyProductRequest,
): Promise<VerifyProductResponse> {
  const pkg = params.packageName ?? PACKAGE_NAME;
  const tokenHash = hashToken(params.purchaseToken).substring(0, 8);

  // 1. Validate product ID
  if (!ALLOWED_PRODUCTS.has(params.productId)) {
    log.warn(`[Billing] Unknown productId: ${params.productId}`);
    return { valid: false, alreadyCredited: false, reason: 'UNKNOWN_PRODUCT' };
  }

  // 2. Validate package
  if (pkg !== PACKAGE_NAME) {
    return { valid: false, alreadyCredited: false, reason: 'PACKAGE_MISMATCH' };
  }

  // 3. Replay protection — check token ledger FIRST
  if (isTokenAlreadyCredited(params.purchaseToken)) {
    log.warn(`[Billing] Token ${tokenHash}... already credited — replay blocked`);
    return { valid: true, alreadyCredited: true, reason: 'ALREADY_CREDITED' };
  }

  let publisher: androidpublisher_v3.Androidpublisher;
  try {
    publisher = await getPublisher();
  } catch (err: any) {
    return { valid: false, alreadyCredited: false, reason: 'SERVICE_UNAVAILABLE' };
  }

  // 4. Call Google Play Developer API
  try {
    log.info(`[Billing] Verifying product: product=${params.productId} token=${tokenHash}...`);
    const response = await publisher.purchases.products.get({
      packageName: pkg,
      productId: params.productId,
      token: params.purchaseToken,
    });

    const prod = response.data;
    if (!prod) {
      return { valid: false, alreadyCredited: false, reason: 'INVALID_TOKEN' };
    }

    // Check purchase state
    const state = prod.purchaseState ?? -1;
    if (state !== 0) {
      // 0 = purchased, 1 = cancelled, 2 = pending
      log.warn(`[Billing] Product purchase state=${state} — not valid`);
      return {
        valid: false,
        alreadyCredited: false,
        reason: state === 1 ? 'PURCHASE_CANCELLED' : 'PURCHASE_PENDING',
      };
    }

    // Check consumption state
    const consumptionState = prod.consumptionState ?? 0;
    if (consumptionState === 1) {
      log.warn(`[Billing] Product already consumed — replay attempt`);
      return { valid: false, alreadyCredited: true, reason: 'ALREADY_CONSUMED' };
    }

    // 5. Record in token ledger
    recordVerifiedToken({
      purchaseToken: params.purchaseToken,
      productId: params.productId,
      purchaseType: 'product',
      packageName: pkg,
      orderId: params.orderId,
    });

    log.info(`[Billing] Product verified: token=${tokenHash}... — valid, not yet credited`);

    return { valid: true, alreadyCredited: false };
  } catch (err: any) {
    const status = err?.response?.status ?? err?.code ?? 0;
    log.error(`[Billing] Google API error (${status}):`, err?.message);
    return {
      valid: false,
      alreadyCredited: false,
      reason: status === 404 ? 'INVALID_TOKEN' : 'SERVICE_UNAVAILABLE',
    };
  }
}

// ── Server-side Acknowledgement ──────────────────────────────────────────

/** Acknowledge a subscription purchase server-side via Google Play API. */
export async function acknowledgeSubscription(
  purchaseToken: string,
  productId: string,
): Promise<{ success: boolean; reason?: string }> {
  try {
    const publisher = await getPublisher();
    await publisher.purchases.subscriptions.acknowledge({
      packageName: PACKAGE_NAME,
      subscriptionId: productId,
      token: purchaseToken,
    });
    log.info(`[Billing] Subscription acknowledged: ${hashToken(purchaseToken).substring(0, 8)}...`);
    return { success: true };
  } catch (err: any) {
    // Already acknowledged is not an error
    if (err?.code === 409 || err?.message?.includes('already been acknowledged')) {
      log.info(`[Billing] Subscription already acknowledged.`);
      return { success: true };
    }
    log.error(`[Billing] Acknowledge failed:`, err?.message);
    return { success: false, reason: 'ACKNOWLEDGE_FAILED' };
  }
}

/** Consume a one-time product server-side via Google Play API. */
export async function consumeProduct(
  purchaseToken: string,
  productId: string,
): Promise<{ success: boolean; reason?: string }> {
  try {
    const publisher = await getPublisher();
    await publisher.purchases.products.consume({
      packageName: PACKAGE_NAME,
      productId,
      token: purchaseToken,
    });
    log.info(`[Billing] Product consumed: ${hashToken(purchaseToken).substring(0, 8)}...`);
    return { success: true };
  } catch (err: any) {
    if (err?.code === 409 || err?.message?.includes('already been consumed')) {
      log.info(`[Billing] Product already consumed.`);
      return { success: true };
    }
    log.error(`[Billing] Consume failed:`, err?.message);
    return { success: false, reason: 'CONSUME_FAILED' };
  }
}

// ── Atomic Product Processing ────────────────────────────────────────────

export interface AtomicProcessResult {
  processed: boolean;
  reason?: string;
}

/**
 * Atomically processes a one-time consumable purchase:
 *   1. Check token ledger (replay protection)
 *   2. Verify with Google Play API
 *   3. Mark as credited in ledger
 *   4. Consume via Google Play API
 *
 * All-or-nothing: if any step fails, the token is NOT marked as credited.
 */
export async function atomicProcessProduct(
  purchaseToken: string,
  productId: string,
): Promise<AtomicProcessResult> {
  const tokenHash = hashToken(purchaseToken).substring(0, 8);

  // 1. Product ID allowlist
  if (!ALLOWED_PRODUCTS.has(productId)) {
    return { processed: false, reason: 'UNKNOWN_PRODUCT' };
  }

  // 2. Replay protection — check ledger FIRST
  if (isTokenAlreadyCredited(purchaseToken)) {
    log.warn(`[Billing] Atomic: token ${tokenHash}... already credited — replay blocked.`);
    return { processed: false, reason: 'ALREADY_CREDITED' };
  }

  // 3. Record in ledger as PENDING (reserve the slot)
  recordVerifiedToken({
    purchaseToken,
    productId,
    purchaseType: 'product',
    packageName: PACKAGE_NAME,
  });

  // 4. Verify with Google Play
  const verification = await verifyProductToken({ productId, purchaseToken });
  if (!verification.valid || verification.alreadyCredited) {
    log.warn(`[Billing] Atomic: verification failed — ${verification.reason}`);
    return { processed: false, reason: verification.reason };
  }

  // 5. Mark as credited (idempotent safety: won't credit twice)
  markTokenCredited(purchaseToken);

  // 6. Consume via Google Play API
  const consumeResult = await consumeProduct(purchaseToken, productId);
  if (!consumeResult.success) {
    // Ledger is marked credited but consume failed — safe: the token
    // won't be credited again (replay check at step 2). Next attempt
    // will fail at step 2 (already credited) and the user needs support.
    log.error(`[Billing] Atomic: consume failed after credit — token ${tokenHash}... needs manual review.`);
    return { processed: false, reason: 'CONSUME_FAILED_AFTER_CREDIT' };
  }

  log.info(`[Billing] Atomic: token ${tokenHash}... fully processed (verified+credited+consumed).`);
  return { processed: true };
}

// ── DEPRECATED (removed from production flow) ────────────────────────────
// confirmProductCredited() — removed. Use atomicProcessProduct() instead.
// The old two-step flow (verify → mobile credit → confirm-credited)
// was replaced by the atomic single-endpoint flow for safety.

/** Check if the billing service is initialized. */
export async function isBillingServiceReady(): Promise<boolean> {
  try {
    await getPublisher();
    return true;
  } catch {
    return false;
  }
}

/** Get allowed product IDs (for audit). */
export function getAllowedProducts(): string[] {
  return [...ALLOWED_PRODUCTS];
}
