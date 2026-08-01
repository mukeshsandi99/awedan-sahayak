/**
 * FrequencyManager — Enforces ad display frequency limits.
 *
 * Uses SQLite app_metadata for persistent tracking across app sessions.
 * Premium users are ALWAYS blocked via isPremium() check in AdManager.
 */

import { getMetadata, setMetadata, getMetadataInt, setMetadataInt } from '../../database/db';
import { AD_FREQUENCY } from './AdConfig';

// ── Keys ─────────────────────────────────────────────────────────────────

const KEY_LAST_INTERSTITIAL = 'ad_last_interstitial_ts';
const KEY_LAST_REWARDED = 'ad_last_rewarded_ts';
const KEY_LAST_APP_OPEN = 'ad_last_app_open_ts';
const KEY_GENERATION_COUNT = 'ad_generation_count';
const KEY_REWARDED_TODAY = 'ad_rewarded_today';
const KEY_REWARDED_DAY = 'ad_rewarded_day';

// ── Interstitial ─────────────────────────────────────────────────────────

export async function canShowInterstitial(): Promise<boolean> {
  const lastTs = await getMetadata(KEY_LAST_INTERSTITIAL);
  if (!lastTs) return true;
  const elapsed = Date.now() - parseInt(lastTs, 10);
  return elapsed >= AD_FREQUENCY.interstitialMinGapMs;
}

export async function recordInterstitialShown(): Promise<void> {
  await setMetadata(KEY_LAST_INTERSTITIAL, String(Date.now()));
}

/** Check if this generation should trigger an interstitial (every Nth). */
export async function shouldTriggerInterstitial(): Promise<boolean> {
  const count = await getMetadataInt(KEY_GENERATION_COUNT);
  return count > 0 && count % AD_FREQUENCY.interstitialEveryNGenerations === 0;
}

export async function incrementGenerationCount(): Promise<void> {
  const count = await getMetadataInt(KEY_GENERATION_COUNT);
  await setMetadataInt(KEY_GENERATION_COUNT, count + 1);
}

// ── Rewarded ─────────────────────────────────────────────────────────────

export async function canShowRewarded(): Promise<boolean> {
  // Check daily limit
  const today = new Date().toISOString().substring(0, 10);
  const storedDay = await getMetadata(KEY_REWARDED_DAY);
  const todayCount = storedDay === today ? await getMetadataInt(KEY_REWARDED_TODAY) : 0;
  if (todayCount >= AD_FREQUENCY.rewardedDayLimit) return false;

  // Check min gap
  const lastTs = await getMetadata(KEY_LAST_REWARDED);
  if (lastTs) {
    const elapsed = Date.now() - parseInt(lastTs, 10);
    if (elapsed < AD_FREQUENCY.rewardedMinGapMs) return false;
  }
  return true;
}

export async function recordRewardedShown(): Promise<void> {
  const today = new Date().toISOString().substring(0, 10);
  const storedDay = await getMetadata(KEY_REWARDED_DAY);
  const todayCount = storedDay === today ? await getMetadataInt(KEY_REWARDED_TODAY) : 0;
  await setMetadataInt(KEY_REWARDED_TODAY, todayCount + 1);
  await setMetadata(KEY_REWARDED_DAY, today);
  await setMetadata(KEY_LAST_REWARDED, String(Date.now()));
}

// ── App Open ─────────────────────────────────────────────────────────────

export async function canShowAppOpen(): Promise<boolean> {
  const lastTs = await getMetadata(KEY_LAST_APP_OPEN);
  if (!lastTs) return true;
  const elapsed = Date.now() - parseInt(lastTs, 10);
  return elapsed >= AD_FREQUENCY.appOpenMinGapMs;
}

export async function recordAppOpenShown(): Promise<void> {
  await setMetadata(KEY_LAST_APP_OPEN, String(Date.now()));
}
