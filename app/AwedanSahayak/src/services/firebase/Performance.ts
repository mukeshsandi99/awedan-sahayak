/**
 * Firebase Performance Monitoring
 *
 * Measures key app performance metrics. All traces are optional —
 * the app functions identically when Performance is unavailable.
 *
 * NEVER includes PII in trace attributes — only numeric durations
 * and generic string labels (e.g., provider name, endpoint path).
 */

import { isFirebaseAvailable } from './Firebase';

// ── Internal ─────────────────────────────────────────────────────────────

async function getPerf() {
  if (!isFirebaseAvailable()) return null;
  try {
    const { getPerformance } = await import('./FirebaseImports');
    return getPerformance();
  } catch {
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────

async function trace(name: string, fn: () => Promise<any>, attributes?: Record<string, string>): Promise<any> {
  const perf = await getPerf();
  if (!perf) return fn();

  const t = perf().newTrace(name);
  try {
    if (attributes) {
      for (const [k, v] of Object.entries(attributes)) {
        t.putAttribute(k, v);
      }
    }
    await t.start();
    const result = await fn();
    await t.stop();
    return result;
  } catch (err: any) {
    await t.stop();
    throw err;
  }
}

export const Performance = {
  /** Measure app startup time. Call once in App.tsx after DB init. */
  async measureStartup(): Promise<void> {
    // startup is pre-measured by Firebase SDK — this is a marker
    const perf = await getPerf();
    if (!perf) return;
    try {
      const t = perf().newTrace('app_startup');
      await t.start();
      await t.putAttribute('source', 'cold_start');
      await t.stop();
    } catch { /* silent */ }
  },

  /** Measure AI response time. Wraps the actual API call. */
  async measureAiRequest<T>(provider: string, fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
    const start = Date.now();
    const result = await trace('ai_request', fn, { provider });
    const durationMs = Date.now() - start;
    return { result, durationMs };
  },

  /** Measure OCR processing time. */
  async measureOcr(type: string, fn: () => Promise<any>): Promise<{ result: any; durationMs: number }> {
    const start = Date.now();
    const result = await trace('ocr_processing', fn, { ocr_type: type });
    const durationMs = Date.now() - start;
    return { result, durationMs };
  },

  /** Measure PDF generation time. */
  async measurePdf(fn: () => Promise<any>): Promise<any> {
    return trace('pdf_generation', fn);
  },

  /** Measure API latency for any call. */
  async measureApiLatency(endpoint: string, fn: () => Promise<any>): Promise<any> {
    return trace('api_latency', fn, { endpoint });
  },
};

export default Performance;
