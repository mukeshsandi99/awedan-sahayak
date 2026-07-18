/**
 * In-App Purchase Service
 *
 * Wrapper around react-native-iap for Google Play Billing integration.
 * Connects purchase flows to the UsageTracker for local state management.
 *
 * IMPORTANT: IAP can only be tested once the app is published to
 * Google Play Console (internal/closed testing track) AND the product
 * SKUs (IAP_SKU_MONTHLY, IAP_SKU_SINGLE) are created in Play Console.
 *
 * Until then, all purchase functions will fail gracefully with
 * "Item unavailable" errors. The free tier (5 applications) works
 * regardless of IAP availability.
 *
 * Server-side receipt verification is a future enhancement —
 * currently we do client-side validation only.
 */

import {
  initConnection,
  endConnection,
  requestPurchase,
  fetchProducts,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  PurchaseError,
  type Product,
  type Purchase,
} from 'react-native-iap';
import { IAP_SKU_MONTHLY, IAP_SKU_SINGLE, IAP_SKUS } from '../config';
import {
  setSubscriptionActive,
  addPaidCredits,
} from './usageTracker';

// ── Module-level state ────────────────────────────────────────────────

let iapReady = false;
let purchaseUpdateSubscription: any = null;
let purchaseErrorSubscription: any = null;

/**
 * Track processed purchase tokens to prevent double-processing.
 * A purchase can arrive via BOTH the direct requestSubscription()/requestPurchase()
 * return AND the purchaseUpdatedListener — this Set ensures we only process once.
 */
const processedTokens = new Set<string>();

/**
 * Last purchase error received via the listener.
 * UI screens can poll getLastPurchaseError() to show error messages.
 */
let lastPurchaseError: { code: string; message: string; timestamp: Date } | null = null;

// ── Lifecycle ─────────────────────────────────────────────────────────

/** Initialize the connection to Google Play Billing. Safe to call multiple times. */
export async function initIAP(): Promise<void> {
  if (iapReady) {
    console.log('[IAP] Already initialized — skipping.');
    return;
  }

  try {
    console.log('[IAP] Connecting to Google Play Billing...');
    await initConnection();

    // ── Wire up purchase listeners ───────────────────────────────────
    setupPurchaseListeners();

    iapReady = true;
    console.log('[IAP] ✅ Connected to Google Play Billing.');
  } catch (err: any) {
    console.warn('[IAP] ⚠️  Connection failed (non-fatal):', err?.message);
    console.warn('[IAP] Free tier still works. IAP requires Play Store + logged-in Google account.');
    iapReady = false;
  }
}

/**
 * Wire up purchase update & error listeners.
 *
 * These listeners react to ALL purchase events — including:
 *   • Purchases initiated by this session (via requestSubscription/requestPurchase)
 *   • Subscription auto-renewals (Google Play renews in the background)
 *   • Pending purchases that complete asynchronously
 *   • Purchase errors from any source
 *
 * A dedup Set (`processedTokens`) prevents double-processing when a purchase
 * arrives through BOTH the direct function return AND this listener.
 */
function setupPurchaseListeners(): void {
  // Tear down any previous listeners (idempotent safety)
  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
    purchaseUpdateSubscription = null;
  }
  if (purchaseErrorSubscription) {
    purchaseErrorSubscription.remove();
    purchaseErrorSubscription = null;
  }

  // ── Purchase update listener ───────────────────────────────────────
  purchaseUpdateSubscription = purchaseUpdatedListener(
    async (purchase: Purchase) => {
      const token: string =
        (purchase as any).purchaseToken ??
        (purchase as any).transactionReceipt ??
        '';

      console.log('[IAP] 📦 Purchase update via listener:', purchase.productId);

      // Skip if already processed by the direct purchase flow
      if (token && processedTokens.has(token)) {
        console.log('[IAP] ⏭️  Token already processed — skipping listener handler.');
        return;
      }

      try {
        // Validate receipt before trusting the purchase
        const isValid = await validatePurchaseLocally(purchase);
        if (!isValid) {
          console.warn('[IAP] Listener: receipt validation FAILED for', purchase.productId);
          return;
        }

        // ── Handle by product type ───────────────────────────────────
        if (purchase.productId === IAP_SKU_MONTHLY) {
          // Subscription: new purchase OR auto-renewal
          await finishTransaction({ purchase, isConsumable: false });

          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 31);
          await setSubscriptionActive(
            purchase.productId,
            token,
            expiryDate.toISOString(),
          );

          if (token) processedTokens.add(token);
          console.log('[IAP] ✅ Subscription activated/renewed via listener. Expires:', expiryDate.toISOString());
        } else if (purchase.productId === IAP_SKU_SINGLE) {
          // One-time consumable: grant credit
          await finishTransaction({ purchase, isConsumable: true });
          await addPaidCredits(1);

          if (token) processedTokens.add(token);
          console.log('[IAP] ✅ 1 credit granted via listener.');
        } else {
          console.warn('[IAP] Listener: unrecognised productId:', purchase.productId);
        }
      } catch (err: any) {
        console.warn('[IAP] Listener: error processing purchase:', err?.message);
      }
    },
  );

  // ── Purchase error listener ────────────────────────────────────────
  purchaseErrorSubscription = purchaseErrorListener(
    (error: PurchaseError) => {
      const code = error?.code ?? 'UNKNOWN';
      const message = error?.message ?? String(error);

      console.warn(`[IAP] ❌ Purchase error via listener [${code}]:`, message);
      lastPurchaseError = { code, message, timestamp: new Date() };
    },
  );

  console.log('[IAP] 👂 Purchase listeners set up.');
}

