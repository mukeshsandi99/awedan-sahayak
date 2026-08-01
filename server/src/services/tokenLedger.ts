/**
 * Purchase Token Ledger — Replay Attack Protection
 *
 * Stores verified purchase tokens to prevent double-crediting.
 * Uses SHA-256 hashing — raw tokens are NEVER stored.
 *
 * ⚠️ PRODUCTION WARNING:
 *   Currently uses a JSON file for persistence (works on Render's
 *   persistent disk in the repo directory). For production scale:
 *   - Use Render Disk (persistent) or a managed database
 *   - SQLite, PostgreSQL, or Redis would be more robust
 *   - The JSON file approach is adequate for low-volume apps
 *
 * Fields tracked:
 *   - purchaseTokenHash (SHA-256, primary key)
 *   - productId, purchaseType, packageName
 *   - verificationStatus: 'pending' | 'verified' | 'rejected' | 'revoked'
 *   - credited: boolean (has the entitlement been granted)
 *   - firstVerifiedAt, lastVerifiedAt, expiryTime
 *   - orderIdHash (optional, for cross-reference)
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createLogger } from '../config/logger';
import { getEnvConfig } from '../config/env';

const log = createLogger('TokenLedger');

// ── Production safety ────────────────────────────────────────────────────

const env = getEnvConfig();
const LEDGER_MODE = (process.env.BILLING_LEDGER_MODE ?? 'json').toLowerCase();

/** In production, JSON file is NOT acceptable for billing integrity. */
export function isLedgerDurable(): boolean {
  if (LEDGER_MODE === 'postgres' || LEDGER_MODE === 'sqlite') return true;
  if (env.isProduction) {
    log.error(
      '❌ BILLING_LEDGER_MODE is "json" in PRODUCTION — this is NOT safe.\n' +
      '   The JSON file ledger can be lost on Render restart/rollback.\n' +
      '   Billing verification endpoints will DISABLE themselves.\n' +
      '   Set BILLING_LEDGER_MODE=sqlite or BILLING_LEDGER_MODE=postgres\n' +
      '   with a Render Persistent Disk for production.',
    );
    return false;
  }
  return false; // Dev JSON mode
}

// ── Types ────────────────────────────────────────────────────────────────

export interface TokenRecord {
  purchaseTokenHash: string;
  productId: string;
  purchaseType: 'subscription' | 'product';
  packageName: string;
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'revoked';
  credited: boolean;
  firstVerifiedAt: string;
  lastVerifiedAt: string;
  expiryTime: string | null;
  revoked: boolean;
  orderIdHash: string | null;
}

// ── Path ─────────────────────────────────────────────────────────────────

const LEDGER_DIR = path.join(__dirname, '..', '..', 'data');
const LEDGER_FILE = path.join(LEDGER_DIR, 'token_ledger.json');

// ── In-memory cache ──────────────────────────────────────────────────────

let ledger: Map<string, TokenRecord> | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashOrderId(orderId: string): string {
  return crypto.createHash('sha256').update(orderId).digest('hex');
}

// ── Load / Save ──────────────────────────────────────────────────────────

function ensureDir(): void {
  if (!fs.existsSync(LEDGER_DIR)) {
    fs.mkdirSync(LEDGER_DIR, { recursive: true });
  }
}

function loadLedger(): Map<string, TokenRecord> {
  if (ledger) return ledger;
  ensureDir();
  try {
    if (fs.existsSync(LEDGER_FILE)) {
      const raw = fs.readFileSync(LEDGER_FILE, 'utf8');
      const entries: TokenRecord[] = JSON.parse(raw);
      ledger = new Map(entries.map((e) => [e.purchaseTokenHash, e]));
      log.info(`Token ledger loaded: ${ledger.size} record(s).`);
    } else {
      ledger = new Map();
      log.info('Token ledger initialized (empty).');
    }
  } catch (err: any) {
    log.warn('Failed to load token ledger, starting fresh:', err?.message);
    ledger = new Map();
  }
  return ledger;
}

function saveLedger(): void {
  ensureDir();
  try {
    const entries = Array.from((ledger ?? new Map()).values());
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(entries, null, 2), 'utf8');
  } catch (err: any) {
    log.error('Failed to save token ledger:', err?.message);
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────────

/** Check if a purchase token has already been processed (credited). */
export function isTokenAlreadyCredited(purchaseToken: string): boolean {
  const h = hashToken(purchaseToken);
  const record = loadLedger().get(h);
  return record?.credited === true;
}

/** Check if a purchase token has been verified (any status). */
export function getTokenRecord(purchaseToken: string): TokenRecord | undefined {
  const h = hashToken(purchaseToken);
  return loadLedger().get(h);
}

/** Record a newly verified purchase token. */
export function recordVerifiedToken(params: {
  purchaseToken: string;
  productId: string;
  purchaseType: TokenRecord['purchaseType'];
  packageName: string;
  expiryTime?: string | null;
  orderId?: string | null;
}): TokenRecord {
  const h = hashToken(params.purchaseToken);
  const now = new Date().toISOString();

  const existing = loadLedger().get(h);
  const record: TokenRecord = {
    purchaseTokenHash: h,
    productId: params.productId,
    purchaseType: params.purchaseType,
    packageName: params.packageName,
    verificationStatus: 'verified',
    credited: false, // Will be set to true after credit is granted
    firstVerifiedAt: existing?.firstVerifiedAt ?? now,
    lastVerifiedAt: now,
    expiryTime: params.expiryTime ?? null,
    revoked: false,
    orderIdHash: params.orderId ? hashOrderId(params.orderId) : null,
  };

  loadLedger().set(h, record);
  saveLedger();
  return record;
}

/** Mark a token as credited (entitlement granted). */
export function markTokenCredited(purchaseToken: string): void {
  const h = hashToken(purchaseToken);
  const record = loadLedger().get(h);
  if (record) {
    record.credited = true;
    record.lastVerifiedAt = new Date().toISOString();
    loadLedger().set(h, record);
    saveLedger();
  }
}

/** Mark a token as revoked (subscription cancelled/refunded). */
export function markTokenRevoked(purchaseToken: string): void {
  const h = hashToken(purchaseToken);
  const record = loadLedger().get(h);
  if (record) {
    record.revoked = true;
    record.verificationStatus = 'revoked';
    record.lastVerifiedAt = new Date().toISOString();
    loadLedger().set(h, record);
    saveLedger();
  }
}

/** Get ledger size for health/monitoring. */
export function getLedgerSize(): number {
  return loadLedger().size;
}
