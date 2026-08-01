/**
 * AdMob Configuration — Central ad unit IDs and settings.
 *
 * ⚠️ IMPORTANT: These are Google's OFFICIAL TEST AD UNIT IDs.
 * Replace with YOUR production IDs BEFORE publishing to Play Store.
 *
 * Test IDs from: https://developers.google.com/admob/android/test-ads
 */

import { Platform } from 'react-native';

// ── App ID ───────────────────────────────────────────────────────────────

export const AD_APP_ID = __DEV__
  ? 'ca-app-pub-3940256099942544~3347511713'
  : 'ca-app-pub-3940256099942544~3347511713'; // TODO: Replace with production App ID

// ── Ad Unit IDs ──────────────────────────────────────────────────────────

const TEST_IDS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  appOpen: 'ca-app-pub-3940256099942544/3419835294',
  native: 'ca-app-pub-3940256099942544/2247696110',
};

// TODO: Replace with production ad unit IDs before release
const PROD_IDS = { ...TEST_IDS };

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
