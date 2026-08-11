/**
 * Input validators for utility features. All return boolean.
 * Hindi-first error messages returned by validate* functions.
 */

/** Check if a string looks like a valid URL. */
export function isValidUrl(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  const t = text.trim();
  try {
    const url = new URL(t.startsWith('http') ? t : `https://${t}`);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.');
  } catch {
    return false;
  }
}

/** Check if a string looks like a valid UPI ID (user@handle). */
export function isValidUpiId(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  // UPI ID format: localpart@handle (e.g., user@okhdfcbank, 9999999999@paytm)
  const upiRegex = /^[a-zA-Z0-9._-]{3,30}@[a-zA-Z0-9]{3,20}$/;
  return upiRegex.test(text.trim());
}

/** Check if a string looks like a valid Indian mobile number. */
export function isValidMobile(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  const cleaned = text.trim().replace(/[\s\-+]/g, '');
  return /^[6-9]\d{9}$/.test(cleaned);
}

/** Validate CGPA input (0-10 range with up to 2 decimals). */
export function isValidCgpa(value: string): boolean {
  const n = parseFloat(value);
  return !isNaN(n) && n >= 0 && n <= 10 && /^\d{1,2}(\.\d{1,2})?$/.test(value.trim());
}

/** Validate percentage input (0-100 range with up to 2 decimals). */
export function isValidPercentage(value: string): boolean {
  const n = parseFloat(value);
  return !isNaN(n) && n >= 0 && n <= 100 && /^\d{1,3}(\.\d{1,2})?$/.test(value.trim());
}

/** Validate email format. */
export function isValidEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
}

/** Validate a date string in YYYY-MM-DD format. */
export function isValidDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) return false;
  const d = new Date(text.trim());
  return !isNaN(d.getTime());
}
