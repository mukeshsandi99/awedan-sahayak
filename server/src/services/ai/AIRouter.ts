/**
 * AI Router — Central AI Request Orchestrator
 *
 * Optimizations:
 *   - Prompt caching (memory, keyed by officeType+applicationName)
 *   - Dynamic max_tokens per application type
 *   - Request profiling (stage timings)
 *   - Exponential backoff with longer delays for 429
 *   - Circuit breaker for failing providers
 *   - In-flight dedup (same content → reuse promise)
 *   - Safe logging (no PII)
 */

import { createLogger } from '../../config/logger';
import { AIConfig } from './AIConfig';
import { IAIProvider, AIRequest, AIGenerateRequest, AICustomGenerateRequest, AIResponse } from './AIProvider';
import { ClaudeProvider } from './ClaudeProvider';
import { DeepSeekProvider } from './DeepSeekProvider';
import { validateInput, validateOutput, qualityScore, AICostTracker } from './AIValidator';
import { validateFacts } from './FactValidator';
import { AICircuitBreaker } from './AICircuitBreaker';
import crypto from 'crypto';

const log = createLogger('AIRouter');

// ── Prompt cache ────────────────────────────────────────────────────────
// Reuses built prompts across requests to avoid repeated string building.

const promptCache = new Map<string, { prompt: string; cachedAt: number }>();
const PROMPT_CACHE_TTL_MS = 30 * 60_000; // 30 min

function getCachedPrompt(key: string): string | null {
  const entry = promptCache.get(key);
  if (entry && (Date.now() - entry.cachedAt) < PROMPT_CACHE_TTL_MS) {
    return entry.prompt;
  }
  promptCache.delete(key);
  return null;
}

function setCachedPrompt(key: string, prompt: string): void {
  promptCache.set(key, { prompt, cachedAt: Date.now() });
}

// ── Provider registry ───────────────────────────────────────────────────

const providers: Map<string, IAIProvider> = new Map();

function getProvider(name: string): IAIProvider | null {
  const existing = providers.get(name);
  if (existing) return existing;
  let provider: IAIProvider | null = null;
  if (name === 'claude') provider = new ClaudeProvider();
  else if (name === 'deepseek') provider = new DeepSeekProvider();
  if (provider) { providers.set(name, provider); log.info(`Provider registered: ${name} (${provider.model})`); }
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

// ── Dynamic max_tokens per application type ────────────────────────────

function getMaxTokensForApp(applicationName: string, officeType: string): number {
  const app = applicationName.toLowerCase();
  // Police / detailed complaints need more tokens
  if (/मारपीट|शिकायत|FIR|विवाद|अपराध|धमकी|चोरी|लूट/i.test(app)) return 1500;
  // Land / registry / property need medium
  if (/जमीन|नामांतरण|रजिस्ट्री|खतियान|दाखिल|मापी|कब्जा|राजस्व/i.test(app)) return 1400;
  // Certificates / simple requests need fewer
  if (/प्रमाण|पत्र|आय|जाति|निवास|जन्म|मृत्यु/i.test(app)) return 1000;
  // Bank / school
  if (officeType === 'bank') return 1000;
  if (officeType === 'school' || officeType === 'college') return 1000;
  return 1200; // default
}

// ── Retry logic with 429-aware backoff ──────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number, isRateLimit: boolean = false): number {
  const base = isRateLimit ? AIConfig.rateLimitBaseDelayMs : AIConfig.retryBaseDelayMs;
  const max = isRateLimit ? AIConfig.rateLimitMaxDelayMs : AIConfig.retryMaxDelayMs;
  const exp = Math.min(base * Math.pow(2, attempt), max);
  const jitter = Math.random() * 0.3 * exp;
  return Math.floor(exp + jitter);
}

function isRetryable(error: any): boolean {
  const code = error?.status ?? error?.code ?? 0;
  if (code === 429) return true;
  if (code >= 500 && code < 600) return true;
  const msg = error?.message ?? '';
  if (/timeout|timed ?out|ECONNRESET|ETIMEDOUT|ENOTFOUND|network/i.test(msg)) return true;
  return false;
}

