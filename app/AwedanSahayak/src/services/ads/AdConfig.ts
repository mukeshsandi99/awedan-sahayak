/**
 * AdMob Configuration — Central ad unit IDs and settings.
 *
 * MODES:
 *   FORCE_TEST_MODE = true  → Google test ad units used (safe for dev/testing)
 *   FORCE_TEST_MODE = false → Production ad units used (REAL ads, REAL revenue)
 *
 * ⚠️  NEVER set FORCE_TEST_MODE = false during development or testing.
 *     Clicking your own production ads violates AdMob policy.
 *
 * Test IDs reference: https://developers.google.com/admob/android/test-ads
 */

import { Platform } from 'react-native';

// ── Test mode ────────────────────────────────────────────────────────────

/** Set to false ONLY when publishing to Google Play for real ad traffic. */
export const FORCE_TEST_MODE = true;

/** Returns true if test ad units should be used. */
export function isTestMode(): boolean {
  return __DEV__ || FORCE_TEST_MODE;
}

// ── App ID ───────────────────────────────────────────────────────────────

/** Production AdMob App ID for com.mmenterprises.awedansahayak */
export const AD_APP_ID = 'ca-app-pub-4650752456313692~1347004127';

// ── Ad Unit IDs ──────────────────────────────────────────────────────────

/** Google official test ad unit IDs — used when isTestMode() returns true. */
const TEST_IDS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  appOpen: 'ca-app-pub-3940256099942544/3419835294',
};

/** Production ad unit IDs — used ONLY when isTestMode() returns false. */
const PROD_IDS = {
  banner: 'ca-app-pub-4650752456313692/3517605963',
  interstitial: 'ca-app-pub-4650752456313692/6882135900',
  rewarded: 'ca-app-pub-4650752456313692/9480379088',
  appOpen: 'ca-app-pub-4650752456313692/5174568493',
};

/** Active ad unit IDs based on current mode. */
export const AD_UNIT_IDS = isTestMode() ? TEST_IDS : PROD_IDS;

// ── Frequency defaults ───────────────────────────────────────────────────

export const AD_FREQUENCY = {
  interstitialMinGapMs: 3 * 60 * 1000,    // 3 minutes
  interstitialEveryNGenerations: 3,        // Every 3rd successful generation
  rewardedDayLimit: 5,                     // 5 rewarded ads per day
  rewardedMinGapMs: 30 * 1000,             // 30 seconds
  appOpenMaxPerSession: 1,                 // 1 per session
  appOpenMinGapMs: 4 * 60 * 60 * 1000,     // 4 hours
  bannerRefreshMs: 60 * 1000,              // 60 seconds (Google minimum)
} as const;

// ── Screens where banner ads are allowed ─────────────────────────────────

export const BANNER_ALLOWED_SCREENS = new Set([
  'HomeMain',
  'MyApplicationsList',
  'OfficeDirectory',
  'Profile',
]);

// ── Screens where ads are FORBIDDEN ──────────────────────────────────────

export const AD_FORBIDDEN_SCREENS = new Set([
  'ApplicationForm',
  'ApplicationPreview',
  'Paywall',
  'HandwritingScan',
  'CustomApplication',
]);
