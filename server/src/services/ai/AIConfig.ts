/**
 * AI Engine Configuration
 *
 * All configurable AI parameters — environment-variable driven.
 * No hardcoded business values beyond sensible defaults.
 */

export const AIConfig = {
  // ── Provider selection ───────────────────────────────────────────
  get mode() { return process.env.AI_PROVIDER_MODE ?? 'primary'; },
  get primaryProvider() { return (process.env.AI_PRIMARY_PROVIDER ?? process.env.AI_PROVIDER ?? 'claude').toLowerCase(); },
  get fallbackProvider() { return (process.env.AI_FALLBACK_PROVIDER ?? 'deepseek').toLowerCase(); },
  get enableFallback() { return process.env.AI_ENABLE_FALLBACK !== 'false'; },

  // ── Retry ────────────────────────────────────────────────────────
  get maxRetries() { return parseInt(process.env.AI_MAX_RETRIES ?? '2', 10); },
  get retryBaseDelayMs() { return parseInt(process.env.AI_RETRY_BASE_DELAY_MS ?? '800', 10); },
  get retryMaxDelayMs() { return parseInt(process.env.AI_RETRY_MAX_DELAY_MS ?? '5000', 10); },
  // 429 rate-limit backoff is longer — provider needs time to reset the window
  get rateLimitBaseDelayMs() { return parseInt(process.env.AI_RATELIMIT_BASE_DELAY_MS ?? '5000', 10); },
  get rateLimitMaxDelayMs() { return parseInt(process.env.AI_RATELIMIT_MAX_DELAY_MS ?? '20000', 10); },

  // ── Timeouts ─────────────────────────────────────────────────────
  get requestTimeoutMs() { return parseInt(process.env.AI_REQUEST_TIMEOUT_MS ?? '45000', 10); },
  get totalTimeoutMs() { return parseInt(process.env.AI_TOTAL_TIMEOUT_MS ?? '70000', 10); },

  // ── Limits ───────────────────────────────────────────────────────
  get maxFieldLength() { return parseInt(process.env.AI_MAX_FIELD_LENGTH ?? '5000', 10); },
  get maxTotalInputLength() { return parseInt(process.env.AI_MAX_TOTAL_INPUT_LENGTH ?? '20000', 10); },
  get maxTemplateLength() { return parseInt(process.env.AI_MAX_TEMPLATE_LENGTH ?? '15000', 10); },

  // ── Cache ────────────────────────────────────────────────────────
  get cacheEnabled() { return process.env.AI_CACHE_ENABLED === 'true'; },
  get cacheTTLSeconds() { return parseInt(process.env.AI_CACHE_TTL_SECONDS ?? '3600', 10); },
  get dedupWindowSeconds() { return parseInt(process.env.AI_DEDUP_WINDOW_SECONDS ?? '30', 10); },

  // ── Circuit breaker ──────────────────────────────────────────────
  get circuitFailureThreshold() { return parseInt(process.env.AI_CIRCUIT_FAILURE_THRESHOLD ?? '5', 10); },
  get circuitResetMs() { return parseInt(process.env.AI_CIRCUIT_RESET_MS ?? '60000', 10); },

  // ── Models ───────────────────────────────────────────────────────
  models: {
    claude: 'claude-sonnet-5-20251001',
    deepseek: 'deepseek-v4-flash',
  },

  // ── Pricing ($ per 1M tokens — approximate, update from official pages) ──
  pricing: {
    claude: { input: 3.00, output: 15.00 },
    deepseek: { input: 0.27, output: 1.10 },
  },
} as const;

export default AIConfig;
