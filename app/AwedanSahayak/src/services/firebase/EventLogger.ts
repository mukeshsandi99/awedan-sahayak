/**
 * Firebase Analytics — Privacy-Safe Event Logger
 *
 * All analytics events flow through this module. This ensures:
 *   - NO personal data (name, address, phone, Aadhaar) ever logged
 *   - NO application content (generated text, OCR raw text)
 *   - NO API keys or secrets
 *   - Consistent event naming across the app
 *   - Graceful no-op when Firebase is unavailable
 *
 * Event naming convention: snake_case with category_prefix
 *   app_*       — App lifecycle
 *   gen_*       — Application generation
 *   ai_*        — AI/LLM operations
 *   ocr_*       — OCR/scanning
 *   billing_*   — Purchases/subscriptions
 *   ad_*        — AdMob events
 *   error_*     — Errors
 */

import { isFirebaseAvailable } from './Firebase';

// ── Types ────────────────────────────────────────────────────────────────

export type EventParams = Record<string, string | number | boolean>;

// ── Internal ─────────────────────────────────────────────────────────────

async function logEvent(eventName: string, params?: EventParams): Promise<void> {
  if (!isFirebaseAvailable()) return;

  try {
    const { getAnalytics } = await import('./FirebaseImports');
    const analytics = await getAnalytics();
    if (!analytics) return;
    await analytics().logEvent(eventName, params ?? {});
  } catch {
    // Silent — analytics should never crash the app
  }
}

// ── Public API ───────────────────────────────────────────────────────────

export const EventLogger = {
  // ── App Lifecycle ──────────────────────────────────────────────────

  appOpen(): Promise<void> {
    return logEvent('app_open');
  },

  appClose(): Promise<void> {
    return logEvent('app_close');
  },

  screenView(screenName: string): Promise<void> {
    return logEvent('screen_view', { screen_name: screenName });
  },

  // ── Application Generation ─────────────────────────────────────────

  applicationGenerated(officeType: string, isCustom: boolean, provider: string): Promise<void> {
    return logEvent('gen_application', {
      office_type: officeType,
      is_custom: isCustom ? 1 : 0,
      provider,
    });
  },

  applicationPreviewed(): Promise<void> {
    return logEvent('gen_preview');
  },

  pdfExported(): Promise<void> {
    return logEvent('gen_pdf_export');
  },

  pdfShared(): Promise<void> {
    return logEvent('gen_pdf_share');
  },

  rtfExported(): Promise<void> {
    return logEvent('gen_rtf_export');
  },

  // ── AI Operations ──────────────────────────────────────────────────

  aiRequestStarted(officeType: string): Promise<void> {
    return logEvent('ai_request_start', { office_type: officeType });
  },

  aiRequestCompleted(provider: string, durationMs: number, textLength: number): Promise<void> {
    return logEvent('ai_request_done', {
      provider,
      duration_ms: Math.round(durationMs),
      text_length: textLength,
    });
  },

  aiRequestFailed(reason: string): Promise<void> {
    return logEvent('ai_request_fail', { reason });
  },

  // ── OCR Operations ─────────────────────────────────────────────────

  ocrStarted(type: 'aadhar' | 'handwriting'): Promise<void> {
    return logEvent('ocr_start', { ocr_type: type });
  },

  ocrSuccess(type: 'aadhar' | 'handwriting', durationMs: number): Promise<void> {
    return logEvent('ocr_success', {
      ocr_type: type,
      duration_ms: Math.round(durationMs),
    });
  },

  ocrFailed(type: 'aadhar' | 'handwriting', reason: string): Promise<void> {
    return logEvent('ocr_fail', { ocr_type: type, reason });
  },

  // ── Billing ────────────────────────────────────────────────────────

  purchaseInitiated(productId: string): Promise<void> {
    return logEvent('billing_purchase_start', { product_id: productId });
  },

  purchaseCompleted(productId: string): Promise<void> {
    return logEvent('billing_purchase_done', { product_id: productId });
  },

  purchaseFailed(productId: string, reason: string): Promise<void> {
    return logEvent('billing_purchase_fail', { product_id: productId, reason });
  },

  subscriptionRestored(): Promise<void> {
    return logEvent('billing_restore');
  },

  // ── AdMob ──────────────────────────────────────────────────────────

  adImpression(adType: string): Promise<void> {
    return logEvent('ad_impression', { ad_type: adType });
  },

  adRewardedCompleted(): Promise<void> {
    return logEvent('ad_rewarded_done');
  },

  adNoFill(adType: string): Promise<void> {
    return logEvent('ad_no_fill', { ad_type: adType });
  },

  // ── Errors ─────────────────────────────────────────────────────────

  appError(category: string, message: string): Promise<void> {
    return logEvent('error_app', { category, message: message.substring(0, 100) });
  },

  networkError(endpoint: string): Promise<void> {
    return logEvent('error_network', { endpoint });
  },

  // ── Voice ──────────────────────────────────────────────────────────

  voiceInputUsed(): Promise<void> {
    return logEvent('voice_input');
  },
};

export default EventLogger;
