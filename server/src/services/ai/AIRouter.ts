/**
 * AI Router — Central AI Request Orchestrator
 *
 * All AI requests flow through this module. It handles:
 *   - Provider selection (primary + fallback)
 *   - Retry with exponential backoff + jitter
 *   - Total deadline enforcement
 *   - Duplicate request detection
 *   - Circuit breaker for failing providers
 *   - Cost tracking
 *   - Safe logging
 *
 * No route should call provider SDKs directly.
 */

import { createLogger } from '../../config/logger';
import { AIConfig } from './AIConfig';
import { IAIProvider, AIRequest, AIGenerateRequest, AICustomGenerateRequest, AIResponse } from './AIProvider';
import { ClaudeProvider } from './ClaudeProvider';
import { DeepSeekProvider } from './DeepSeekProvider';
import { validateInput, validateOutput, qualityScore, AICostTracker } from './AIValidator';
import { validateFacts } from './FactValidator';
import { extractFacts } from './FactExtractor';
import { AICircuitBreaker } from './AICircuitBreaker';
import crypto from 'crypto';

const log = createLogger('AIRouter');

// ── Provider registry ────────────────────────────────────────────────────

const providers: Map<string, IAIProvider> = new Map();

function getProvider(name: string): IAIProvider | null {
  const existing = providers.get(name);
  if (existing) return existing;

  let provider: IAIProvider | null = null;
  if (name === 'claude') {
    provider = new ClaudeProvider();
  } else if (name === 'deepseek') {
    provider = new DeepSeekProvider();
  }

  if (provider) {
    providers.set(name, provider);
    log.info(`Provider registered: ${name} (${provider.model})`);
  }
  return provider;
}

function getPrimaryProvider(): IAIProvider | null {
  return getProvider(AIConfig.primaryProvider);
}

function getFallbackProvider(): IAIProvider | null {
  if (!AIConfig.enableFallback) return null;
  if (AIConfig.fallbackProvider === AIConfig.primaryProvider) return null;
  return getProvider(AIConfig.fallbackProvider);
}

// ── Retry logic ──────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number): number {
  const base = AIConfig.retryBaseDelayMs;
  const max = AIConfig.retryMaxDelayMs;
  const exp = Math.min(base * Math.pow(2, attempt), max);
  const jitter = Math.random() * 0.3 * exp; // 0-30% jitter
  return Math.floor(exp + jitter);
}

function isRetryable(error: any): boolean {
  const msg = error?.message ?? error?.code ?? '';
  const code = error?.status ?? error?.code ?? 0;
  if (code === 429) return true;
  if (code >= 500 && code < 600) return true;
  if (/timeout|timed ?out|ECONNRESET|ETIMEDOUT|ENOTFOUND|network/i.test(msg)) return true;
  return false;
}

function isNonRetryable(error: any): boolean {
  const code = error?.status ?? 0;
  if (code === 400 || code === 401 || code === 403 || code === 404) return true;
  const msg = error?.message ?? '';
  if (/invalid|unsafe|too.?large|auth/i.test(msg)) return true;
  return false;
}

// ── Dedup ────────────────────────────────────────────────────────────────

const inflightRequests = new Map<string, Promise<AIResponse>>();

/**
 * Builds a content-based SHA-256 hash from actual request content.
 * Different content with same length → different hash.
 * Uses Unicode NFC normalization + whitespace trim for consistency.
 * NEVER logs the raw prompt or hash input.
 */
