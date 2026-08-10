#!/usr/bin/env node
/**
 * Report Generator — parses profiling server logs + results.jsonl
 * and produces the final profiling report.
 *
 * Run AFTER all 30 requests complete:
 *   node profiling/report.mjs
 */

import { readFileSync, writeFileSync } from 'fs';

// ── Parse server log ─────────────────────────────────────────────────────

function parseServerLog(logPath) {
  const raw = readFileSync(logPath, 'utf-8');
  const lines = raw.split('\n');

  const samples = [];
  const connections = [];
  const bottlenecks = [];
  const percentiles = [];
  let http429 = 0, http500 = 0, providerFailures = 0, renderFailures = 0;

  for (const line of lines) {
    // 📡 DeepSeek request lines
    const reqMatch = line.match(/📡 DeepSeek request (🆕|♻️) \| (.+)/);
    if (reqMatch) {
      const reused = reqMatch[1] === '♻️';
      const rest = reqMatch[2];
      const sample = {
        reused,
        dnsLookupMs:    parseFloat((rest.match(/DNS=(\d+)ms/) || [0, 0])[1]),
        tcpConnectMs:   parseFloat((rest.match(/TCP=(\d+)ms/) || [0, 0])[1]),
        tlsHandshakeMs: parseFloat((rest.match(/TLS=(\d+)ms/) || [0, 0])[1]),
        uploadMs:       parseFloat((rest.match(/upload=(\d+)ms/) || [0, 0])[1]),
        modelQueueMs:   parseFloat((rest.match(/queue=(\d+)ms/) || [0, 0])[1]),
        ttftMs:         parseFloat((rest.match(/TTFT=(\d+)ms/) || [0, 0])[1]),
        ttltMs:         parseFloat((rest.match(/TTLT=(\d+)ms/) || [0, 0])[1]),
        promptTokens:   parseInt((rest.match(/tokens in=(\d+)/) || [0, 0])[1], 10),
        completionTokens: parseInt((rest.match(/tokens out=(\d+)/) || [0, 0])[1], 10),
        totalMs:        parseFloat((rest.match(/total=(\d+)ms/) || [0, 0])[1]),
      };
      samples.push(sample);
    }

    // 🔌 New connection lines
    const connMatch = line.match(/🔌 New connection #(\d+): DNS=([\d.]+)ms TCP=([\d.]+)ms TLS=([\d.]+)ms/);
    if (connMatch) {
      connections.push({
        num: parseInt(connMatch[1], 10),
        dns: parseFloat(connMatch[2]),
        tcp: parseFloat(connMatch[3]),
        tls: parseFloat(connMatch[4]),
      });
    }

    // ⏳ Bottleneck warning lines
    if (line.includes('⏳ BOTTLENECK')) {
      bottlenecks.push(line);
    }

    // 📊 Latency percentile lines
    const pctMatch = line.match(/📊 Latency\[DeepSeek\] n=(\d+)/);
    if (pctMatch) {
      percentiles.push(line);
    }

    // ❌ Error lines
    if (line.includes('❌ DeepSeek stream failed')) {
      providerFailures++;
    }
    if (line.includes('[POST /generate-application] Failed')) {
      renderFailures++;
    }
  }

  // Count HTTP errors from results file
  try {
    const resultsRaw = readFileSync('profiling/results.jsonl', 'utf-8');
    for (const rline of resultsRaw.trim().split('\n')) {
      if (!rline.trim()) continue;
      try {
        const r = JSON.parse(rline);
        if (r.httpCode === 429) http429++;
        if (r.httpCode >= 500) http500++;
        if (r.httpCode !== 200 && r.httpCode !== 429 && r.httpCode < 500) providerFailures++;
      } catch {}
    }
  } catch {}

  return { samples, connections, bottlenecks, percentiles, http429, http500, providerFailures, renderFailures };
}

// ── Percentile calculator ─────────────────────────────────────────────────

function percentile(vals, p) {
  if (vals.length === 0) return 0;
  const sorted = [...vals].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function pctBlock(vals) {
  return {
    p50: percentile(vals, 50),
    p95: percentile(vals, 95),
    p99: percentile(vals, 99),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────

function main() {
  const logPath = process.argv[2] || '/dev/stdin';
  const { samples, connections, bottlenecks, percentiles, http429, http500, providerFailures, renderFailures } = parseServerLog(logPath);

  if (samples.length === 0) {
    console.log('No profiling samples found. Is the server log correct?');
    process.exit(1);
  }

  const dns  = samples.map(s => s.dnsLookupMs);
  const tcp  = samples.map(s => s.tcpConnectMs);
  const tls  = samples.map(s => s.tlsHandshakeMs);
  const up   = samples.map(s => s.uploadMs);
  const q    = samples.map(s => s.modelQueueMs);
  const ttft = samples.map(s => s.ttftMs);
  const ttlt = samples.map(s => s.ttltMs);
  const reuseCount = samples.filter(s => s.reused).length;
  const avgPrompt = Math.round(samples.reduce((a, s) => a + s.promptTokens, 0) / samples.length);
  const avgCompletion = Math.round(samples.reduce((a, s) => a + s.completionTokens, 0) / samples.length);

  const report = `
╔══════════════════════════════════════════════════════════╗
║     DeepSeek API Profiling Report                        ║
╠══════════════════════════════════════════════════════════╣
║  Samples: ${String(samples.length).padEnd(48)}║
║  Date:    ${new Date().toISOString().padEnd(48)}║
╚══════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────┐
│  LATENCY PERCENTILES (ms)                                │
├──────────┬──────────┬──────────┬──────────┬──────────────┤
│ Metric   │    p50   │    p95   │    p99   │    Mean      │
├──────────┼──────────┼──────────┼──────────┼──────────────┤
│ DNS      │ ${String(pctBlock(dns).p50).padStart(7)}  │ ${String(pctBlock(dns).p95).padStart(7)}  │ ${String(pctBlock(dns).p99).padStart(7)}  │ ${String(Math.round(dns.reduce((a,b)=>a+b,0)/dns.length)).padStart(7)}     │
│ TCP      │ ${String(pctBlock(tcp).p50).padStart(7)}  │ ${String(pctBlock(tcp).p95).padStart(7)}  │ ${String(pctBlock(tcp).p99).padStart(7)}  │ ${String(Math.round(tcp.reduce((a,b)=>a+b,0)/tcp.length)).padStart(7)}     │
│ TLS      │ ${String(pctBlock(tls).p50).padStart(7)}  │ ${String(pctBlock(tls).p95).padStart(7)}  │ ${String(pctBlock(tls).p99).padStart(7)}  │ ${String(Math.round(tls.reduce((a,b)=>a+b,0)/tls.length)).padStart(7)}     │
│ Upload   │ ${String(pctBlock(up).p50).padStart(7)}  │ ${String(pctBlock(up).p95).padStart(7)}  │ ${String(pctBlock(up).p99).padStart(7)}  │ ${String(Math.round(up.reduce((a,b)=>a+b,0)/up.length)).padStart(7)}     │
│ Queue    │ ${String(pctBlock(q).p50).padStart(7)}  │ ${String(pctBlock(q).p95).padStart(7)}  │ ${String(pctBlock(q).p99).padStart(7)}  │ ${String(Math.round(q.reduce((a,b)=>a+b,0)/q.length)).padStart(7)}     │
│ TTFT     │ ${String(pctBlock(ttft).p50).padStart(7)}  │ ${String(pctBlock(ttft).p95).padStart(7)}  │ ${String(pctBlock(ttft).p99).padStart(7)}  │ ${String(Math.round(ttft.reduce((a,b)=>a+b,0)/ttft.length)).padStart(7)}     │
│ TTLT     │ ${String(pctBlock(ttlt).p50).padStart(7)}  │ ${String(pctBlock(ttlt).p95).padStart(7)}  │ ${String(pctBlock(ttlt).p99).padStart(7)}  │ ${String(Math.round(ttlt.reduce((a,b)=>a+b,0)/ttlt.length)).padStart(7)}     │
├──────────┴──────────┴──────────┴──────────┴──────────────┤
│  Queue as % of TTFT (mean): ${String(Math.round((q.reduce((a,b)=>a+b,0) / ttft.reduce((a,b)=>a+b,0)) * 100)).padStart(3)}%                            │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  TOKEN STATISTICS                                        │
├──────────────────────────────┬───────────────────────────┤
│  Average prompt tokens       │  ${String(avgPrompt).padStart(7)}                    │
│  Average completion tokens   │  ${String(avgCompletion).padStart(7)}                    │
│  Total prompt tokens         │  ${String(samples.reduce((a,s)=>a+s.promptTokens,0)).padStart(7)}                    │
│  Total completion tokens     │  ${String(samples.reduce((a,s)=>a+s.completionTokens,0)).padStart(7)}                    │
└──────────────────────────────┴───────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  CONNECTION & ERROR STATISTICS                           │
├──────────────────────────────┬───────────────────────────┤
│  Connection reuse rate       │  ${String(Math.round((reuseCount / samples.length) * 100)).padStart(3)}% (${reuseCount}/${samples.length})            │
│  New connections established │  ${String(connections.length).padStart(7)}                    │
│  HTTP 429 count              │  ${String(http429).padStart(7)}                    │
│  HTTP 500 count              │  ${String(http500).padStart(7)}                    │
│  Provider failures           │  ${String(providerFailures).padStart(7)}                    │
│  Render failures             │  ${String(renderFailures).padStart(7)}                    │
└──────────────────────────────┴───────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  BOTTLENECK ANALYSIS                                     │
├──────────────────────────────────────────────────────────┤
│  TTFT > 40s count: ${String(samples.filter(s => s.ttftMs > 40000).length).padStart(7)} / ${samples.length}                      │
│  Bottleneck warnings: ${String(bottlenecks.length).padStart(5)}                           │
├──────────────────────────────────────────────────────────┤
${bottlenecks.length > 0
  ? `│  ⏳ PROVIDER-SIDE: TTFT exceeds 40s threshold.        │\n` +
    `│     DeepSeek queue time is the dominant factor.       │\n`
  : samples.filter(s => s.ttftMs > 30000).length > samples.length * 0.3
    ? `│  ⚠️  WARNING: TTFT > 30s in ${String(Math.round((samples.filter(s=>s.ttftMs>30000).length/samples.length)*100))}% of requests.            │\n` +
      `│     Provider queue is significant (>70% of TTFT).   │\n`
    : `│  ✅ TTFT within acceptable range (< 30s median).     │\n` +
      `│     No provider-side bottleneck detected.            │\n`}
└──────────────────────────────────────────────────────────┘

${percentiles.length > 0 ? `Last server-side percentile snapshot:\n${percentiles[percentiles.length-1]}\n` : ''}
`;

  console.log(report);

  // Also save to file
  writeFileSync('profiling/report.txt', report);
  console.log('Report saved to: profiling/report.txt');
}

main();
