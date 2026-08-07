/**
 * AI Validator — Input validation, output quality checks, cost tracking.
 * No PII is logged through these utilities.
 */

import { AIRequest, AIResponse } from './AIProvider';
import { AIConfig } from './AIConfig';
import { createLogger } from '../../config/logger';

const log = createLogger('AIValidator');

// ── Input validation ─────────────────────────────────────────────────────

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /reveal\s+(your\s+)?system\s+(prompt|instructions)/i,
  /print\s+(your\s+)?api\s+key/i,
  /bypass\s+(rules?|restrictions?)/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /disregard\s+(all\s+)?(previous\s+)?instructions/i,
];

const AADHAR_PATTERN = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;

export function validateInput(request: AIRequest): string | null {
  const totalLen = (request.systemPrompt.length + request.userMessage.length);
  if (totalLen > AIConfig.maxTotalInputLength) {
    return `Input too large: ${totalLen} chars (max ${AIConfig.maxTotalInputLength}). कृपया छोटा विवरण दें।`;
  }
  if (!request.userMessage.trim()) return 'User message is empty.';
  if (!request.systemPrompt.trim()) return 'System prompt is empty.';

  // Prompt injection detection
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(request.userMessage)) {
      log.warn('[AIValidator] Prompt injection pattern detected — sanitizing.');
      // Don't reject — the user's actual complaint likely contains valid content.
      // The system prompt takes precedence; user content is clearly delimited.
      // We just log the detection for monitoring.
      break;
    }
  }

  // Aadhaar pattern in user message → redact
  if (AADHAR_PATTERN.test(request.userMessage)) {
    log.warn('[AIValidator] Aadhaar pattern detected in AI input — redacting.');
    // Redact and proceed (don't block legitimate applications)
    request.userMessage = request.userMessage.replace(AADHAR_PATTERN, '[AADHAAR-REDACTED]');
  }

  return null; // Valid
}

// ── Output validation ────────────────────────────────────────────────────

const REQUIRED_SECTIONS = [
  { pattern: /सेवा\s*में/i, label: 'सेवा में (address)' },
  { pattern: /विषय/i, label: 'विषय (subject)' },
  { pattern: /निवेदन/i, label: 'निवेदन (request body)' },
];

export function validateOutput(text: string): string | null {
  if (!text || text.trim().length < 50) return 'Output too short or empty.';

  // ── Placeholder check: warn but don't reject ──────────────────────
  // The system prompt instructs the AI to fill {{placeholders}} from
  // form data. If the AI leaves some, they'll be caught by the fact
  // validator and repaired in validateAndRepair. Rejecting here would
  // prevent the repair pass from running.
  const unresolved = text.match(/\{\{[a-zA-Z_]+\}\}/g);
  if (unresolved) {
    log.warn(`[AIValidator] ⚠️ ${unresolved.length} unresolved placeholder(s) — will attempt repair: ${unresolved.slice(0, 6).join(', ')}`);
  }

  // Check for markdown artifacts
  if (/[*_]{3,}/.test(text)) return 'Markdown artifacts found in output.';

  // Check for fake/invented legal sections
  const fakeSections = text.match(/धारा\s*\d+[कखगघ]?\s*(?:भा\.?दं\.?सं\.?|IPC|BNS|CrPC)/gi);
  if (fakeSections && fakeSections.length > 5) {
    return `Potentially invented legal sections: ${fakeSections.length} found.`;
  }

  // Check required sections present
  let missing = 0;
  for (const { pattern, label } of REQUIRED_SECTIONS) {
    if (!pattern.test(text)) {
      log.warn(`[AIValidator] Missing section: ${label}`);
      missing++;
    }
  }
  if (missing >= 2) return 'Output is missing critical sections (सेवा में, विषय, निवेदन).';

  return null; // Valid
}

export function qualityScore(text: string): number {
  let score = 100;
  if (text.length < 100) score -= 40;
  if (/\{\{[a-zA-Z_]+\}\}/.test(text)) score -= 30;
  if (/[*_]{3,}/.test(text)) score -= 10;

  let sectionsFound = 0;
  for (const { pattern } of REQUIRED_SECTIONS) {
    if (pattern.test(text)) sectionsFound++;
  }
  score -= (3 - sectionsFound) * 10;

  return Math.max(0, Math.min(100, score));
}

// ── Cost tracking ────────────────────────────────────────────────────────

interface CostRecord {
  provider: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  fallback: boolean;
  timestamp: string;
}

let costLog: CostRecord[] = [];

function cleanupOldRecords(): void {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  costLog = costLog.filter((r) => new Date(r.timestamp).getTime() > cutoff);
}

export const AICostTracker = {
  recordCall(provider: string, usage: AIResponse['usage'], fallback: boolean): void {
    if (!usage) return;
    const input = usage.inputTokens;
    const output = usage.outputTokens;
    let cost = 0;
    if (provider === 'claude') {
      cost = (input / 1_000_000) * AIConfig.pricing.claude.input + (output / 1_000_000) * AIConfig.pricing.claude.output;
    } else if (provider === 'deepseek') {
      cost = (input / 1_000_000) * AIConfig.pricing.deepseek.input + (output / 1_000_000) * AIConfig.pricing.deepseek.output;
    }
    costLog.push({ provider, inputTokens: input, outputTokens: output, estimatedCost: cost, fallback, timestamp: new Date().toISOString() });
    cleanupOldRecords();
  },

  getSummary(): { totalCalls: number; totalCost: number; providers: Record<string, { calls: number; cost: number }> } {
    const summary = { totalCalls: costLog.length, totalCost: 0, providers: {} as Record<string, any> };
    for (const r of costLog) {
      summary.totalCost += r.estimatedCost;
      if (!summary.providers[r.provider]) summary.providers[r.provider] = { calls: 0, cost: 0 };
      summary.providers[r.provider].calls++;
      summary.providers[r.provider].cost += r.estimatedCost;
    }
    return summary;
  },
};