function isRateLimit(error: any): boolean {
  return (error?.status ?? error?.code ?? 0) === 429;
}

function isNonRetryable(error: any): boolean {
  const code = error?.status ?? 0;
  if (code === 400 || code === 401 || code === 403 || code === 404) return true;
  if (/invalid|unsafe|too.?large|auth/i.test(error?.message ?? '')) return true;
  return false;
}

// ── In-flight dedup ─────────────────────────────────────────────────────

const inflightRequests = new Map<string, Promise<AIResponse>>();
const MAX_INFLIGHT = parseInt(process.env.AI_MAX_INFLIGHT_REQUESTS ?? '100', 10);

function hashRequest(req: AIRequest): string {
  const normalise = (s: string): string => s.normalize('NFC').replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(JSON.stringify({
    sys: normalise(req.systemPrompt), user: normalise(req.userMessage), max: req.maxTokens ?? 1200,
  })).digest('hex');
}

// ── Circuit breakers ────────────────────────────────────────────────────

const circuitBreakers = new Map<string, AICircuitBreaker>();

function getCircuitBreaker(name: string): AICircuitBreaker {
  let cb = circuitBreakers.get(name);
  if (!cb) { cb = new AICircuitBreaker(AIConfig.circuitFailureThreshold, AIConfig.circuitResetMs); circuitBreakers.set(name, cb); }
  return cb;
}

// ── Profiling ───────────────────────────────────────────────────────────

interface RequestProfile {
  stage: string;
  durationMs: number;
}

// ── Main Router ─────────────────────────────────────────────────────────

export const AIRouter = {
  async generateApplication(req: AIGenerateRequest): Promise<AIResponse> {
    const profile: RequestProfile[] = [];
    const t0 = Date.now();

    // Step 1: Build prompts (with cache)
    let t1 = Date.now();
    const cacheKey = `gen:${req.officeType}:${req.applicationName}`;
    let systemPrompt = getCachedPrompt(cacheKey);
    if (!systemPrompt) {
      systemPrompt = buildSystemPrompt(req.officeType, req.applicationName);
      setCachedPrompt(cacheKey, systemPrompt);
      profile.push({ stage: 'prompt_build_cold', durationMs: Date.now() - t1 });
    } else {
      profile.push({ stage: 'prompt_build_cache_hit', durationMs: Date.now() - t1 });
    }

    t1 = Date.now();
    const userMessage = buildUserMessage(req);
    profile.push({ stage: 'user_message_build', durationMs: Date.now() - t1 });

    // Step 2: Validate input
    t1 = Date.now();
    const inputErr = validateInput({ systemPrompt, userMessage });
    if (inputErr) throw Object.assign(new Error(inputErr), { code: 'AI_INVALID_INPUT' });
    profile.push({ stage: 'input_validation', durationMs: Date.now() - t1 });

    // Step 3: Dynamic max_tokens
    const maxTokens = getMaxTokensForApp(req.applicationName, req.officeType);

    // Step 4: AI call
    t1 = Date.now();
    const result = await dispatchWithRetry({ systemPrompt, userMessage, maxTokens }, profile);
    profile.push({ stage: 'ai_call_total', durationMs: Date.now() - t1 });

    // Step 5: Validate
    t1 = Date.now();
    (result as any)._requestStartMs = t0;
    const final = await validateAndRepair(result, req.formData, systemPrompt);
    profile.push({ stage: 'validation_repair', durationMs: Date.now() - t1 });

    // Step 6: Log profile
    const totalMs = Date.now() - t0;
    log.info(`[AIRouter] Profile: total=${totalMs}ms tokens=${maxTokens} ${profile.map(p => `${p.stage}=${p.durationMs}ms`).join(' ')}`);

    return final;
  },

  async generateCustomApplication(req: AICustomGenerateRequest): Promise<AIResponse> {
    const profile: RequestProfile[] = [];
    const t0 = Date.now();

    let t1 = Date.now();
    const systemPrompt = buildCustomSystemPrompt(req.officeName, req.recipientDesignation);
    profile.push({ stage: 'prompt_build', durationMs: Date.now() - t1 });

    t1 = Date.now();
    const userMessage = buildCustomUserMessage(req);
    profile.push({ stage: 'user_message_build', durationMs: Date.now() - t1 });

    t1 = Date.now();
    const inputErr = validateInput({ systemPrompt, userMessage });
    if (inputErr) throw Object.assign(new Error(inputErr), { code: 'AI_INVALID_INPUT' });
    profile.push({ stage: 'input_validation', durationMs: Date.now() - t1 });

    t1 = Date.now();
    const result = await dispatchWithRetry({ systemPrompt, userMessage, maxTokens: 1000 }, profile);
    profile.push({ stage: 'ai_call_total', durationMs: Date.now() - t1 });

    t1 = Date.now();
    (result as any)._requestStartMs = t0;
    const final = await validateAndRepair(result, req.formData, systemPrompt);
    profile.push({ stage: 'validation_repair', durationMs: Date.now() - t1 });

    log.info(`[AIRouter] Profile custom: total=${Date.now() - t0}ms ${profile.map(p => `${p.stage}=${p.durationMs}ms`).join(' ')}`);
    return final;
  },

  async cleanupText(rawText: string): Promise<AIResponse> {
    return dispatchWithRetry({
      systemPrompt: 'You are a Hindi proofreader. Fix ONLY clear typos and OCR errors. Do NOT rewrite. Return corrected text only.',
      userMessage: `Correct OCR typos:\n\n${rawText.substring(0, AIConfig.maxTotalInputLength)}`,
      maxTokens: Math.min(rawText.length * 2, 2000),
    }, []);
  },

  async healthCheck(): Promise<{ ok: boolean; primary: boolean; fallback: boolean }> {
    const primary = getPrimaryProvider();
    const fallback = getFallbackProvider();
    const [pOk, fOk] = await Promise.all([
      primary?.healthCheck().catch(() => false) ?? false,
      fallback?.healthCheck().catch(() => false) ?? false,
    ]);
    return { ok: pOk || fOk, primary: pOk, fallback: fOk };
  },

  getActiveProvider(): string { return AIConfig.primaryProvider; },
};

