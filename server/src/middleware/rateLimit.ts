/**
 * Rate Limiting Middleware
 *
 * Three-tier rate limiting for abuse protection:
 *
 *   GENERAL — 100 req / 15 min per IP for all /api/* routes
 *   AI      —  10 req / 15 min per IP for AI generation endpoints
 *   OCR     —  10 req / 30 min per IP for OCR/image endpoints
 *
 * All limits are configurable via environment variables.
 * Health endpoint (GET /api/health) is NEVER rate-limited.
 *
 * 429 Response:
 *   - HTTP 429 Too Many Requests
 *   - Retry-After header (seconds until reset)
 *   - Safe Hindi + English message
 *   - No internal state, IP, or stack trace in response
 */

import rateLimit from 'express-rate-limit';
import { createLogger } from '../config/logger';
import { getEnvConfig } from '../config/env';

const log = createLogger('RateLimit');

// ── Default limits ───────────────────────────────────────────────────────

const DEFAULTS = {
  GENERAL_WINDOW_MS: 900_000,   // 15 minutes
  GENERAL_MAX: 100,
  AI_WINDOW_MS: 900_000,        // 15 minutes
  AI_MAX: 10,
  OCR_WINDOW_MS: 1_800_000,     // 30 minutes
  OCR_MAX: 10,
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────

function parseIntEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createLimiter(windowMs: number, max: number, label: string) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,    // RateLimit-* headers
    legacyHeaders: false,     // X-RateLimit-* headers (deprecated)
    skipSuccessfulRequests: false,
    message: {
      error:
        'बहुत अधिक अनुरोध किए गए हैं। कृपया कुछ समय बाद पुनः प्रयास करें।\n' +
        'Too many requests. Please try again later.',
    },
    handler: (req, res, _next, _options) => {
      // Safe audit log — no IP, no token, no body
      log.warn(
        `[RATE_LIMIT] ${req.method} ${req.path} — 429 — ${label} limit exceeded`,
      );
      res.status(429).json({
        error:
          'बहुत अधिक अनुरोध किए गए हैं। कृपया कुछ समय बाद पुनः प्रयास करें।\n' +
          'Too many requests. Please try again later.',
      });
    },
  });
}

// ── Limiters (lazily created on first import) ────────────────────────────

let _generalLimiter: ReturnType<typeof rateLimit> | null = null;
let _aiLimiter: ReturnType<typeof rateLimit> | null = null;
let _ocrLimiter: ReturnType<typeof rateLimit> | null = null;

/** General API limiter — applies to all /api/* routes. */
export function generalLimiter() {
  if (_generalLimiter) return _generalLimiter;
  const windowMs = parseIntEnv('RATE_LIMIT_GENERAL_WINDOW_MS', DEFAULTS.GENERAL_WINDOW_MS);
  const max = parseIntEnv('RATE_LIMIT_GENERAL_MAX', DEFAULTS.GENERAL_MAX);
  log.info(`General rate limit: ${max} req / ${(windowMs / 60000).toFixed(0)} min`);
  _generalLimiter = createLimiter(windowMs, max, 'general');
  return _generalLimiter;
}

/** AI generation limiter — generate-application, generate-custom-application, cleanup-ocr. */
export function aiLimiter() {
  if (_aiLimiter) return _aiLimiter;
  const windowMs = parseIntEnv('RATE_LIMIT_AI_WINDOW_MS', DEFAULTS.AI_WINDOW_MS);
  const max = parseIntEnv('RATE_LIMIT_AI_MAX', DEFAULTS.AI_MAX);
  log.info(`AI rate limit: ${max} req / ${(windowMs / 60000).toFixed(0)} min`);
  _aiLimiter = createLimiter(windowMs, max, 'ai');
  return _aiLimiter;
}

/** OCR limiter — ocr-aadhar, scan-document. */
export function ocrLimiter() {
  if (_ocrLimiter) return _ocrLimiter;
  const windowMs = parseIntEnv('RATE_LIMIT_OCR_WINDOW_MS', DEFAULTS.OCR_WINDOW_MS);
  const max = parseIntEnv('RATE_LIMIT_OCR_MAX', DEFAULTS.OCR_MAX);
  log.info(`OCR rate limit: ${max} req / ${(windowMs / 60000).toFixed(0)} min`);
  _ocrLimiter = createLimiter(windowMs, max, 'ocr');
  return _ocrLimiter;
}