/** Tear down the IAP connection. Call on app unmount. */
export async function cleanupIAP(): Promise<void> {
  try {
    if (purchaseUpdateSubscription) {
      purchaseUpdateSubscription.remove();
      purchaseUpdateSubscription = null;
    }
    if (purchaseErrorSubscription) {
      purchaseErrorSubscription.remove();
      purchaseErrorSubscription = null;
    }
    // Clear runtime dedup/error state
    processedTokens.clear();
    lastPurchaseError = null;
    if (iapReady) {
      await endConnection();
      iapReady = false;
      console.log('[IAP] Connection closed.');
    }
  } catch (err: any) {
    console.warn('[IAP] Cleanup error:', err?.message);
  }
}

/** Whether IAP is available (Play Store is present and connected). */
export function isIAPReady(): boolean {
  return iapReady;
}

// ── Product queries ──────────────────────────────────────────────────

/**
 * Fetch product details from Google Play Store.
 * Returns an empty array if IAP is unavailable or products don't exist yet.
 */
export async function getProductDetails(): Promise<Product[]> {
  if (!iapReady) {
    console.warn('[IAP] Not connected — cannot fetch products.');
    return [];
  }

  try {
    const products = await fetchProducts({ skus: [...IAP_SKUS] });
    const productList = products ?? [];
    console.log('[IAP] Fetched', productList.length, 'product(s).');
    // Log prices for debugging
    for (const p of productList) {
      console.log(`[IAP]   ${p.id}: ${p.displayPrice ?? p.price} (${p.type})`);
    }
    return productList as Product[];
  } catch (err: any) {
    console.warn('[IAP] getProducts failed:', err?.message);
    return [];
  }
}

// ── Purchase flows ────────────────────────────────────────────────────

/**
 * Initiate the monthly subscription purchase (₹100/month).
 * Returns true if the purchase completed successfully and was
 * acknowledged locally.
 */
export async function purchaseMonthlySubscription(): Promise<boolean> {
  if (!iapReady) {
    console.warn('[IAP] Cannot purchase — IAP not connected.');
    return false;
  }

  try {
    console.log('[IAP] Requesting subscription:', IAP_SKU_MONTHLY);
    const result = await requestPurchase({
      request: { google: { skus: [IAP_SKU_MONTHLY] } },
      type: 'subs',
    });
    // result can be Purchase | Purchase[] | null — normalise to single Purchase
    const purchase: Purchase | null = Array.isArray(result) ? result[0] ?? null : (result ?? null);

    if (!purchase) {
      console.log('[IAP] Subscription purchase returned null (user cancelled or pending).');
      return false;
    }

    console.log('[IAP] Subscription purchase received:', purchase.productId);

    // Client-side receipt validation
    const isValid = await validatePurchaseLocally(purchase);
    if (!isValid) {
      console.warn('[IAP] Receipt validation failed — not acknowledging.');
      return false;
    }

    // Acknowledge with Google Play
    await finishTransaction({
      purchase,
      isConsumable: false, // subscriptions are NOT consumable
    });
    console.log('[IAP] Subscription transaction finished (acknowledged).');

    // Update local state: mark subscription as active
    // Subscription expiry: Google Play subscriptions auto-renew,
    // we set a 31-day window as fallback expiry.
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 31);
    const token = (purchase as any).purchaseToken ?? (purchase as any).transactionReceipt ?? '';
    await setSubscriptionActive(
      purchase.productId,
      token,
      expiryDate.toISOString(),
    );

    // Mark as processed so the listener doesn't double-handle
    if (token) processedTokens.add(token);

    console.log('[IAP] ✅ Subscription activated locally.');
    return true;
  } catch (err: any) {
    return handlePurchaseError(err, 'subscription');
  }
}

/**
 * Initiate the one-time ₹10 credit purchase.
 * Returns true if the purchase completed successfully and credit was granted.
 */
