/**
 * Firebase Import Helpers
 *
 * All Firebase modules are dynamically imported through this file.
 * Each import is wrapped in try-catch so missing config (no
 * google-services.json) never crashes the app.
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

async function tryImport(path: string): Promise<any> {
  try {
    const mod = await import(path);
    return mod?.default ?? mod;
  } catch {
    return null;
  }
}

// ── Public Accessors ─────────────────────────────────────────────────────

export async function getFirebaseApp(): Promise<any | null> {
  if (!_firebaseApp.available) {
    const mod = await tryImport('@react-native-firebase/app');
    _firebaseApp = { available: !!mod, module: mod };
  }
  return _firebaseApp.module;
}

export async function getAnalytics(): Promise<any | null> {
  if (!_analytics.available) {
    const mod = await tryImport('@react-native-firebase/analytics');
    _analytics = { available: !!mod, module: mod };
  }
  return _analytics.module;
}

export async function getCrashlytics(): Promise<any | null> {
  if (!_crashlytics.available) {
    const mod = await tryImport('@react-native-firebase/crashlytics');
    _crashlytics = { available: !!mod, module: mod };
  }
  return _crashlytics.module;
}

export async function getPerformance(): Promise<any | null> {
  if (!_perf.available) {
    const mod = await tryImport('@react-native-firebase/perf');
    _perf = { available: !!mod, module: mod };
  }
  return _perf.module;
}

export async function getRemoteConfig(): Promise<any | null> {
  if (!_remoteConfig.available) {
    const mod = await tryImport('@react-native-firebase/remote-config');
    _remoteConfig = { available: !!mod, module: mod };
  }
  return _remoteConfig.module;
}

export async function getMessaging(): Promise<any | null> {
  if (!_messaging.available) {
    const mod = await tryImport('@react-native-firebase/messaging');
    _messaging = { available: !!mod, module: mod };
  }
  return _messaging.module;
}
