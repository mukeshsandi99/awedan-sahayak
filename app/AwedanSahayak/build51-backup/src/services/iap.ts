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
  getAvailablePurchases,
  PurchaseError,
  type Product,
  type Purchase,
} from 'react-native-iap';
import { IAP_SKU_MONTHLY, IAP_SKU_SINGLE, IAP_SKUS } from '../config';
import {
  setSubscriptionActive,
  addPaidCredits,
} from './usageTracker';
import { apiPost } from './apiClient';

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
        // Server-side verification for listener purchases (auto-renewals, etc.)
        // RULE: Never acknowledge/finish an unverified purchase.
        if (purchase.productId === IAP_SKU_MONTHLY) {
          const verification = await verifyWithServer(purchase, 'subscription');

          if (!verification?.valid || verification.entitlement !== 'active') {
            console.warn('[IAP] Listener: server verification FAILED for', purchase.productId);
            // Do NOT acknowledge — leave purchase pending
            return;
          }

          if (!verification.expiryTime) {
            console.warn('[IAP] Listener: server did not provide expiryTime — cannot activate.');
            return;
          }

          // Grant entitlement FIRST, then acknowledge
          const expiryDate = new Date(verification.expiryTime);
          await setSubscriptionActive(purchase.productId, token, expiryDate.toISOString());
          await finishTransaction({ purchase, isConsumable: false });
          if (token) processedTokens.add(token);
          console.log('[IAP] ✅ Subscription renewed via listener (server-verified).');
        } else if (purchase.productId === IAP_SKU_SINGLE) {
          // One-time consumable via listener — use atomic server processing
          const result2 = await apiPost('/api/billing/process-product', {
            productId: purchase.productId,
            purchaseToken: token,
          });

          if (!result2.ok || !(result2.data as any)?.processed) {
            console.warn('[IAP] Listener: product processing FAILED — not granting credit.');
            return;
          }

          await addPaidCredits(1);
          await finishTransaction({ purchase, isConsumable: true }).catch(() => {});
          if (token) processedTokens.add(token);
          console.log('[IAP] ✅ 1 credit granted via listener (server-processed).');
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
 * Initiate the monthly subscription purchase (₹149/month).
 *
 * FLOW (correct order):
 *   Request purchase → Google Play returns purchase →
 *   Server verify (Google Play Developer API) →
 *   Only if PURCHASED + active: grant entitlement →
 *   Then (and only then) acknowledge/finish transaction.
 *
 * NEVER acknowledges or finishes a purchase that hasn't been verified.
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
    const purchase: Purchase | null = Array.isArray(result) ? result[0] ?? null : (result ?? null);

    if (!purchase) {
      console.log('[IAP] Subscription purchase returned null (user cancelled or pending).');
      return false;
    }

    console.log('[IAP] Subscription purchase received:', purchase.productId);

    // STEP 1: Verify with server (Google Play Developer API).
    //         Do NOT acknowledge or finish until verification passes.
    const verification = await verifyWithServer(purchase, 'subscription');

    if (!verification) {
      // Server unreachable — do NOT grant premium, do NOT finish the purchase.
      // The purchase stays in pending state. On next app launch/restore, retry.
      console.warn('[IAP] ⚠️  Server unreachable — subscription NOT activated. Purchase remains pending.');
      throw new Error('VERIFICATION_FAILED');
    }

    if (!verification.valid) {
      console.warn('[IAP] ❌ Server verification failed:', verification.reason);
      // Do NOT acknowledge — let Google Play handle (user may be refunded).
      return false;
    }

    if (verification.entitlement !== 'active') {
      console.warn(`[IAP] ❌ Subscription state is "${verification.entitlement}" — not granting premium.`);
      // Still acknowledge so Google Play doesn't auto-refund
      await finishTransaction({ purchase, isConsumable: false }).catch(() => {});
      return false;
    }

    // STEP 2: Verification passed + active → grant entitlement
    const token = (purchase as any).purchaseToken ?? (purchase as any).transactionReceipt ?? '';
    if (!verification.expiryTime) {
      // Server MUST provide expiry time — never make up a fallback
      console.warn('[IAP] ⚠️  Server did not provide expiryTime — cannot activate safely.');
      return false;
    }

    const expiryDate = new Date(verification.expiryTime);
    await setSubscriptionActive(purchase.productId, token, expiryDate.toISOString());

    // STEP 3: NOW acknowledge with Google Play
    await finishTransaction({ purchase, isConsumable: false });
    console.log('[IAP] Subscription acknowledged after successful verification.');

    if (token) processedTokens.add(token);
    console.log('[IAP] ✅ Subscription activated (server-verified). Expires:', expiryDate.toISOString());
    return true;
  } catch (err: any) {
    return handlePurchaseError(err, 'subscription');
  }
}