export async function purchaseSingleApplication(): Promise<boolean> {
  if (!iapReady) {
    console.warn('[IAP] Cannot purchase — IAP not connected.');
    return false;
  }

  try {
    console.log('[IAP] Requesting one-time purchase:', IAP_SKU_SINGLE);
    const result = await requestPurchase({
      request: { google: { skus: [IAP_SKU_SINGLE] } },
      type: 'in-app',
    });
    // result can be Purchase | Purchase[] | null — normalise to single Purchase
    const purchase: Purchase | null = Array.isArray(result) ? result[0] ?? null : (result ?? null);

    if (!purchase) {
      console.log('[IAP] One-time purchase returned null (user cancelled or pending).');
      return false;
    }

    console.log('[IAP] One-time purchase received:', purchase.productId);

    // Client-side receipt validation
    const isValid = await validatePurchaseLocally(purchase);
    if (!isValid) {
      console.warn('[IAP] Receipt validation failed — not acknowledging.');
      return false;
    }

    // Acknowledge AND consume with Google Play (consumable product)
    await finishTransaction({
      purchase,
      isConsumable: true, // consumable — user can buy again
    });
    console.log('[IAP] One-time purchase transaction finished (consumed).');

    // Grant 1 credit locally
    await addPaidCredits(1);

    // Mark as processed so the listener doesn't double-handle
    const token = (purchase as any).purchaseToken ?? (purchase as any).transactionReceipt ?? '';
    if (token) processedTokens.add(token);

    console.log('[IAP] ✅ 1 credit granted to user.');

    return true;
  } catch (err: any) {
    return handlePurchaseError(err, 'one-time');
  }
}

// ── Receipt validation ────────────────────────────────────────────────

/**
 * Client-side receipt validation stub.
 *
 * IMPORTANT: react-native-iap v15 removed the local `validateReceiptAndroid`
 * function. The replacement `validateReceipt` requires a Google OAuth2
 * `accessToken` for server-side validation against the Google Play Developer API.
 *
 * TODO (production): Integrate server-side verification via your backend
 * using the Google Play Developer API. Until then, we accept all purchases
 * (a determined attacker can bypass this — same as the pre-v15 behavior).
 *
 * @returns always true (stub)
 */
async function validatePurchaseLocally(_purchase: Purchase): Promise<boolean> {
  // Server-side verification not yet implemented — accept all purchases.
  // The previous implementation (validateReceiptAndroid) also returned true
  // on any error, so this preserves existing behavior.
  console.log('[IAP] Local receipt validation skipped (server-side verification TODO).');
  return true;
}

// ── Error handling ────────────────────────────────────────────────────

/** Map of common IAP error codes to Hindi user messages. */
const IAP_ERROR_MESSAGES: Record<string, string> = {
  E_USER_CANCELLED: 'खरीदारी रद्द कर दी गई। (Purchase cancelled.)',
  E_ITEM_UNAVAILABLE: 'यह उत्पाद अभी उपलब्ध नहीं है। बाद में पुनः प्रयास करें।\n(Product not available. Try again later.)',
  E_NETWORK_ERROR: 'नेटवर्क त्रुटि। कृपया इंटरनेट कनेक्शन जाँचें।\n(Network error. Check your connection.)',
  E_SERVICE_ERROR: 'Google Play सेवा में त्रुटि। बाद में पुनः प्रयास करें।\n(Play Store service error. Try later.)',
  E_DEVELOPER_ERROR: 'भुगतान सेटअप में त्रुटि। कृपया बाद में प्रयास करें।\n(Payment setup error.)',
  E_BILLING_UNAVAILABLE: 'Google Play बिलिंग उपलब्ध नहीं है।\n(Billing unavailable.)',
  E_ITEM_ALREADY_OWNED: 'आप पहले से ही इस उत्पाद के मालिक हैं।\n(You already own this product.)',
};

/**
 * Handle a purchase error: log it and return false.
 * User-facing errors are handled by the calling screen.
 */
function handlePurchaseError(err: any, purchaseType: string): false {
  const code: string = err?.code ?? err?.message ?? '';
  const knownMessage = IAP_ERROR_MESSAGES[code];

  if (code === 'E_USER_CANCELLED') {
    console.log(`[IAP] ${purchaseType} purchase cancelled by user.`);
  } else if (knownMessage) {
    console.warn(`[IAP] ${purchaseType} purchase error [${code}]:`, err?.message ?? err);
  } else {
    console.warn(`[IAP] ${purchaseType} purchase unknown error:`, err?.message ?? JSON.stringify(err));
  }

  return false;
}

/**
 * Returns a Hindi user-facing error message for a given error.
 * Use this in UI alert dialogs.
 */
export function getIAPErrorMessage(err: any): string {
  const code: string = err?.code ?? '';
  return IAP_ERROR_MESSAGES[code] ?? (
    'खरीदारी पूरी नहीं हो सकी। कृपया पुनः प्रयास करें।\n' +
    '(Purchase could not be completed. Please try again.)'
  );
}

/**
 * Returns the last purchase error received via the listener (if any),
 * and clears it. UI screens can poll this to show error alerts for
 * purchases that fail outside the direct purchase flow.
 */
export function getLastPurchaseError(): { code: string; message: string; timestamp: Date } | null {
  const err = lastPurchaseError;
  lastPurchaseError = null; // consume once
  return err;
}
