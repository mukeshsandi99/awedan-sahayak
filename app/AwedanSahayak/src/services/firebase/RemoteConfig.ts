/**
 * Firebase Remote Config — Dynamic App Configuration
 *
 * Allows updating app behavior WITHOUT an app store release.
 * All values have sensible defaults — Remote Config is additive, not required.
 *
 * Usage:
 *   const limit = await RemoteConfig.getNumber('free_tier_limit', 5);
 */

import { isFirebaseAvailable } from './Firebase';

// ── Defaults (hardcoded as fallbacks) ────────────────────────────────────

const DEFAULTS: Record<string, string | number | boolean> = {
  // Monetization
  free_tier_limit: 5,
  rewarded_daily_max: 5,
  interstitial_every_n: 3,
  interstitial_min_gap_minutes: 3,

  // Banners
  banner_enabled: true,

  // App
  maintenance_mode: false,
  min_app_version: '1.0.0',
  force_update: false,

  // AI
  ai_provider: '', // Empty = use server's default
  ai_timeout_ms: 45000,
};

// ── Cache ─────────────────────────────────────────────────────────────────

let _fetched = false;
let _remoteValues: Record<string, any> = {};

// ── Internal ─────────────────────────────────────────────────────────────

async function getRC() {
  if (!isFirebaseAvailable()) return null;
  try {
    const { getRemoteConfig: grc } = await import('./FirebaseImports');
    const rc = await grc();
    return rc ? rc() : null;
  } catch {
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────

export const RemoteConfig = {
  /** Fetch and activate remote config values. Safe to call on every launch. */
  async fetch(): Promise<void> {
    const rc = await getRC();
    if (!rc) return;

    try {
      await rc.setDefaults(DEFAULTS);
      await rc.fetchAndActivate();
      const all = rc.getAll();
      for (const [key, entry] of Object.entries(all)) {
        _remoteValues[key] = (entry as any)._value ?? entry;
      }
      _fetched = true;
      console.log('[RemoteConfig] ✅ Fetched and activated.');
    } catch (err: any) {
      console.log('[RemoteConfig] ⚠️  Fetch failed (using defaults):', err?.message?.substring(0, 60));
    }
  },

  /** Get a number value. Returns fallback if Remote Config is unavailable. */
  getNumber(key: string, fallback: number): number {
    if (!_fetched) return (DEFAULTS[key] as number) ?? fallback;
    const val = _remoteValues[key];
    return typeof val === 'number' ? val : fallback;
  },

  /** Get a boolean value. */
  getBoolean(key: string, fallback: boolean): boolean {
    if (!_fetched) return (DEFAULTS[key] as boolean) ?? fallback;
    const val = _remoteValues[key];
    return typeof val === 'boolean' ? val : fallback;
  },

  /** Get a string value. */
  getString(key: string, fallback: string): string {
    if (!_fetched) return (DEFAULTS[key] as string) ?? fallback;
    const val = _remoteValues[key];
    return typeof val === 'string' ? val : fallback;
  },

  /** Check if maintenance mode is active (locks non-essential features). */
  isMaintenanceMode(): boolean {
    return this.getBoolean('maintenance_mode', false);
  },

  /** Get minimum required app version. */
  getMinAppVersion(): string {
    return this.getString('min_app_version', '1.0.0');
  },

  /** Whether banner ads are globally enabled. */
  isBannerEnabled(): boolean {
    return this.getBoolean('banner_enabled', true);
  },
};

export default RemoteConfig;
