/**
 * AdMob Configuration — Central ad unit IDs and settings.
 *
 * ⚠️  PRODUCTION RELEASE CHECKLIST — BEFORE PUBLISHING TO GOOGLE PLAY:
 *   □ Replace AD_APP_ID with your REAL AdMob App ID (ca-app-pub-XXXX~YYYY)
 *   □ Replace each ad unit ID in PROD_IDS with your REAL production ad unit IDs
 *   □ Current values are Google's OFFICIAL TEST IDs — they show TEST ADS only
 *   □ Test IDs reference: https://developers.google.com/admob/android/test-ads
 *   □ Without real IDs: no revenue, and Google Play may reject the update
 *
 * Test IDs from: https://developers.google.com/admob/android/test-ads
 */

import { Platform } from 'react-native';

// ── App ID ───────────────────────────────────────────────────────────────

export const AD_APP_ID = __DEV__
  ? 'ca-app-pub-3940256099942544~3347511713'
  : 'ca-app-pub-3940256099942544~3347511713'; // ⚠️ TODO: Replace with YOUR production App ID

// ── Ad Unit IDs ──────────────────────────────────────────────────────────

const TEST_IDS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  appOpen: 'ca-app-pub-3940256099942544/3419835294',
  native: 'ca-app-pub-3940256099942544/2247696110',
};

// ⚠️ TODO: Replace EACH of these with YOUR real production ad unit IDs
// Example format: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY'
const PROD_IDS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',       // ⚠️ REPLACE
  interstitial: 'ca-app-pub-3940256099942544/1033173712',  // ⚠️ REPLACE
  rewarded: 'ca-app-pub-3940256099942544/5224354917',      // ⚠️ REPLACE
  appOpen: 'ca-app-pub-3940256099942544/3419835294',       // ⚠️ REPLACE
  native: 'ca-app-pub-3940256099942544/2247696110',        // ⚠️ REPLACE
};

export const AD_UNIT_IDS = __DEV__ ? TEST_IDS : PROD_IDS;

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