/**
 * Initiate the one-time ₹11 credit purchase.
 *
 * FLOW (correct order):
 *   Request purchase → Google Play returns purchase →
 *   Server verify + atomically process (verify + mark credited + consume) →
 *   Only if server says processed=true: grant 1 local credit.
 *
 * NEVER grants credit on an unverified or server-unreachable purchase.
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
    const purchase: Purchase | null = Array.isArray(result) ? result[0] ?? null : (result ?? null);

    if (!purchase) {
      console.log('[IAP] One-time purchase returned null (user cancelled or pending).');
      return false;
    }

    console.log('[IAP] One-time purchase received:', purchase.productId);
    const token = (purchase as any).purchaseToken ?? (purchase as any).transactionReceipt ?? '';

    // STEP 1: Atomic server-side processing (verify + credit + consume in one call)
    const result2 = await apiPost('/api/billing/process-product', {
      productId: purchase.productId,
      purchaseToken: token,
    });

    if (!result2.ok) {
      console.warn('[IAP] Server process-product failed:', result2.error);
      // Do NOT finish/consume locally. Purchase remains pending.
      return false;
    }

    const response = result2.data as any;

    if (!response?.processed) {
      console.warn('[IAP] Server did not process purchase:', response?.reason);
      return false;
    }

    // STEP 2: Server confirmed atomic processing — now grant local credit
    await addPaidCredits(1);

    // STEP 3: Finalize on-device (server already consumed via Google API)
    await finishTransaction({ purchase, isConsumable: true }).catch(() => {});
    if (token) processedTokens.add(token);

    console.log('[IAP] ✅ 1 credit granted (server-verified + atomically processed).');
    return true;
  } catch (err: any) {
    return handlePurchaseError(err, 'one-time');
  }
}

// ── Server-side receipt verification ────────────────────────────────────

/**
 * Verifies a purchase token with our backend, which calls the
 * Google Play Developer API. This is the AUTHORITATIVE check —
 * local state is never trusted alone.
 *
 * @returns verification result from the server, or null if unreachable.
 */
async function verifyWithServer(
  purchase: Purchase,
  type: 'subscription' | 'product',
): Promise<{ valid: boolean; reason?: string; entitlement?: string; expiryTime?: string | null; autoRenewing?: boolean; alreadyCredited?: boolean } | null> {
  try {
    const token =
      (purchase as any).purchaseToken ??
      (purchase as any).transactionReceipt ??
      '';

    if (!token) {
      console.warn('[IAP] No purchaseToken found — cannot verify.');
      return null;
    }

    const endpoint =
      type === 'subscription'
        ? '/api/billing/verify-subscription'
        : '/api/billing/verify-product';

    const result = await apiPost(endpoint, {
      productId: purchase.productId,
      purchaseToken: token,
    });

    if (!result.ok) {
      console.warn(`[IAP] Server verification HTTP ${result.status}:`, result.error);
      return null; // Server unreachable — caller handles gracefully
    }

    return result.data as any;
  } catch (err: any) {
    console.warn('[IAP] Server verification network error:', err?.message);
    return null; // Network error — caller handles gracefully
  }
}

/**
 * ⚠️ DELIBERATELY REMOVED — The old `validatePurchaseLocally` stub
 * that always returned true. All purchases MUST be verified via the
 * backend Google Play Developer API integration.
 *
 * This function no longer exists. Call verifyWithServer() instead.
 */

// ── Restore Purchases ────────────────────────────────────────────────────

export interface RestoreResult {
  success: boolean;
  subscriptionRestored: boolean;
  message: string;
}

/**
 * Restores previously purchased subscriptions from Google Play.
 * Verifies EACH token with the backend. Only active subscriptions
 * are restored; expired/revoked ones are ignored. Consumable purchases
 * are NEVER re-credited.
 */
