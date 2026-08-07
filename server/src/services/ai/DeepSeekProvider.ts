/** DeepSeek AI Provider — Anthropic-compatible Messages API */

import { IAIProvider, AIRequest, AIResponse } from './AIProvider';
import { AIConfig } from './AIConfig';
import { createLogger } from '../../config/logger';

const log = createLogger('DeepSeekProvider');

export class DeepSeekProvider implements IAIProvider {
  readonly name = 'deepseek';
  readonly model = AIConfig.models.deepseek;

  async healthCheck(): Promise<boolean> {
    try {
      return !!(process.env.DEEPSEEK_API_KEY);
    } catch { return false; }
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const start = Date.now();
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');

    const Anthropic = await import('@anthropic-ai/sdk');
    // Always create a fresh client to avoid connection reuse issues with keep-alive
    const client = new Anthropic.default({
      apiKey,
      baseURL: 'https://api.deepseek.com/anthropic',
      timeout: AIConfig.requestTimeoutMs,
      maxRetries: 0,
    });

    try {
      // ── DeepSeek: disable extended thinking ───────────────────────
      // DeepSeek v4-flash defaults to extended thinking ON, which consumes
      // the entire max_tokens budget on thinking blocks, leaving zero
      // tokens for the actual text output. We disable thinking entirely —
      // the buildSystemPrompt() already provides detailed instructions.
      const response = await client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens ?? 4000,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.userMessage }],
        temperature: request.temperature,
        thinking: { type: 'disabled' },
      });

      const text = extractText(response.content);
      const cleanText = text.replace(/\*\*/g, '').replace(/__/g, '');

      log.info(`[DeepSeek] OK in=${response.usage?.input_tokens ?? 0} out=${response.usage?.output_tokens ?? 0} time=${Date.now() - start}ms`);

      return {
        generatedText: cleanText,
        provider: this.name,
        model: this.model,
        usage: {
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
        },
        durationMs: Date.now() - start,
        fallbackUsed: false,
      };
    } catch (err: any) {
      const httpStatus = err?.status ?? err?.response?.status ?? 0;
      const providerError = err?.error?.message ?? err?.message ?? String(err);
      const enriched = new Error(`DeepSeek API ${httpStatus}: ${providerError}`);
      (enriched as any).status = httpStatus;
      (enriched as any)._startMs = start;
      (enriched as any).tokenCount = 0;
      log.error(`[DeepSeek] FAIL status=${httpStatus} time=${Date.now() - start}ms error="${providerError.substring(0, 120)}"`);
      throw enriched;
    }
  }

  estimateCost(input: number, output: number): number {
    const p = AIConfig.pricing.deepseek;
    return (input / 1_000_000) * p.input + (output / 1_000_000) * p.output;
  }
}

function extractText(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');
  }
  return String(content ?? '');
}
