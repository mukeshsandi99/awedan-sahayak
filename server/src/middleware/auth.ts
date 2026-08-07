/**
 * Authentication Middleware
 *
 * Validates the X-App-Token header against APP_API_SECRET using
 * a timing-safe comparison to prevent timing-based brute-force attacks.
 *
 * SECURITY:
 *   - Missing and wrong tokens receive the SAME generic 401 response.
 *     No information leakage about whether the token was "close" or not.
 *   - Uses Node.js crypto.timingSafeEqual for constant-time comparison.
 *   - Development mode: if APP_API_SECRET is set, auth IS enforced.
 *     If not set, auth is bypassed with a clear startup warning
 *     (from env.ts). This prevents accidentally deploying without auth.
 *
 * LIMITATION:
 *   Static token in a mobile app provides basic abuse protection but
 *   is NOT complete user authentication. Mobile app secrets can be
 *   reverse-engineered. For production, upgrade to short-lived tokens
 *   or user-specific authentication.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getEnvConfig } from '../config/env';
import { createLogger } from '../config/logger';

const log = createLogger('Auth');

// ── Constants ────────────────────────────────────────────────────────────

const AUTH_HEADER = 'x-app-token';

const UNAUTHORIZED_BODY = {
  error:
    'अनधिकृत अनुरोध। कृपया ऐप को पुनः प्रारंभ करें।\n' +
    'Unauthorized request. Please restart the app.',
};

// ── Timing-safe comparison ───────────────────────────────────────────────

/**
 * Compares two strings in constant time to prevent timing attacks.
 *
 * Uses crypto.timingSafeEqual which:
 *   - Takes the same time regardless of how many characters match
 *   - Requires equal-length buffers (we pad the user input first)
 *
 * @param known  — The secret value from the server.
 * @param unknown — The user-supplied value from the header.
 * @returns true if equal, false otherwise.
 */
function timingSafeCompare(known: string, unknown: string): boolean {
  // Pad/crop unknown to match known length so timingSafeEqual works
  const knownBuf = Buffer.from(known, 'utf8');
  const unknownBuf = Buffer.alloc(knownBuf.length);

  // Copy user input bytes (up to known length)
  const copyLen = Math.min(unknown.length, knownBuf.length);
  unknownBuf.write(unknown.substring(0, copyLen), 0, copyLen, 'utf8');

  try {
    return crypto.timingSafeEqual(knownBuf, unknownBuf);
  } catch {
    // Buffer length mismatch (shouldn't happen since we pad)
    return false;
  }
}

// ── Middleware factory ────────────────────────────────────────────────────

/**
 * Creates Express middleware that validates the X-App-Token header.
 *
 * Behavior:
 *   - APP_API_SECRET not configured + development → bypass (warn at startup)
 *   - APP_API_SECRET not configured + production → server startup fails (env.ts)
 *   - APP_API_SECRET configured → always enforce
 *
 * On failure, logs a safe audit entry (no token value, no partial secret).
 *
 * @returns Express middleware function.
 */
export function createAuthMiddleware() {
  const env = getEnvConfig();
  const secret = env.appApiSecret;

  // If no secret is configured, auth is disabled.
  // In production, validateEnv() would have already thrown.
  if (!secret) {
    log.warn(
      '⚠️  APP_API_SECRET not configured — authentication is DISABLED.\n' +
      '    All /api/* endpoints are publicly accessible.\n' +
      '    Set APP_API_SECRET in server/.env to enable authentication.',
    );
    // Return a pass-through middleware
    return (_req: Request, _res: Response, next: NextFunction) => {
      next();
    };
  }

  // Secret is configured — enforce authentication
  log.info('✅ Authentication ENABLED — X-App-Token required for protected endpoints.');

  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers[AUTH_HEADER];

    // ── Missing header ────────────────────────────────────────────────
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      log.warn(
        `[AUTH_FAIL] ${req.method} ${req.path} — ${res.statusCode} — missing X-App-Token header`,
      );
      res.status(401).json(UNAUTHORIZED_BODY);
      return;
    }

    // ── Timing-safe comparison ────────────────────────────────────────
    if (!timingSafeCompare(secret, token.trim())) {
      log.warn(
        `[AUTH_FAIL] ${req.method} ${req.path} — 401 — invalid X-App-Token`,
      );
      res.status(401).json(UNAUTHORIZED_BODY);
      return;
    }

    // ── Valid — proceed ───────────────────────────────────────────────
    // NOTE: Do NOT log successful auth — would flood logs on normal usage
    next();
  };
}

export default createAuthMiddleware;
