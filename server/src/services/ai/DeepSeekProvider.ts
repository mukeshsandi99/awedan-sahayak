/** DeepSeek AI Provider — Anthropic-compatible Messages API with profiling */

import { IAIProvider, AIRequest, AIResponse } from './AIProvider';
import { AIConfig } from './AIConfig';
import { createLogger } from '../../config/logger';
import { getInstrumentedAgent, ConnectionTimings } from './InstrumentedHttpsAgent';
import { getLatencyTracker } from './LatencyTracker';

const log = createLogger('DeepSeekProvider');

// ── Singletons ───────────────────────────────────────────────────────────

/** Shared instrumented HTTPS agent (keepAlive, DNS/TCP/TLS timing). */
const instrumentedAgent = getInstrumentedAgent();

/** Global latency percentile tracker. */
const latencyTracker = getLatencyTracker();

// ── Provider ─────────────────────────────────────────────────────────────

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

    // ── Singleton client ──────────────────────────────────────────────
    const Anthropic = await import('@anthropic-ai/sdk');
    if (!this.client) {
      this.client = new Anthropic.default({
        apiKey,
        baseURL: 'https://api.deepseek.com/anthropic',
        httpAgent: instrumentedAgent,
      });
      log.info('DeepSeek Anthropic SDK client created (singleton, instrumented agent).');
    }

    // ── Connection-level timing ───────────────────────────────────────
    const connSnap = instrumentedAgent.snapshotConnectionCount();

    // ── Non-streaming request ─────────────────────────────────────────
    // DeepSeek's Anthropic-compatible SSE streaming endpoint does NOT emit
    // text_delta events when extended thinking is active (deepseek-v4-flash).
    // The model emits thinking_delta tokens, signs them, then stops without
    // ever streaming the actual text output. Non-streaming mode returns both
    // the thinking block and the text block correctly.
    //
    // Additionally, extended thinking consumes the entire max_tokens budget
    // and causes 50s+ latency on complex Hindi prompts, triggering timeouts.
    // We disable thinking entirely — the buildSystemPrompt() already provides
    // detailed instructions in the system prompt.
    //
    // Evidence: profiling/protocol-diag.mjs captured raw SSE — 1959
    // thinking_delta events, 0 text_delta events. Non-streaming returned
    // [thinking]=1584chars + [text]=1736chars. With thinking ON and
    // full server prompt, output_tokens hit max_tokens=4000 (all consumed
    // by thinking), leaving 0 text and causing 50s+ timeouts.
    const maxTokens = request.maxTokens ?? 4000;

    let promptTokens = 0;
    let completionTokens = 0;
    let fullText = '';

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.userMessage }],
        temperature: request.temperature,
        stream: false,
        thinking: { type: 'disabled' },
      });

      promptTokens = response.usage?.input_tokens ?? 0;
      completionTokens = response.usage?.output_tokens ?? 0;
      fullText = extractText(response.content);

    } catch (err: any) {
      const elapsed = Date.now() - start;
      log.error(
        `❌ DeepSeek request failed after ${elapsed}ms: ${err?.message?.substring(0, 120)}`,
      );
      throw err;
    }

    // With non-streaming we lose true TTFT.  Use total duration as proxy.
    const ttltMs = Date.now() - start;
    const ttftMs = ttltMs;
    const uploadMs = 0; // not measurable without streaming

    // ── Connection timing (post-request) ──────────────────────────────
    const connTiming: ConnectionTimings = instrumentedAgent.connectionDelta(connSnap);

    // ── Model queue estimate ──────────────────────────────────────────
    // queue = TTFT − upload time − (half of DNS+TCP+TLS as approximate RTT)
    // Negative values are clamped to 0.
    const networkRtt = connTiming.reused
      ? 0
      : (connTiming.dnsLookupMs + connTiming.tcpConnectMs + connTiming.tlsHandshakeMs) * 0.5;
    const modelQueueMs = Math.max(0, ttftMs - uploadMs - networkRtt);

    // ── Token extraction (from stream events or estimate) ─────────────
    // If the stream didn't give us token counts, estimate from text length.
    const outputTokens =
      completionTokens > 0
        ? completionTokens
        : Math.max(1, Math.round(fullText.length / 3.5)); // rough char→token

    const inputTokens =
      promptTokens > 0
        ? promptTokens
        : Math.max(1, Math.round((request.systemPrompt.length + request.userMessage.length) / 3.5));

    // ── Record in latency tracker ─────────────────────────────────────
    latencyTracker.record({
      timestamp: new Date().toISOString(),
      dnsLookupMs: connTiming.dnsLookupMs,
      tcpConnectMs: connTiming.tcpConnectMs,
      tlsHandshakeMs: connTiming.tlsHandshakeMs,
      connectionReused: connTiming.reused,
      uploadMs,
      modelQueueMs,
      ttftMs,
      ttltMs,
      promptTokens: inputTokens,
      completionTokens: outputTokens,
    });

    // ── Per-request log ───────────────────────────────────────────────
    const reuseTag = connTiming.reused ? '♻️' : '🆕';
    log.info(
      `📡 DeepSeek request ${reuseTag} | ` +
      `DNS=${connTiming.dnsLookupMs.toFixed(0)}ms ` +
      `TCP=${connTiming.tcpConnectMs.toFixed(0)}ms ` +
      `TLS=${connTiming.tlsHandshakeMs.toFixed(0)}ms | ` +
      `upload=${uploadMs.toFixed(0)}ms ` +
      `queue=${modelQueueMs.toFixed(0)}ms | ` +
      `TTFT=${ttftMs.toFixed(0)}ms ` +
      `TTLT=${ttltMs.toFixed(0)}ms | ` +
      `tokens in=${inputTokens} out=${outputTokens} | ` +
      `total=${Date.now() - start}ms`,
    );

    // ── Periodically log latency percentiles (every 10 requests) ──────
    if (latencyTracker.count > 0 && latencyTracker.count % 10 === 0) {
      latencyTracker.logSummary('DeepSeek');
    }

    // ── Provider-side bottleneck warning ──────────────────────────────
    if (ttftMs > 40_000) {
      log.warn(
        `⏳ BOTTLENECK: DeepSeek TTFT=${ttftMs.toFixed(0)}ms > 40s — ` +
        `provider-side queue is the bottleneck (upload=${uploadMs.toFixed(0)}ms, ` +
        `queue=${modelQueueMs.toFixed(0)}ms, network~${networkRtt.toFixed(0)}ms).`,
      );
    }

    // ── Return same contract ──────────────────────────────────────────
    const cleanText = fullText.replace(/\*\*/g, '').replace(/__/g, '');

    return {
      generatedText: cleanText,
      provider: this.name,
      model: this.model,
      usage: {
        inputTokens,
        outputTokens,
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
