/**
 * Firebase Cloud Messaging — Push Notification Support
 *
 * DISABLED by default. Enable via Firebase config or Remote Config.
 * Currently, the app uses expo-notifications for local reminders.
 * FCM would be used for:
 *   - System announcements
 *   - Emergency maintenance notices
 *
 * NOT used for marketing spam.
 */

import { isFirebaseAvailable, FIREBASE_CONFIG } from './Firebase';

let _initialized = false;

export const Messaging = {
  /** Initialize FCM if enabled. Returns false if unavailable or disabled. */
  async init(): Promise<boolean> {
    if (_initialized || !FIREBASE_CONFIG.messaging) return false;
    if (!isFirebaseAvailable()) return false;

    try {
      const { getMessaging } = await import('./FirebaseImports');
      const messagingMod = await getMessaging();
      if (!messagingMod) return false;
      const messaging = messagingMod.default || messagingMod;
      // Request permission (Android 13+ requires runtime permission)
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus?.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus?.PROVISIONAL;

      if (enabled) {
        // Get FCM token for server-side targeting
        const fcmToken = await messaging().getToken();
        if (fcmToken) {
          console.log('[Messaging] ✅ Initialized. Token:', fcmToken.substring(0, 8) + '...');
          _initialized = true;
          return true;
        }
      }

      console.log('[Messaging] Permission not granted — disabled.');
      return false;
    } catch (err: any) {
      console.log('[Messaging] ⚠️  Not available:', err?.message?.substring(0, 60));
      return false;
    }
  },

  /** Check if FCM is active. */
  isAvailable(): boolean {
    return _initialized;
  },
};

export default Messaging;
