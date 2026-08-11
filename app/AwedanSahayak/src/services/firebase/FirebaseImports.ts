/**
 * Firebase Import Helpers
 *
 * All Firebase modules are lazily loaded through this file.
 * Each import is wrapped in try-catch so missing config (no
 * google-services.json) never crashes the app.
 *
 * NOTE: Metro bundler requires static string literals for dynamic import().
 * Do NOT refactor to pass a variable to import() — it will break the bundle.
 */

type FirebaseModule<T> = {
  available: boolean;
  module: T | null;
};

// ── Lazy Initialized Modules ─────────────────────────────────────────────

let _analytics: FirebaseModule<any> = { available: false, module: null };
let _crashlytics: FirebaseModule<any> = { available: false, module: null };
let _perf: FirebaseModule<any> = { available: false, module: null };
let _remoteConfig: FirebaseModule<any> = { available: false, module: null };
let _messaging: FirebaseModule<any> = { available: false, module: null };
let _firebaseApp: FirebaseModule<any> = { available: false, module: null };

async function tryImportFirebase(mod: any): Promise<any> {
  try {
    return mod;
  } catch {
    return null;
  }
}

// ── Public Accessors ─────────────────────────────────────────────────────

export async function getFirebaseApp(): Promise<any | null> {
  if (!_firebaseApp.available) {
    try {
      const mod = await import('@react-native-firebase/app');
      _firebaseApp = { available: true, module: mod };
    } catch {
      _firebaseApp = { available: false, module: null };
    }
  }
  return _firebaseApp.module;
}

export async function getAnalytics(): Promise<any | null> {
  if (!_analytics.available) {
    try {
      const mod = await import('@react-native-firebase/analytics');
      _analytics = { available: true, module: mod };
    } catch {
      _analytics = { available: false, module: null };
    }
  }
  return _analytics.module;
}

export async function getCrashlytics(): Promise<any | null> {
  if (!_crashlytics.available) {
    try {
      const mod = await import('@react-native-firebase/crashlytics');
      _crashlytics = { available: true, module: mod };
    } catch {
      _crashlytics = { available: false, module: null };
    }
  }
  return _crashlytics.module;
}

export async function getPerformance(): Promise<any | null> {
  if (!_perf.available) {
    try {
      const mod = await import('@react-native-firebase/perf');
      _perf = { available: true, module: mod };
    } catch {
      _perf = { available: false, module: null };
    }
  }
  return _perf.module;
}

export async function getRemoteConfig(): Promise<any | null> {
  if (!_remoteConfig.available) {
    try {
      const mod = await import('@react-native-firebase/remote-config');
      _remoteConfig = { available: true, module: mod };
    } catch {
      _remoteConfig = { available: false, module: null };
    }
  }
  return _remoteConfig.module;
}

export async function getMessaging(): Promise<any | null> {
  if (!_messaging.available) {
    try {
      const mod = await import('@react-native-firebase/messaging');
      _messaging = { available: true, module: mod };
    } catch {
      _messaging = { available: false, module: null };
    }
  }
  return _messaging.module;
}
