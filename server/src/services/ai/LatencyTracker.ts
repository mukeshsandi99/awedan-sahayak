/**
 * Latency Tracker — accumulating percentile calculator for AI response timings.
 *
 * Thread-safe append-only ring buffer.  Computes p50 / p90 / p95 / p99
 * on demand via in-place integer sort (not general-purpose, but fine for
 * the volume of AI requests a single server handles).
 *
 * Also tracks per-request breakdown components so aggregate stats can be
 * reported for DNS, TCP, TLS, TTFT, etc.
 */

import { createLogger } from '../../config/logger';

const log = createLogger('LatencyTracker');

// ── Types ──────────────────────────────────────────────────────────────────

export interface TimingSample {
  timestamp: string;          // ISO-8601 of request start
  dnsLookupMs: number;
  tcpConnectMs: number;
  tlsHandshakeMs: number;
  connectionReused: boolean;
  uploadMs: number;           // request body send time
  modelQueueMs: number;       // server-side queue (TTFT − upload − network RTT, estimated)
  ttftMs: number;             // time to first token (stream)
  ttltMs: number;             // time to last token (total response)
  promptTokens: number;
  completionTokens: number;
}

export interface LatencyStats {
  count: number;
  dns:      { p50: number; p90: number; p95: number; p99: number };
  tcp:      { p50: number; p90: number; p95: number; p99: number };
  tls:      { p50: number; p90: number; p95: number; p99: number };
  ttft:     { p50: number; p90: number; p95: number; p99: number };
  ttlt:     { p50: number; p90: number; p95: number; p99: number };
  avgPromptTokens: number;
  avgCompletionTokens: number;
  connectionReuseRate: number; // fraction of requests that reused a connection
}

// ── Ring buffer ────────────────────────────────────────────────────────────

const MAX_SAMPLES = parseInt(process.env.AI_LATENCY_MAX_SAMPLES ?? '10000', 10);

export class LatencyTracker {
  private samples: TimingSample[] = [];

  /** Append a sample.  O(1). */
  record(s: TimingSample): void {
    this.samples.push(s);
    if (this.samples.length > MAX_SAMPLES) {
      // Drop oldest half to stay bounded
      this.samples = this.samples.slice(-Math.floor(MAX_SAMPLES / 2));
    }
  }

  /** Number of stored samples. */
  get count(): number { return this.samples.length; }

  /** Compute percentile stats.  O(n log n) on the snapshot. */
  stats(): LatencyStats {
    const snap = this.samples.slice();
    const n = snap.length;
    if (n === 0) return emptyStats();

    const dnsVals: number[] = [];
    const tcpVals: number[] = [];
    const tlsVals: number[] = [];
    const ttftVals: number[] = [];
    const ttltVals: number[] = [];
    let sumPrompt = 0;
    let sumCompletion = 0;
    let reused = 0;

    for (const s of snap) {
      dnsVals.push(s.dnsLookupMs);
      tcpVals.push(s.tcpConnectMs);
      tlsVals.push(s.tlsHandshakeMs);
      ttftVals.push(s.ttftMs);
      ttltVals.push(s.ttltMs);
      sumPrompt += s.promptTokens;
      sumCompletion += s.completionTokens;
      if (s.connectionReused) reused++;
    }

    return {
      count: n,
      dns:  percentiles(dnsVals),
      tcp:  percentiles(tcpVals),
      tls:  percentiles(tlsVals),
      ttft: percentiles(ttftVals),
      ttlt: percentiles(ttltVals),
      avgPromptTokens: Math.round(sumPrompt / n),
      avgCompletionTokens: Math.round(sumCompletion / n),
      connectionReuseRate: n > 0 ? parseFloat((reused / n).toFixed(3)) : 0,
    };
  }

  /** Print a one-line stats summary to the logger. */
  logSummary(context: string = ''): void {
    const s = this.stats();
    if (s.count === 0) {
      log.info(`[LatencyTracker] ${context} no samples yet.`);
      return;
    }
    const label = context ? `[${context}]` : '';
    log.info(
      `📊 Latency${label} n=${s.count} | ` +
      `TTFT p50=${s.ttft.p50}ms p90=${s.ttft.p90}ms p95=${s.ttft.p95}ms p99=${s.ttft.p99}ms | ` +
      `TTLT p50=${s.ttlt.p50}ms p90=${s.ttlt.p90}ms p95=${s.ttlt.p95}ms p99=${s.ttlt.p99}ms | ` +
      `DNS p50=${s.dns.p50}ms TCP p50=${s.tcp.p50}ms TLS p50=${s.tls.p50}ms | ` +
      `reuse=${(s.connectionReuseRate * 100).toFixed(0)}% | ` +
      `avgToks prompt=${s.avgPromptTokens} comp=${s.avgCompletionTokens}`,
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function percentiles(vals: number[]): { p50: number; p90: number; p95: number; p99: number } {
  const sorted = vals.slice().sort((a, b) => a - b);
  const p = (k: number) => {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((k / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
  };
  return { p50: p(50), p90: p(90), p95: p(95), p99: p(99) };
}

function emptyStats(): LatencyStats {
  const z = { p50: 0, p90: 0, p95: 0, p99: 0 };
  return {
    count: 0,
    dns: z, tcp: z, tls: z, ttft: z, ttlt: z,
    avgPromptTokens: 0,
    avgCompletionTokens: 0,
    connectionReuseRate: 0,
  };
}

// ── Singleton ──────────────────────────────────────────────────────────────

const _instance = new LatencyTracker();

/** Global latency tracker for the DeepSeek provider. */
export function getLatencyTracker(): LatencyTracker {
  return _instance;
}

export default LatencyTracker;
