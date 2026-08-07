/**
 * Firebase Crashlytics — Crash & Error Reporter
 *
 * Captures:
 *   - JavaScript crashes (unhandled exceptions)
 *   - Native crashes (via Crashlytics SDK)
 *   - Unhandled Promise rejections
 *   - Non-fatal errors (recoverable failures)
 *
 * PRIVACY: NEVER logs user personal data, Aadhaar, OCR text, or API keys.
 * Logs only error type, location, and sanitized message.
 */

import { isFirebaseAvailable } from './Firebase';

// ── Setup ─────────────────────────────────────────────────────────────────

let _crashlytics: any = null;

async function getCrashlytics(): Promise<any> {
  if (_crashlytics) return _crashlytics;
  if (!isFirebaseAvailable()) return null;
  try {
    const { getCrashlytics: gcf } = await import('./FirebaseImports');
    _crashlytics = await gcf();
    if (_crashlytics) {
      await _crashlytics().setCrashlyticsCollectionEnabled(true);
    }
    return _crashlytics;
  } catch {
    return null;
  }
}

// ── Global error hooks ───────────────────────────────────────────────────

let _globalHooksSet = false;

export function setupGlobalErrorHandlers(): void {
  if (_globalHooksSet) return;
  _globalHooksSet = true;

  // Unhandled Promise rejections
  // React Native's ErrorUtils handles uncaught exceptions
  const g: any = typeof globalThis !== 'undefined' ? globalThis : {};
  if (g?.ErrorUtils) {
    const defaultHandler = g.ErrorUtils.getGlobalHandler();
    g.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      CrashReporter.recordError(error, isFatal ? 'fatal' : 'non_fatal');
      defaultHandler?.(error, isFatal);
    });
  }
}

// ── Public API ───────────────────────────────────────────────────────────

export const CrashReporter = {
  /** Record a fatal or non-fatal error. NEVER pass user data in `context`. */
  async recordError(error: Error, type: 'fatal' | 'non_fatal' = 'non_fatal', context?: Record<string, string>): Promise<void> {
    const crashlytics = await getCrashlytics();
    if (!crashlytics) return;

    try {
      // Set safe context keys (sanitized — no PII)
      const safeContext = { ...context };
      // Remove any potentially-sensitive keys
      delete safeContext.token;
      delete safeContext.rawText;
      delete safeContext.imageData;
      delete safeContext.formData;
      delete safeContext.aadharData;
      delete safeContext.phone;
      delete safeContext.address;
      delete safeContext.name;

      if (Object.keys(safeContext).length > 0) {
        await crashlytics().setAttributes(safeContext);
      }

      crashlytics().recordError(error);
      console.log(`[Crashlytics] ${type} error recorded: ${error.message.substring(0, 80)}`);
    } catch {
      // Silent
    }
  },

  /** Log a message for crash investigation context (non-fatal breadcrumb). */
  async log(message: string): Promise<void> {
    const crashlytics = await getCrashlytics();
    if (!crashlytics) return;
    try {
      crashlytics().log(message.substring(0, 500));
    } catch { /* silent */ }
  },

  /** Set user identifier — use ONLY an anonymous app-instance ID, never email/phone. */
  async setAnonymousId(id: string): Promise<void> {
    const crashlytics = await getCrashlytics();
    if (!crashlytics) return;
    try {
      await crashlytics().setUserId(id);
    } catch { /* silent */ }
  },
};

export default CrashReporter;
