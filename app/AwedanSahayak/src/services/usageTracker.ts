/**
 * Usage Tracker Service
 *
 * Manages the monetization usage counters stored in local SQLite
 * (app_metadata key-value table). All state is device-local —
 * server-side verification is a future enhancement.
 *
 * Keys tracked:
 *   free_applications_used   — count of free tier applications used (0–5)
 *   paid_credits             — remaining one-time purchased credits
 *   subscription_status      — 'active' | 'expired' | 'none'
 *   subscription_product_id  — Play Store product ID of active sub
 *   subscription_purchase_token — Play Store purchase token
 *   subscription_expiry      — ISO date string when sub expires
 */

import {
  getMetadata,
  setMetadata,
  getMetadataInt,
  setMetadataInt,
} from '../database/db';
import type { SubscriptionStatus } from '../types/database';

// ── Constants ──────────────────────────────────────────────────────────

/** Number of free applications before paywall kicks in. */
export const FREE_TIER_LIMIT = 5;

// ── Internal helpers ──────────────────────────────────────────────────

const KEY_FREE_USED = 'free_applications_used';
const KEY_PAID_CREDITS = 'paid_credits';
const KEY_SUB_STATUS = 'subscription_status';
const KEY_SUB_PRODUCT = 'subscription_product_id';
const KEY_SUB_TOKEN = 'subscription_purchase_token';
const KEY_SUB_EXPIRY = 'subscription_expiry';

// ── Free usage ────────────────────────────────────────────────────────

/** How many free-tier applications the user has generated so far. */
export async function getFreeUsageCount(): Promise<number> {
  return getMetadataInt(KEY_FREE_USED);
}

/** Increment the free usage counter by 1. */
export async function incrementFreeUsage(): Promise<void> {
  const current = await getFreeUsageCount();
  await setMetadataInt(KEY_FREE_USED, current + 1);
}

// ── Paid credits ──────────────────────────────────────────────────────

/** How many paid one-time credits remain (each = 1 application generation). */
export async function getPaidCredits(): Promise<number> {
  return getMetadataInt(KEY_PAID_CREDITS);
}

/** Consume 1 paid credit after a successful generation. */
export async function consumePaidCredit(): Promise<void> {
  const current = await getPaidCredits();
  if (current <= 0) {
    console.warn('[UsageTracker] consumePaidCredit called with 0 credits — ignoring.');
    return;
  }
  await setMetadataInt(KEY_PAID_CREDITS, current - 1);
}

/** Add credits after a successful one-time purchase. */
export async function addPaidCredits(count: number): Promise<void> {
  const current = await getPaidCredits();
  await setMetadataInt(KEY_PAID_CREDITS, current + count);
}

// ── Subscription status ───────────────────────────────────────────────

/** Get the current subscription status. */
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const value = await getMetadata(KEY_SUB_STATUS);
  if (value === 'active') {
    // Check if subscription has expired (belt-and-suspenders)
    const expiry = await getMetadata(KEY_SUB_EXPIRY);
    if (expiry) {
      const expiryDate = new Date(expiry);
      if (expiryDate <= new Date()) {
        // Expired — auto-update status
        await setSubscriptionExpired();
        return 'expired';
      }
    }
    return 'active';
  }
  if (value === 'expired') return 'expired';
  return 'none';
}

/** Mark subscription as active with purchase metadata. */
export async function setSubscriptionActive(
  productId: string,
  purchaseToken: string,
  expiryDate: string,
): Promise<void> {
  await setMetadata(KEY_SUB_STATUS, 'active');
  await setMetadata(KEY_SUB_PRODUCT, productId);
  await setMetadata(KEY_SUB_TOKEN, purchaseToken);
  await setMetadata(KEY_SUB_EXPIRY, expiryDate);
}

/** Mark subscription as expired (called when expiry date passes or renewal fails). */
export async function setSubscriptionExpired(): Promise<void> {
  await setMetadata(KEY_SUB_STATUS, 'expired');
}

// ── Purchase token retrieval (for server-side verification) ──────────

/** Returns the stored purchase token for the active subscription, if any. */
export async function getSubscriptionPurchaseToken(): Promise<string | null> {
  const status = await getSubscriptionStatus();
  if (status !== 'active') return null;
  return getMetadata(KEY_SUB_TOKEN);
}

// ── Monetization gate ─────────────────────────────────────────────────

export interface GenerationCheck {
  allowed: boolean;
  reason: 'free' | 'subscribed' | 'paid_credit' | 'blocked';
}

/**
 * Check whether the user can generate one more application.
 * Call this BEFORE hitting the backend API.
 *
 * Priority:
 *   1. Active subscription → always allowed
 *   2. Free tier not exhausted → allowed
 *   3. Has paid credits → allowed (consumes 1 credit)
 *   4. None of the above → blocked (show paywall)
 */
export async function canGenerateApplication(): Promise<GenerationCheck> {
  // 1. Subscription check
  const subStatus = await getSubscriptionStatus();
  if (subStatus === 'active') {
    return { allowed: true, reason: 'subscribed' };
  }

  // 2. Free tier check
  const freeUsed = await getFreeUsageCount();
  if (freeUsed < FREE_TIER_LIMIT) {
    return { allowed: true, reason: 'free' };
  }

  // 3. Paid credits check
  const credits = await getPaidCredits();
  if (credits > 0) {
    return { allowed: true, reason: 'paid_credit' };
  }

  // 4. Blocked
  return { allowed: false, reason: 'blocked' };
}
