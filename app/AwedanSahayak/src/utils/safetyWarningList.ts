/**
 * Maintained local warning list for Scam Link / UPI Safety Checker.
 *
 * These are known scam domains/patterns maintained in-app.
 * Never fetched from the network — all checks are offline.
 *
 * To update: add entries to SUSPICIOUS_DOMAINS or SUSPICIOUS_KEYWORDS.
 */

/** Known scam/phishing domains (exact match, lowercase). */
export const SUSPICIOUS_DOMAINS: string[] = [
  'upi-payment-verification.xyz',
  'verify-upi-id.tk',
  'kyc-update-required.ml',
  'bank-verification.ga',
  'pm-kisan-benefits.cf',
  'free-recharge-claim.tk',
  'lottery-winner-claim.xyz',
  'govt-scheme-apply.ml',
];

/** Suspicious keywords in URLs (lowercase). */
export const SUSPICIOUS_KEYWORDS: string[] = [
  'verify-upi',
  'update-kyc',
  'claim-reward',
  'free-recharge',
  'lottery-winner',
  'bank-verification',
  'urgent-kyc',
  'account-blocked',
  'upi-verification',
  'pm-kisan-verify',
  'cashback-claim',
  'gift-card-free',
  'job-offer-scam',
  'loan-approval-instant',
];

/** Common URL shorteners (hostname match). */
export const URL_SHORTENERS: string[] = [
  'bit.ly', 'tinyurl.com', 'shorturl.at', 'rb.gy', 'cutt.ly',
  't.co', 'ow.ly', 'buff.ly', 'is.gd', 'shorte.st', 'goo.gl',
  'tiny.cc', 'lnkd.in', 'cli.gs', 'adj.st', 'v.gd',
];

/** Suspicious UPI handles (scam app handles). */
export const SUSPICIOUS_UPI_HANDLES: string[] = [
  'scam',
  'fake',
  'test',
  'demo',
  'free',
  'win',
  'lottery',
  'reward',
  'cash',
  'bonus',
];