export async function restorePurchases(): Promise<RestoreResult> {
  if (!iapReady) {
    return {
      success: false,
      subscriptionRestored: false,
      message:
        'Google Play बिलिंग उपलब्ध नहीं है। कृपया Google Play Store ऐप खोलें और साइन इन करें।\n\n' +
        'Google Play Billing is not available. Please open the Play Store app and sign in.',
    };
  }

  try {
    console.log('[IAP] Fetching available purchases...');
    const purchases = await getAvailablePurchases();

    if (!purchases || purchases.length === 0) {
      console.log('[IAP] No available purchases to restore.');
      return {
        success: true,
        subscriptionRestored: false,
        message:
          'कोई पिछली खरीदारी नहीं मिली।\n\n' +
          'No previous purchases found to restore.',
      };
    }

    // Filter subscription purchases only (never restore consumables)
    const subPurchases = purchases.filter(
      (p) => p.productId === IAP_SKU_MONTHLY,
    );

    if (subPurchases.length === 0) {
      return {
        success: true,
        subscriptionRestored: false,
        message: 'कोई सक्रिय सदस्यता नहीं मिली।\n\nNo active subscription found.',
      };
    }

    // Verify each subscription token with the server
    let restored = false;
    for (const purchase of subPurchases) {
      try {
        const verification = await verifyWithServer(purchase, 'subscription');

        if (verification?.valid && verification.entitlement !== 'active') {
          console.log('[IAP] Restore: subscription is', verification.entitlement, '— skipping.');
          continue;
        }

        if (verification?.valid && verification.entitlement === 'active') {
          const token =
            (purchase as any).purchaseToken ??
            (purchase as any).transactionReceipt ??
            '';
          const expiryDate = verification.expiryTime
            ? new Date(verification.expiryTime)
            : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);

          await setSubscriptionActive(purchase.productId, token, expiryDate.toISOString());
          if (token) processedTokens.add(token);
          restored = true;
          console.log('[IAP] ✅ Subscription restored. Expires:', expiryDate.toISOString());
        }
      } catch (err: any) {
        console.warn('[IAP] Restore: failed to verify one purchase:', err?.message);
        // Continue with other purchases
      }
    }

    return {
      success: true,
      subscriptionRestored: restored,
      message: restored
        ? '✅ आपकी सदस्यता पुनर्स्थापित कर दी गई है।\n\nYour subscription has been restored.'
        : 'कोई सक्रिय सदस्यता नहीं मिली। यदि आपने हाल ही में खरीदारी की है तो कृपया कुछ समय बाद प्रयास करें।\n\nNo active subscription found. If you recently subscribed, please try again shortly.',
    };
  } catch (err: any) {
    console.warn('[IAP] Restore purchases failed:', err?.message);
    return {
      success: false,
      subscriptionRestored: false,
      message:
        'खरीदारी पुनर्स्थापित करने में त्रुटि।\n' +
        'कृपया इंटरनेट कनेक्शन जाँचें और Google Play Store में साइन इन रहें।\n\n' +
        'Failed to restore purchases. Please check your internet connection\n' +
        'and ensure you are signed into the Google Play Store.',
    };
  }
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
  VERIFICATION_FAILED:
    'खरीदारी सत्यापित नहीं हो सकी। कृपया इंटरनेट जाँचें और पुनः प्रयास करें।\n' +
    'Purchase verification failed. Please check your internet and try again.',
  TOKEN_REPLAY:
    'यह खरीदारी पहले ही उपयोग की जा चुकी है।\n' +
    'This purchase has already been applied.',
  SUBSCRIPTION_EXPIRED:
    'आपकी सदस्यता समाप्त हो चुकी है। कृपया नई सदस्यता लें।\n' +
    'Your subscription has expired. Please subscribe again.',
  SUBSCRIPTION_REVOKED:
    'आपकी सदस्यता रद्द कर दी गई है।\n' +
    'Your subscription has been revoked.',
  RESTORE_NOT_FOUND:
    'कोई पिछली खरीदारी नहीं मिली।\nNo previous purchases found.',
  SERVER_UNAVAILABLE:
    'सर्वर अनुपलब्ध है। कृपया बाद में पुनः प्रयास करें।\n' +
    'Server unavailable. Please try again later.',
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
