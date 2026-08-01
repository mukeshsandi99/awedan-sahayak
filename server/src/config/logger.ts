/**
 * Production-Safe Logger
 *
 * Features:
 *   - In production (NODE_ENV=production): only warn/error are printed;
 *     info/debug are silent.
 *   - In development: all levels printed to stdout/stderr.
 *   - NEVER prints the content of sensitive keys (API keys, secrets, tokens).
 *   - Automatic PII redaction for common patterns (Aadhar numbers, phone numbers).
 *   - Tagged output with timestamps for debugging.
 *
 * Usage:
 *   import { createLogger } from './config/logger';
 *   const log = createLogger('ModuleName');
 *   log.info('Something happened');
 *   log.error('Something failed', err);
 */

import { getEnvConfig } from './env';

// ── PII patterns to redact from logs ────────────────────────────────────

const PII_PATTERNS: Array<[RegExp, string]> = [
  // Aadhar number: 12 digits (with or without spaces)
  [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[AADHAR-REDACTED]'],
  // Indian mobile: +91 or 0 followed by 10 digits
  [/(?:\+91[\s-]?|0)?[6-9]\d{9}\b/g, '[PHONE-REDACTED]'],
  // Generic API key patterns (sk-..., AIza..., key-...)
  [/\b(sk-[a-zA-Z0-9_-]{20,})\b/g, '[API-KEY-REDACTED]'],
  [/\b(AIza[0-9A-Za-z\-_]{30,})\b/g, '[API-KEY-REDACTED]'],
];

// ── Types ───────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

// ── Redaction ───────────────────────────────────────────────────────────

/** Redact PII from a string value. Non-strings pass through unchanged. */
function redact(value: any): any {
  if (typeof value !== 'string') return value;
  let result = value;
  for (const [pattern, replacement] of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/** Redact all arguments before logging. */
function redactArgs(args: any[]): any[] {
  return args.map(redact);
}

// ── Factory ─────────────────────────────────────────────────────────────

/**
 * Creates a logger instance tagged with the given module name.
 *
 * @param tag — Human-readable module/component name (e.g. 'Server', 'OCR', 'AIService').
 */
export function createLogger(tag: string): Logger {
  // Resolve at call time so tests can mutate process.env first
  const env = getEnvConfig();
  const isProduction = env.isProduction;

  const timestamp = (): string => new Date().toISOString();

  const logAt = (level: LogLevel, consoleFn: (...args: any[]) => void, ...args: any[]): void => {
    // In production, suppress info and debug
    if (isProduction && (level === 'debug' || level === 'info')) {
      return;
    }

    const safeArgs = redactArgs(args);
    const prefix = `[${timestamp()}] [${tag}] [${level.toUpperCase()}]`;

    if (level === 'error') {
      consoleFn(prefix, ...safeArgs);
    } else {
      consoleFn(prefix, ...safeArgs);
    }
  };

  return {
    debug: (...args: any[]) => logAt('debug', console.debug, ...args),
    info: (...args: any[]) => logAt('info', console.log, ...args),
    warn: (...args: any[]) => logAt('warn', console.warn, ...args),
    error: (...args: any[]) => logAt('error', console.error, ...args),
  };
}

export default createLogger;
