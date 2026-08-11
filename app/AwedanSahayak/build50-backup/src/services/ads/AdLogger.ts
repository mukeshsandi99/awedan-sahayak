/**
 * Ad Logger — Safe, privacy-respecting ad event logging.
 * NEVER logs user personal data or full ad response bodies.
 */

// Simple in-memory logger for mobile (no server dependency)
const PREFIX = '[AdMob]';

export const AdLogger = {
  info: (msg: string) => console.log(`${PREFIX} ${msg}`),
  warn: (msg: string) => console.warn(`${PREFIX} ${msg}`),
  error: (msg: string) => console.error(`${PREFIX} ${msg}`),
  impression: (type: string, unitId: string) =>
    console.log(`${PREFIX} Impression: ${type} (${unitId.substring(0, 15)}...)`),
  revenue: (type: string, amount: number, currency: string) =>
    console.log(`${PREFIX} Revenue: ${type} — ${amount} ${currency}`),
  noFill: (type: string) =>
    console.log(`${PREFIX} No fill: ${type}`),
  loadFail: (type: string, error: string) =>
    console.warn(`${PREFIX} Load failed: ${type} — ${error}`),
};
