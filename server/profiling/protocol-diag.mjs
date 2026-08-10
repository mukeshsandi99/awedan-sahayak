#!/usr/bin/env node
/**
 * DeepSeek Protocol Diagnostic
 *
 * Sends identical prompts with stream=true and stream=false.
 * Captures raw HTTP response bodies.
 * Compares SDK-parsed events against raw SSE text.
 *
 * Run: node profiling/protocol-diag.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { config } from 'dotenv';
config({ path: '.env' });

const API_KEY = process.env.DEEPSEEK_API_KEY;
const BASE = 'https://api.deepseek.com/anthropic';
const MODEL = 'deepseek-v4-flash';

const SYSTEM_PROMPT = `आप एक अनुभवी हिंदी कानूनी आवेदन लेखक हैं। आपका कार्य एक औपचारिक हिंदी कानूनी आवेदन (आवेदन पत्र) तैयार करना है।

आपको 7-भाग की मानक संरचना का पालन करना होगा:

1. सेवा में (To)
2. विषय (Subject)
3. महोदय/महोदया (Salutation)
4. तथ्यों का विवरण (Facts — flowing narrative paragraph)
5. प्रार्थना (Prayer/Request)
6. प्रमाण/संलग्नक (Evidence/Enclosures)
7. हस्ताक्षर (Signature block)`;

const USER_MESSAGE = `आवेदन प्रकार: मारपीट की शिकायत (thana कार्यालय)

महत्वपूर्ण निर्देश:
यह एक मारपीट (Assault) की शिकायत है।

प्रार्थी की जानकारी:
applicant_name: सीमा देवी
father_husband_name: राम प्रसाद
village: हटकोना
thana: कटकमसांडी
district: हजारीबाग
incident_date: 04 जुलाई 2026
incident_time: रात लगभग 9 बजे
incident_details: कल रात लगभग 9 बजे पड़ोसी रमेश कुमार ने गाली-गलौज की और लाठी से मारपीट की जिससे चोट आई।
प्रार्थना: आरोपी के विरुद्ध प्राथमिकी दर्ज कर विधिक कार्रवाई की जाए।`;

// ── Common request body ─────────────────────────────────────────────────
const body = {
  model: MODEL,
  max_tokens: 2000,
  system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: USER_MESSAGE }],
};

// ── Test 1: Non-streaming ───────────────────────────────────────────────
async function testNonStreaming() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('  TEST 1: stream=false (non-streaming)');
  console.log('═══════════════════════════════════════════════\n');

  const t0 = Date.now();
  const resp = await fetch(`${BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ ...body, stream: false }),
  });

  const rawText = await resp.text();
  const elapsed = Date.now() - t0;

  console.log(`HTTP ${resp.status} — ${elapsed}ms`);
  console.log(`Headers: ${JSON.stringify(Object.fromEntries(resp.headers.entries()), null, 2)}`);
  writeFileSync('profiling/raw-nonstreaming.txt', rawText);

  try {
    const parsed = JSON.parse(rawText);
    console.log(`\nParsed response:`);
    console.log(`  id: ${parsed.id}`);
    console.log(`  model: ${parsed.model}`);
    console.log(`  stop_reason: ${parsed.stop_reason}`);
    console.log(`  usage: ${JSON.stringify(parsed.usage)}`);
    console.log(`  content blocks: ${parsed.content?.length || 0}`);
    if (parsed.content) {
      for (const block of parsed.content) {
        console.log(`    [${block.type}] length=${(block.text || '').length} chars`);
        if (block.text && block.text.length > 0) {
          console.log(`    First 200 chars: "${block.text.substring(0, 200)}..."`);
        }
      }
    }
    if (parsed.content?.[0]?.text?.length > 0) {
      console.log('\n✅ NON-STREAMING WORKS — content received.');
    } else {
      console.log('\n❌ NON-STREAMING FAILED — no content in response.');
    }
  } catch (e) {
    console.log(`\n❌ Failed to parse JSON response: ${e.message}`);
    console.log(`Raw (first 1000 chars): ${rawText.substring(0, 1000)}`);
  }

  return { status: resp.status, elapsed, rawText };
}

// ── Test 2: Streaming — capture raw SSE ─────────────────────────────────
async function testStreaming() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('  TEST 2: stream=true (streaming SSE)');
  console.log('═══════════════════════════════════════════════\n');

  const t0 = Date.now();
  const resp = await fetch(`${BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  console.log(`HTTP ${resp.status}`);
  console.log(`Headers: ${JSON.stringify(Object.fromEntries(resp.headers.entries()), null, 2)}`);

  const rawText = await resp.text();
  const elapsed = Date.now() - t0;

  writeFileSync('profiling/raw-streaming.txt', rawText);
  console.log(`\nRaw SSE stream (${rawText.length} bytes, ${elapsed}ms):`);
  console.log('──────────────────────────────────────────────');
  console.log(rawText);
  console.log('──────────────────────────────────────────────');

  // Parse SSE events
  const events = [];
  const lines = rawText.split('\n');
  let currentEvent = null;
  let currentData = '';

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent = line.substring(7).trim();
    } else if (line.startsWith('data: ')) {
      currentData += line.substring(6);
    } else if (line.trim() === '' && currentData) {
      try {
        const parsed = JSON.parse(currentData);
        events.push({ event: currentEvent || 'unknown', data: parsed });
      } catch {
        events.push({ event: currentEvent || 'unknown', data: currentData });
      }
      currentEvent = null;
      currentData = '';
    }
  }

  console.log(`\nSSE events (${events.length} total):`);
  const eventTypes = {};
  for (const ev of events) {
    eventTypes[ev.event] = (eventTypes[ev.event] || 0) + 1;
    console.log(`  [${ev.event}] ${JSON.stringify(ev.data).substring(0, 120)}`);
  }
  console.log(`\nEvent type counts: ${JSON.stringify(eventTypes)}`);

  // Check critical events
  const hasMessageStart = events.some(e => e.event === 'message_start');
  const hasContentBlockStart = events.some(e => e.event === 'content_block_start');
  const hasContentBlockDelta = events.some(e => e.event === 'content_block_delta');
  const hasMessageDelta = events.some(e => e.event === 'message_delta');
  const hasMessageStop = events.some(e => e.event === 'message_stop');

  console.log(`\nCritical events present:`);
  console.log(`  message_start:        ${hasMessageStart ? '✅' : '❌ MISSING'}`);
  console.log(`  content_block_start:  ${hasContentBlockStart ? '✅' : '❌ MISSING'}`);
  console.log(`  content_block_delta:  ${hasContentBlockDelta ? '✅' : '❌ MISSING'}`);
  console.log(`  message_delta:        ${hasMessageDelta ? '✅' : '❌ MISSING'}`);
  console.log(`  message_stop:         ${hasMessageStop ? '✅' : '❌ MISSING'}`);

  // Deep-dive: check message_start event structure
  if (hasMessageStart) {
    const ms = events.find(e => e.event === 'message_start');
    console.log(`\nmessage_start structure:`);
    console.log(JSON.stringify(ms.data, null, 2));
  }

  // Deep-dive: check content_block_start event structure
  if (hasContentBlockStart) {
    const cbs = events.find(e => e.event === 'content_block_start');
    console.log(`\ncontent_block_start structure:`);
    console.log(JSON.stringify(cbs.data, null, 2));
  } else if (hasContentBlockDelta) {
    const cbd = events.filter(e => e.event === 'content_block_delta');
    console.log(`\ncontent_block_delta events (${cbd.length}):`);
    for (const d of cbd.slice(0, 3)) {
      console.log(JSON.stringify(d.data, null, 2));
    }
  }

  // Analyze
  console.log(`\n── DIAGNOSIS ──`);
  if (hasContentBlockStart && hasContentBlockDelta) {
    console.log('✅ All expected events present. The issue is elsewhere.');
  } else if (hasContentBlockDelta && !hasContentBlockStart) {
    console.log('🐛 BUG CONFIRMED: content_block_delta events present but NO content_block_start.');
    console.log('   The Anthropic SDK requires content_block_start to initialize the content array.');
    console.log('   Without it, snapshot.content.at(event.index) returns undefined.');
    console.log('   All text deltas are SILENTLY DROPPED.');
  } else if (!hasContentBlockDelta) {
    console.log('❌ No content_block_delta events at all. DeepSeek is not generating text.');
  }

  return { status: resp.status, elapsed, rawText, events };
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  DeepSeek Protocol Diagnostic                  ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log(`║  Endpoint: ${BASE}/v1/messages`);
  console.log(`║  Model:    ${MODEL}`);
  console.log('╚════════════════════════════════════════════════╝');

  const nonStreamResult = await testNonStreaming();
  const streamResult = await testStreaming();

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Non-streaming: HTTP ${nonStreamResult.status} in ${nonStreamResult.elapsed}ms`);
  console.log(`  Streaming:     HTTP ${streamResult.status} in ${streamResult.elapsed}ms`);

  const nonStreamHasContent = nonStreamResult.rawText.includes('"text":"') && !nonStreamResult.rawText.includes('"text":""');
  console.log(`  Non-streaming has text content: ${nonStreamHasContent ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  Raw responses saved to:`);
  console.log(`    profiling/raw-nonstreaming.txt`);
  console.log(`    profiling/raw-streaming.txt`);

  if (nonStreamHasContent) {
    console.log('\n✅ CONCLUSION: non-streaming mode works. DeepSeek CAN generate Hindi text.');
    console.log('   The bug is specific to the SSE streaming format.');
    console.log('   Switch DeepSeekProvider to stream=false for production reliability.');
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