// ── Time budget constants ────────────────────────────────────────────────

const TOTAL_BUDGET_MS = 90_000;
const REPAIR_MIN_BUDGET_MS = 25_000;

// ── Critical failure detection ───────────────────────────────────────────

interface DraftAssessment {
  criticalFailures: string[];
  nonCriticalIssues: string[];
  qualityScore: number;
  factsPassed: boolean;
  factScore: number;
}

function assessDraft(result: AIResponse, formData: Record<string, string>): DraftAssessment {
  const qScore = qualityScore(result.generatedText);
  const factResult = validateFacts(formData, result.generatedText);
  const criticalFailures: string[] = [];
  const nonCriticalIssues: string[] = [];

  if (!result.generatedText || result.generatedText.trim().length < 50) {
    criticalFailures.push('Empty or near-empty output');
  }
  if (qScore < 30) {
    criticalFailures.push(`Quality score critically low: ${qScore}`);
  }
  const criticalMismatches = factResult.mismatches.filter(m => m.severity === 'critical');
  if (criticalMismatches.length > 0) {
    criticalFailures.push(`${criticalMismatches.length} critical fact mismatch(es)`);
  }
  const nonCriticalMismatches = factResult.mismatches.filter(m => m.severity !== 'critical');
  if (nonCriticalMismatches.length > 0) {
    nonCriticalIssues.push(`${nonCriticalMismatches.length} non-critical mismatch(es)`);
  }
  if (qScore >= 30 && qScore < 70 && criticalFailures.length === 0) {
    nonCriticalIssues.push(`Style score below target: ${qScore}/100`);
  }

  return { criticalFailures, nonCriticalIssues, qualityScore: qScore, factsPassed: factResult.passed, factScore: factResult.score };
}

// ── validateAndRepair ────────────────────────────────────────────────────

