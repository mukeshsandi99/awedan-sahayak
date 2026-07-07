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

// Local development (uncomment below and comment out the production URL above):
// Platform.select({
//   android: 'http://localhost:3000',
//   ios: 'http://localhost:3000',
//   default: 'http://localhost:3000',
// }) ?? 'http://localhost:3000';