function hashRequest(req: AIRequest): string {
  const normalise = (s: string): string =>
    s.normalize('NFC').replace(/\s+/g, ' ').trim();
  const payload = JSON.stringify({
    op: 'generate',
    sys: normalise(req.systemPrompt),
    user: normalise(req.userMessage),
    max: req.maxTokens ?? 4000,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/** Enforce max concurrent in-flight requests. */
const MAX_INFLIGHT = parseInt(process.env.AI_MAX_INFLIGHT_REQUESTS ?? '100', 10);

// REMOVED: completedHashes map — completed personal AI output is NEVER cached.
// Only in-flight dedup is supported (same request already running → reuse Promise).
// Once the request completes (success or failure), the entry is immediately deleted.

// ── Circuit breakers ─────────────────────────────────────────────────────

const circuitBreakers = new Map<string, AICircuitBreaker>();

function getCircuitBreaker(name: string): AICircuitBreaker {
  let cb = circuitBreakers.get(name);
  if (!cb) {
    cb = new AICircuitBreaker(AIConfig.circuitFailureThreshold, AIConfig.circuitResetMs);
    circuitBreakers.set(name, cb);
  }
  return cb;
}

// ── Main Router ──────────────────────────────────────────────────────────

export const AIRouter = {
  /**
   * Generate a standard templated application.
   * Handles provider selection, retry, fallback, dedup internally.
   */
  async generateApplication(req: AIGenerateRequest): Promise<AIResponse> {
    const systemPrompt = buildSystemPrompt(req.officeType, req.applicationName);
    const userMessage = buildUserMessage(req);
    const inputErr = validateInput({ systemPrompt, userMessage });
    if (inputErr) throw Object.assign(new Error(inputErr), { code: 'AI_INVALID_INPUT' });

    const result = await dispatchWithRetry({ systemPrompt, userMessage });
    return validateAndRepair(result, req.formData, systemPrompt);
  },

  /** Generate a custom/blank application. */
  async generateCustomApplication(req: AICustomGenerateRequest): Promise<AIResponse> {
    const systemPrompt = buildCustomSystemPrompt(req.officeName, req.recipientDesignation);
    const userMessage = buildCustomUserMessage(req);
    const inputErr = validateInput({ systemPrompt, userMessage });
    if (inputErr) throw Object.assign(new Error(inputErr), { code: 'AI_INVALID_INPUT' });

    const result = await dispatchWithRetry({ systemPrompt, userMessage });
    return validateAndRepair(result, req.formData, systemPrompt);
  },

  /** Clean up OCR text (typo/error correction). */
  async cleanupText(rawText: string): Promise<AIResponse> {
    const systemPrompt =
      'You are a Hindi proofreader. Fix ONLY clear typos and OCR errors. ' +
      'Do NOT rewrite, rephrase, or change the meaning. Preserve all names, ' +
      'dates, places, and numbers exactly. Return the corrected text only.';
    const userMessage = `Correct OCR typos in this text:\n\n${rawText.substring(0, AIConfig.maxTotalInputLength)}`;
    const inputErr = validateInput({ systemPrompt, userMessage });
    if (inputErr) throw Object.assign(new Error(inputErr), { code: 'AI_INVALID_INPUT' });

    return dispatchWithRetry({ systemPrompt, userMessage, maxTokens: Math.min(rawText.length * 2, 4000) });
  },

  /** Check if any provider is healthy. */
  async healthCheck(): Promise<{ ok: boolean; primary: boolean; fallback: boolean }> {
    const primary = getPrimaryProvider();
    const fallback = getFallbackProvider();
    const [pOk, fOk] = await Promise.all([
      primary?.healthCheck().catch(() => false) ?? false,
      fallback?.healthCheck().catch(() => false) ?? false,
    ]);
    return { ok: pOk || fOk, primary: pOk, fallback: fOk };
  },

  /** Get the name of the current primary provider. */
  getActiveProvider(): string {
    return AIConfig.primaryProvider;
  },
};

// ── Fact validation + repair ─────────────────────────────────────────────

async function validateAndRepair(
  initialResult: AIResponse,
  formData: Record<string, string>,
  systemPrompt: string,
): Promise<AIResponse> {
  const qScore = qualityScore(initialResult.generatedText);
  const factResult = validateFacts(formData, initialResult.generatedText);
  const criticalCount = factResult.mismatches.filter((m) => m.severity === 'critical').length;
  const warningCount   = factResult.mismatches.filter((m) => m.severity === 'warning').length;

  // Always log validation metrics
  log.info(
    `[AIRouter] Validation: qualityScore=${qScore} factScore=${factResult.score} ` +
    `criticalCount=${criticalCount} warningCount=${warningCount}`,
  );

  // Rule 1: quality >= 90 AND no critical errors -> accept immediately
  if (qScore >= 90 && criticalCount === 0) {
    log.info(`[AIRouter] qualityScore=${qScore}>=90, criticalCount=0, accepting without repair.`);
    return initialResult;
  }

  // Rule 2: No critical errors (warnings only) -> accept, no repair
  if (criticalCount === 0) {
    log.info(`[AIRouter] criticalCount=0, warningCount=${warningCount}, accepting (warnings only, no repair needed).`);
    return initialResult;
  }

  // Rule 3: Critical errors detected -> attempt repair
  const repairTriggered = true;
  log.warn(
    `[AIRouter] Quality=${qScore}, factScore=${factResult.score}, ` +
    `criticalCount=${criticalCount}, warningCount=${warningCount}, repairTriggered=${repairTriggered}`,
  );

  try {
    const repairPrompt = factResult.repairPrompt ??
      `Fix factual errors in this draft. Ensure all names, dates, places match the form data exactly.\n\n${initialResult.generatedText.substring(0, 500)}`;
    const repairRequest: AIRequest = {
      systemPrompt: repairPrompt,
      userMessage: `Fix this draft:\n\n${initialResult.generatedText}`,
      maxTokens: Math.max(initialResult.generatedText.length + 500, 2000),
    };

    const repairedResult = await dispatchWithRetry(repairRequest);
    const repairedScore = qualityScore(repairedResult.generatedText);
    const repairedFactResult = validateFacts(formData, repairedResult.generatedText);
    const repairedCritical = repairedFactResult.mismatches.filter((m) => m.severity === 'critical').length;

    const repairSucceeded = repairedScore > qScore || repairedCritical < criticalCount;

    log.info(
      `[AIRouter] Repair result: qualityScore=${repairedScore} factScore=${repairedFactResult.score} ` +
      `criticalCount=${repairedCritical} repairTriggered=true repairSucceeded=${repairSucceeded}`,
    );

    if (repairSucceeded) {
      log.info(`[AIRouter] Repair improved: Q=${qScore}->${repairedScore} C=${criticalCount}->${repairedCritical}`);
      repairedResult.fallbackUsed = initialResult.fallbackUsed;
      return repairedResult;
    }

    // Repair didn't help, accept original if quality is passable
    if (qScore >= 50) {
      log.warn(`[AIRouter] Repair didn't improve, but qualityScore=${qScore}>=50, accepting original.`);
      return initialResult;
    }

    // Quality too low even after repair failure -> truly unusable
    log.error(`[AIRouter] qualityScore=${qScore}<50 after repair failure, rejecting.`);
    throw Object.assign(new Error('AI output quality too low after repair failure.'), { code: 'AI_FACT_MISMATCH' });

  } catch (err: any) {
    if (err.code === 'AI_FACT_MISMATCH') throw err;
    // Network / timeout during repair -> accept original if passable
    if (qScore >= 50) {
      log.warn(`[AIRouter] Repair errored (${err.message?.substring(0, 60)}), but qualityScore=${qScore}>=50, accepting original.`);
      return initialResult;
    }
    throw Object.assign(new Error('AI output quality too low.'), { code: 'AI_OUTPUT_INVALID' });
  }
}

// ── Core dispatch logic ──────────────────────────────────────────────────

async function dispatchWithRetry(request: AIRequest): Promise<AIResponse> {
  const reqHash = hashRequest(request);
  const deadline = Date.now() + AIConfig.totalTimeoutMs;

  // Enforce max concurrent limit
  if (inflightRequests.size >= MAX_INFLIGHT) {
    throw Object.assign(
      new Error('बहुत अधिक अनुरोध — कृपया कुछ समय बाद पुनः प्रयास करें। / Too many requests — please try again later.'),
      { code: 'AI_RATE_LIMITED' },
    );
  }

  // Dedup: in-flight identical request → reuse the same Promise
  const existing = inflightRequests.get(reqHash);
  if (existing) {
    log.info('[AIRouter] ⏭️  Reusing in-flight duplicate request (same content).');
    return existing;
  }

  // Run the request
  const promise = _doDispatch(request, deadline);
  inflightRequests.set(reqHash, promise);
  try {
    const result = await promise;
    return result; // Success — entry deleted in finally
  } finally {
    inflightRequests.delete(reqHash); // Always cleanup (success, failure, timeout)
  }
}

async function _doDispatch(request: AIRequest, deadline: number): Promise<AIResponse> {
  const primary = getPrimaryProvider();
  if (!primary) throw Object.assign(new Error('No AI provider configured.'), { code: 'AI_INTERNAL_ERROR' });

  const primaryCB = getCircuitBreaker(primary.name);
  const fallback = getFallbackProvider();
  const fallbackCB = fallback ? getCircuitBreaker(fallback.name) : null;

  // Try primary with retry
  try {
    return await executeWithRetry(primary, request, deadline, primaryCB);
  } catch (firstErr: any) {
    if (isNonRetryable(firstErr)) throw firstErr;
    log.warn(`[AIRouter] Primary ${primary.name} failed: ${firstErr?.message?.substring(0, 80)}`);

    if (!fallback) {
      throw Object.assign(new Error(firstErr?.message ?? 'AI provider failed'), { code: 'AI_ALL_PROVIDERS_FAILED' });
    }

    // Try fallback (single attempt, no retry)
    try {
      const result = await primaryCall(fallback, request, deadline);
      result.fallbackUsed = true;
      AICostTracker.recordCall(fallback.name, result.usage, true);
      log.info(`[AIRouter] ✅ Fallback ${fallback.name} succeeded.`);
      return result;
    } catch (fallbackErr: any) {
      log.error(`[AIRouter] Both providers failed. Primary: ${firstErr?.message}, Fallback: ${fallbackErr?.message}`);
      throw Object.assign(new Error('All AI providers are currently unavailable. कृपया बाद में पुनः प्रयास करें।'), {
        code: 'AI_ALL_PROVIDERS_FAILED',
      });
    }
  }
}

async function executeWithRetry(
  provider: IAIProvider,
  request: AIRequest,
  deadline: number,
  circuitBreaker: AICircuitBreaker,
): Promise<AIResponse> {
  let lastError: any;

  for (let attempt = 0; attempt <= AIConfig.maxRetries; attempt++) {
    if (Date.now() >= deadline) {
      throw Object.assign(new Error('AI request timed out. कृपया पुनः प्रयास करें।'), { code: 'AI_TIMEOUT' });
    }

    try {
      const result = await primaryCall(provider, request, deadline);
      circuitBreaker.recordSuccess();
      AICostTracker.recordCall(provider.name, result.usage, false);
      return result;
    } catch (err: any) {
      lastError = err;
      circuitBreaker.recordFailure();

      if (isNonRetryable(err)) throw err;
      if (attempt >= AIConfig.maxRetries) break;

      const delay = backoffDelay(attempt);
      log.warn(`[AIRouter] Retry ${attempt + 1}/${AIConfig.maxRetries} after ${delay}ms: ${err?.message?.substring(0, 60)}`);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error('AI provider failed after retries');
}

async function primaryCall(provider: IAIProvider, request: AIRequest, deadline: number): Promise<AIResponse> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw Object.assign(new Error('Timeout'), { code: 'AI_TIMEOUT' });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(Object.assign(new Error('AI request timed out'), { code: 'AI_TIMEOUT' })), remaining),
  );

  const result = await Promise.race([provider.chat({ ...request }), timeoutPromise]);
  const validationErr = validateOutput(result.generatedText);
  if (validationErr) {
    log.warn(`[AIRouter] Output validation failed: ${validationErr}`);
    throw Object.assign(new Error(validationErr), { code: 'AI_OUTPUT_INVALID' });
  }
  return result;
}

// ── Re-use existing prompt builders from aiService ───────────────────────
import { buildSystemPrompt, buildCustomSystemPrompt } from '../aiService';

function buildUserMessage(req: AIGenerateRequest): string {
  // Simple template interpolation: replace {{key}} with values
  let filled = req.promptTemplate;
  for (const [key, value] of Object.entries(req.formData)) {
    filled = filled.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `({{${key}}})`);
  }
  const applicantBlock = Object.entries(req.formData)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  return `${filled}\n\nप्रार्थी की संपूर्ण जानकारी:\n${applicantBlock}`;
}

function buildCustomUserMessage(req: AICustomGenerateRequest): string {
  const desc = req.formData?.custom_description ?? '';
  const identityBlock = Object.entries(req.formData)
    .filter(([k]) => k !== 'custom_description')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  let msg = `कार्यालय: ${req.officeName}`;
  if (req.recipientDesignation) msg += `\nपदनाम: ${req.recipientDesignation}`;
  msg += `\n\n${desc}\n\nप्रार्थी की जानकारी:\n${identityBlock}`;
  return msg;
}
