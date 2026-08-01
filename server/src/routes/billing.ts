/**
 * POST /api/billing/verify-subscription
 * POST /api/billing/verify-product
 *
 * Server-side Google Play purchase verification endpoints.
 * Protected by X-App-Token authentication.
 */

import { Router, Request, Response } from 'express';
import { createLogger } from '../config/logger';
import {
  verifySubscriptionToken,
  atomicProcessProduct,
} from '../services/billingService';

const log = createLogger('Billing');

export const billingRouter = Router();

// ── Validation helpers ───────────────────────────────────────────────────

function validateTokenRequest(body: any): { valid: true; data: { productId: string; purchaseToken: string; packageName?: string; orderId?: string } } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }
  if (!body.productId || typeof body.productId !== 'string') {
    return { valid: false, error: 'Missing or invalid "productId".' };
  }
  if (!body.purchaseToken || typeof body.purchaseToken !== 'string' || body.purchaseToken.trim().length === 0) {
    return { valid: false, error: 'Missing or invalid "purchaseToken".' };
  }
  return {
    valid: true,
    data: {
      productId: body.productId.trim(),
      purchaseToken: body.purchaseToken.trim(),
      packageName: body.packageName?.trim() || undefined,
      orderId: body.orderId?.trim() || undefined,
    },
  };
}

// ── POST /verify-subscription ────────────────────────────────────────────

billingRouter.post('/billing/verify-subscription', async (req: Request, res: Response) => {
  log.info('[POST /verify-subscription] Received.');

  const validation = validateTokenRequest(req.body);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const { productId, purchaseToken, packageName, orderId } = validation.data;

  const result = await verifySubscriptionToken({
    productId,
    purchaseToken,
    packageName,
    orderId,
  });

  // Never return raw Google API data — only our safe response type
  res.json({
    valid: result.valid,
    entitlement: result.entitlement,
    expiryTime: result.expiryTime,
    autoRenewing: result.autoRenewing,
    acknowledgementRequired: result.acknowledgementRequired,
    ...(result.reason ? { reason: result.reason } : {}),
  });
});

// ── POST /process-product (ATOMIC) ──────────────────────────────────────
//
// Single atomic operation: verify + credit ledger + consume via Google Play.
// Replaces the old unsafe two-step verify-then-confirm-credited flow.

billingRouter.post('/billing/process-product', async (req: Request, res: Response) => {
  log.info('[POST /process-product] Received.');

  const validation = validateTokenRequest(req.body);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const { productId, purchaseToken } = validation.data;

  const result = await atomicProcessProduct(purchaseToken, productId);

  // Never return raw Google API data — only our safe response type
  res.json({
    processed: result.processed,
    ...(result.reason ? { reason: result.reason } : {}),
  });
});