async function validateAndRepair(
  initialResult: AIResponse,
  formData: Record<string, string>,
  _systemPrompt: string,
): Promise<AIResponse> {
  const requestStart = (initialResult as any)._requestStartMs ?? Date.now();
  const elapsed = Date.now() - requestStart;
  const assessment = assessDraft(initialResult, formData);

  log.info(`[AIRouter] Assessment: Q=${assessment.qualityScore} F=${assessment.factScore} crit=${assessment.criticalFailures.length} nonCrit=${assessment.nonCriticalIssues.length} elapsed=${elapsed}ms`);

  // No critical failures → return immediately
  if (assessment.criticalFailures.length === 0) {
    initialResult.qualityScore = assessment.qualityScore;
    initialResult.repairApplied = false;
    initialResult.refinementAvailable = assessment.nonCriticalIssues.length > 0;
    return initialResult;
  }

  // Critical failures → check time budget
  log.warn(`[AIRouter] Critical: ${assessment.criticalFailures.join('; ')}`);
  const remaining = TOTAL_BUDGET_MS - elapsed;
  if (remaining < REPAIR_MIN_BUDGET_MS) {
    log.warn(`[AIRouter] No time for repair (${remaining}ms < ${REPAIR_MIN_BUDGET_MS}ms)`);
    initialResult.qualityScore = assessment.qualityScore;
    initialResult.repairApplied = false;
    initialResult.refinementAvailable = true;
    return initialResult;
  }

  // Attempt repair
  try {
    const repairPrompt = buildCriticalRepairPrompt(assessment.criticalFailures, formData, initialResult.generatedText);
    const repairTokens = Math.min(Math.max(initialResult.generatedText.length + 500, 1000), 2000);
    const repairResult = await dispatchWithRetry({
      systemPrompt: 'Fix only the listed issues. Keep everything else identical. Return full corrected text.',
      userMessage: repairPrompt,
      maxTokens: repairTokens,
    }, []);

    const repairedAssessment = assessDraft(repairResult, formData);
    if (repairedAssessment.criticalFailures.length < assessment.criticalFailures.length) {
      log.info(`[AIRouter] Repair OK: crit ${assessment.criticalFailures.length}→${repairedAssessment.criticalFailures.length}`);
      repairResult.fallbackUsed = initialResult.fallbackUsed;
      repairResult.qualityScore = repairedAssessment.qualityScore;
      repairResult.repairApplied = true;
      repairResult.refinementAvailable = repairedAssessment.nonCriticalIssues.length > 0;
      return repairResult;
    }
    log.warn('[AIRouter] Repair did not help — returning original');
  } catch (e: any) {
    log.warn(`[AIRouter] Repair failed: ${e?.message?.substring(0, 60)}`);
  }

  initialResult.qualityScore = assessment.qualityScore;
  initialResult.repairApplied = false;
  initialResult.refinementAvailable = true;
  return initialResult;
}

function buildCriticalRepairPrompt(failures: string[], formData: Record<string, string>, draft: string): string {
  const fields = Object.entries(formData).filter(([, v]) => v?.trim()).map(([k, v]) => `${k}: ${v}`);
  return `FIX THESE ISSUES:\n${failures.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\nFORM DATA:\n${fields.join('\n')}\n\nDRAFT:\n${draft}`;
}

// ── Core dispatch ────────────────────────────────────────────────────────

async function dispatchWithRetry(request: AIRequest, profile: RequestProfile[]): Promise<AIResponse> {
  const reqHash = hashRequest(request);
  const deadline = Date.now() + AIConfig.totalTimeoutMs;

  if (inflightRequests.size >= MAX_INFLIGHT) {
    throw Object.assign(new Error('Rate limited — too many requests'), { code: 'AI_RATE_LIMITED' });
  }

  const existing = inflightRequests.get(reqHash);
  if (existing) { log.info('[AIRouter] Reusing in-flight duplicate'); return existing; }

  const promise = _doDispatch(request, deadline, profile);
  inflightRequests.set(reqHash, promise);
  try { return await promise; }
  finally { inflightRequests.delete(reqHash); }
}

