/** DeepSeek AI Provider — Anthropic-compatible Messages API */

import { IAIProvider, AIRequest, AIResponse } from './AIProvider';
import { AIConfig } from './AIConfig';
import { createLogger } from '../../config/logger';

const log = createLogger('DeepSeekProvider');

export class DeepSeekProvider implements IAIProvider {
  readonly name = 'deepseek';
  readonly model = AIConfig.models.deepseek;
  private client: any = null;

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
    if (!this.client) {
      this.client = new Anthropic.default({
        apiKey,
        baseURL: 'https://api.deepseek.com/anthropic',
      });
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens ?? 1200,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.userMessage }],
      temperature: request.temperature,
    });

    const text = extractText(response.content);
    const cleanText = text.replace(/\*\*/g, '').replace(/__/g, '');

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
