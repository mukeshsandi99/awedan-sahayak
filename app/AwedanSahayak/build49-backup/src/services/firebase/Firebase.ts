/**
 * Firebase Initialization Module
 *
 * Central Firebase app initialization. All other Firebase modules
 * (Analytics, Crashlytics, etc.) import from here.
 *
 * SAFE INIT: If Firebase is not configured (no google-services.json),
 * all calls gracefully no-op. The app functions normally without Firebase.
 *
 * To enable Firebase:
 *   1. Create a Firebase project at https://console.firebase.google.com
 *   2. Add Android app with package: com.mmenterprises.awedansahayak
 *   3. Download google-services.json → place in android/app/
 *   4. Rebuild the app
 */

let _initialized = false;
let _firebaseAvailable = false;

/** Returns true if Firebase is configured and available. */
export function isFirebaseAvailable(): boolean {
  return _firebaseAvailable;
}

/** Initialize Firebase. Safe to call multiple times. Call once on app launch. */
export async function initFirebase(): Promise<boolean> {
  if (_initialized) return _firebaseAvailable;

  try {
    // Dynamic import — won't fail at module load if not installed
    const { getFirebaseApp } = await import('./FirebaseImports');
    const firebase = await getFirebaseApp();
    if (firebase && (firebase as any).apps?.length > 0) {
      _firebaseAvailable = true;
      console.log('[Firebase] ✅ Initialized successfully.');
    } else {
      console.log('[Firebase] ⚠️  No Firebase app configured — services disabled.');
      _firebaseAvailable = false;
    }
  } catch (err: any) {
    console.log('[Firebase] ⚠️  Not available (no google-services.json):', err?.message?.substring(0, 80));
    _firebaseAvailable = false;
  }

  _initialized = true;
  return _firebaseAvailable;
}

/** Firebase configuration for reference. */
export const FIREBASE_CONFIG = {
  /** Enable/disable individual services. Disabled services won't even attempt init. */
  analytics: true,
  crashlytics: true,
  performance: true,
  remoteConfig: true,
  messaging: false, // Disabled until FCM is needed
} as const;
