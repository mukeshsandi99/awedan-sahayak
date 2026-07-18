/**
 * App configuration — single source of truth for environment-dependent values.
 *
 * To switch between local dev and production:
 *   - LOCAL (dev via USB + adb reverse): API_BASE_URL = 'http://localhost:3000'
 *   - LOCAL (WiFi, no USB): API_BASE_URL = 'http://<YOUR_LAN_IP>:3000'
 *   - PRODUCTION: Set API_BASE_URL to your deployed cloud server URL.
 *
 * For a proper CI/CD setup, replace this with environment variables
 * (e.g. expo-constants + app.config.js dynamic config).
 */

import { Platform } from 'react-native';

/**
 * Base URL of the Awedan Sahayak backend API.
 *
 * Change this single value to switch all screens and services
 * from local dev to production — no need to hunt through every file.
 */
export const API_BASE_URL: string =
  // Production (Render.com):
  'https://awedan-sahayak-api.onrender.com';

// ── Google Play Billing Product IDs ─────────────────────────────────
//
// WARNING: These products must be created in Google Play Console before
// IAP can be tested (even in internal/closed testing tracks).
//
//   • awedan_sahayak_monthly_sub  — ₹100/month auto-renewing subscription
//   • awedan_sahayak_single_gen   — ₹10 one-time consumable (1 generation credit)
//
// To create in Play Console:
//   1. Go to Play Console → Your App → Monetize → Products → Subscriptions
//   2. Create subscription with product ID: awedan_sahayak_monthly_sub
//   3. Go to In-App Products → Create with product ID: awedan_sahayak_single_gen
//   4. Both must be "Active" before react-native-iap can query them
//
export const IAP_SKU_MONTHLY = 'awedan_sahayak_monthly_sub';
export const IAP_SKU_SINGLE = 'awedan_sahayak_single_gen';

/** All IAP SKUs for querying product details from Play Store. */
export const IAP_SKUS = [IAP_SKU_MONTHLY, IAP_SKU_SINGLE] as const;

// Local development (uncomment below and comment out the production URL above):
// Platform.select({
//   android: 'http://localhost:3000',
//   ios: 'http://localhost:3000',
//   default: 'http://localhost:3000',
// }) ?? 'http://localhost:3000';
