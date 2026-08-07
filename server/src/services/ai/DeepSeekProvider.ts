/** DeepSeek AI Provider — Official OpenAI-compatible API */

import { IAIProvider, AIRequest, AIResponse } from './AIProvider';
import { AIConfig } from './AIConfig';
import { createLogger } from '../../config/logger';

const log = createLogger('DeepSeekProvider');

export class DeepSeekProvider implements IAIProvider {
  readonly name = 'deepseek';
  readonly model = 'deepseek-chat'; // Official model ID for OpenAI-compatible endpoint

  async healthCheck(): Promise<boolean> {
    try {
      return !!(process.env.DEEPSEEK_API_KEY);
    } catch { return false; }
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const start = Date.now();
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');

    const maxTokens = request.maxTokens ?? 8000;

    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userMessage },
      ],
      max_tokens: maxTokens,
      temperature: request.temperature ?? 0.7,
    });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AIConfig.requestTimeoutMs);

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        const enriched = new Error(`DeepSeek API ${response.status}: ${errText.substring(0, 200)}`);
        (enriched as any).status = response.status;
        throw enriched;
      }

      const data: any = await response.json();
      const content: string = data.choices?.[0]?.message?.content ?? '';
      const cleanText = content.replace(/\*\*/g, '').replace(/__/g, '');
      const finishReason = data.choices?.[0]?.finish_reason ?? 'unknown';

      const inputTokens = data.usage?.prompt_tokens ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;

      log.info(
        `[DeepSeek] OK model=${data.model ?? this.model} ` +
        `in=${inputTokens} out=${outputTokens} ` +
        `finish=${finishReason} text=${cleanText.length}chars ` +
        `time=${Date.now() - start}ms`,
      );

      return {
        generatedText: cleanText,
        provider: this.name,
        model: data.model ?? this.model,
        usage: { inputTokens, outputTokens },
        durationMs: Date.now() - start,
        fallbackUsed: false,
      };
    } catch (err: any) {
      // AbortError from timeout
      if (err.name === 'AbortError') {
        const enriched = new Error(`DeepSeek request timed out after ${Date.now() - start}ms`);
        (enriched as any).status = 504;
        (enriched as any).code = 'AI_TIMEOUT';
        log.error(`[DeepSeek] TIMEOUT after ${Date.now() - start}ms`);
        throw enriched;
      }

      // Already enriched errors
      if (err.status) throw err;

      // Unexpected errors
      const enriched = new Error(`DeepSeek API error: ${err.message?.substring(0, 200)}`);
      (enriched as any).status = 0;
      log.error(`[DeepSeek] FAIL: ${err.message?.substring(0, 200)}`);
      throw enriched;
    }
  }

  estimateCost(input: number, output: number): number {
    const p = AIConfig.pricing.deepseek;
    return (input / 1_000_000) * p.input + (output / 1_000_000) * p.output;
  }
}