async function _doDispatch(request: AIRequest, deadline: number, profile: RequestProfile[]): Promise<AIResponse> {
  const primary = getPrimaryProvider();
  if (!primary) throw Object.assign(new Error('No AI provider configured.'), { code: 'AI_INTERNAL_ERROR' });

  const primaryCB = getCircuitBreaker(primary.name);
  const fallback = getFallbackProvider();

  try {
    const t1 = Date.now();
    const result = await executeWithRetry(primary, request, deadline, primaryCB, profile);
    profile.push({ stage: 'primary_api', durationMs: Date.now() - t1 });
    return result;
  } catch (firstErr: any) {
    if (isNonRetryable(firstErr)) throw firstErr;

    // Log failure details
    logFailure(primary.name, firstErr, request);

    if (!fallback) throw firstErr;

    try {
      log.info(`[AIRouter] Falling back to ${fallback.name}...`);
      const t1 = Date.now();
      const result = await primaryCall(fallback, request, deadline);
      result.fallbackUsed = true;
      profile.push({ stage: 'fallback_api', durationMs: Date.now() - t1 });
      AICostTracker.recordCall(fallback.name, result.usage, true);
      return result;
    } catch (fallbackErr: any) {
      logFailure(fallback.name, fallbackErr, request);
      throw Object.assign(new Error('All AI providers unavailable'), { code: 'AI_ALL_PROVIDERS_FAILED' });
    }
  }
}

function logFailure(provider: string, error: any, _request: AIRequest): void {
  const status = error?.status ?? error?.code ?? 'unknown';
  const msg = error?.message?.substring(0, 120) ?? 'unknown';
  log.error(`[AI_FAIL] provider=${provider} status=${status} latency=${error?.latencyMs ?? '?'}ms tokens=${error?.tokenCount ?? '?'}  error="${msg}"`);
}

async function executeWithRetry(
  provider: IAIProvider, request: AIRequest, deadline: number,
  circuitBreaker: AICircuitBreaker, profile: RequestProfile[],
): Promise<AIResponse> {
  let lastError: any;

  for (let attempt = 0; attempt <= AIConfig.maxRetries; attempt++) {
    if (Date.now() >= deadline) {
      throw Object.assign(new Error('AI timeout'), { code: 'AI_TIMEOUT' });
    }

    try {
      const t1 = Date.now();
      const result = await primaryCall(provider, request, deadline);
      const callMs = Date.now() - t1;
      profile.push({ stage: `api_attempt_${attempt}`, durationMs: callMs });
      circuitBreaker.recordSuccess();
      AICostTracker.recordCall(provider.name, result.usage, false);
      return result;
    } catch (err: any) {
      lastError = err;
      lastError.latencyMs = Date.now() - (lastError._startMs ?? Date.now());
      circuitBreaker.recordFailure();

      if (isNonRetryable(err)) throw err;
      if (attempt >= AIConfig.maxRetries) break;

      const rateLimited = isRateLimit(err);
      const delay = backoffDelay(attempt, rateLimited);
      log.warn(`[AIRouter] ${rateLimited ? 'RATE_LIMIT' : 'Retry'} ${attempt + 1}/${AIConfig.maxRetries} delay=${delay}ms: ${err?.message?.substring(0, 60)}`);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error('AI provider failed');
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
    log.warn(`[AIRouter] Output validation: ${validationErr}`);
    throw Object.assign(new Error(validationErr), { code: 'AI_OUTPUT_INVALID' });
  }
  return result;
}

// ── Prompt builders ──────────────────────────────────────────────────────

import { buildSystemPrompt, buildCustomSystemPrompt } from '../aiService';

function buildUserMessage(req: AIGenerateRequest): string {
  let filled = req.promptTemplate;
  for (const [key, value] of Object.entries(req.formData)) {
    filled = filled.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `({{${key}}})`);
  }
  const applicantBlock = Object.entries(req.formData).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `${filled}\n\nप्रार्थी की जानकारी:\n${applicantBlock}`;
}

function buildCustomUserMessage(req: AICustomGenerateRequest): string {
  const identityBlock = Object.entries(req.formData)
    .filter(([k]) => k !== 'custom_description')
    .map(([k, v]) => `${k}: ${v}`).join('\n');
  let msg = `कार्यालय: ${req.officeName}`;
  if (req.recipientDesignation) msg += `\nपदनाम: ${req.recipientDesignation}`;
  msg += `\n\n${req.formData?.custom_description ?? ''}\n\nप्रार्थी की जानकारी:\n${identityBlock}`;
  return msg;
}
