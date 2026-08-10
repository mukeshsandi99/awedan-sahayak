#!/usr/bin/env node
/**
 * DeepSeek Profiling Runner
 * Sends 30 requests to localhost:3000 with >=2-min spacing.
 * Logs results to profiling/results.jsonl
 * Run: node profiling/runner.mjs
 */

import { writeFileSync, appendFileSync } from 'fs';

const API_URL = 'http://localhost:3000/api/generate-application';
const COUNT = 30;
const INTERVAL_MS = 125_000; // 125s = 2min 5s
const RESULT_FILE = 'profiling/results.jsonl';

const BASE_PAYLOAD = {
  applicationName: 'मारपीट की शिकायत',
  officeType: 'thana',
  promptTemplate: `आवेदन प्रकार: मारपीट की शिकायत (thana कार्यालय)

महत्वपूर्ण निर्देश:
यह एक मारपीट (Assault) की शिकायत है। नीचे दिए गए सभी तथ्यों को एक प्रवाहमय कालानुक्रमिक नैरेटिव अनुच्छेद में ढालें। बुलेट पॉइंट न बनाएं।

घटना का वर्णन करते समय:
- आरोपी कब, कहाँ और कैसे आया
- क्या शब्द कहे गए (गाली-गलौज का उल्लेख)
- मारपीट कैसे शुरू हुई और किस हथियार से हुई
- कहाँ-कहाँ चोट आई
- किन गवाहों ने देखा
- चिकित्सीय उपचार कहाँ कराया गया

सिस्टम प्रॉम्प्ट में वर्णित 7-भाग संरचना का सख्ती से पालन करें।
आवेदिका महिला है, इसलिए निवासिन, भवदीया, रहूँगी, आपकी आभारी आदि स्त्रीलिंग रूपों का प्रयोग करें।

प्रार्थना: आरोपी के विरुद्ध प्राथमिकी दर्ज कर विधिक कार्रवाई की जाए।

——— नीचे दिए गए फॉर्म डेटा का ही प्रयोग करें, कोई अन्य नाम/स्थान न बनाएं ———

{{applicant_name}}
{{father_husband_name}}
{{village}}
{{thana}}
{{district}}
{{incident_date}}
{{incident_time}}
{{incident_details}}
{{accused_names}}
{{injury_details}}
{{weapons_used}}
{{medical_report}}
{{witnesses}}
{{gender}}`,
  formData: {
    applicant_name: 'सीमा देवी',
    father_husband_name: 'राम प्रसाद',
    village: 'हटकोना',
    post: 'हटकोना',
    thana: 'कटकमसांडी',
    district: 'हजारीबाग',
    state: 'झारखंड',
    incident_date: 'PLACEHOLDER जुलाई 2026',
    incident_time: 'रात लगभग 9 बजे',
    incident_details: 'कल रात लगभग 9 बजे, जब आवेदिका अपने घर में थी, तभी पड़ोस में रहने वाला रमेश कुमार पिता सुरेश कुमार, ग्राम हटकोना, थाना कटकमसांडी, जिला हजारीबाग आया और बिना किसी कारण के गाली-गलौज करने लगा। जब आवेदिका ने विरोध किया तो रमेश कुमार ने लाठी से आवेदिका के सिर और बाएँ हाथ पर वार किया, जिससे गंभीर चोट आई। (Request #PLACEHOLDER)',
    accused_names: 'रमेश कुमार पिता सुरेश कुमार, ग्राम हटकोना',
    injury_details: 'सिर में चोट, बाएँ हाथ में सूजन और खरोंच',
    weapons_used: 'लाठी',
    medical_report: 'सामुदायिक स्वास्थ्य केंद्र कटकमसांडी से उपचार कराया गया, मेडिकल रिपोर्ट संलग्न',
    witnesses: 'गाँव के ही रहने वाले सुनील कुमार पिता महेश कुमार एवं किरण देवी पति राजेश कुमार घटना के समय उपस्थित थे',
    gender: 'female',
    location: 'ग्राम हटकोना, आवेदिका का निजी आवास',
    request_id: 'PLACEHOLDER',
  },
};

function makePayload(idx) {
  const day = (idx % 28) + 1;
  const payload = JSON.parse(JSON.stringify(BASE_PAYLOAD));
  // Stringify → replace → parse for deep substitution
  const json = JSON.stringify(payload)
    .replace(/"PLACEHOLDER"/g, `"${day}"`)
    .replace(/"PLACEHOLDER/g, `"${day}`);
  return json;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendRequest(idx) {
  const payload = makePayload(idx);
  const startTime = Date.now();

  let httpCode = 0;
  let body = '';
  let error = null;

  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    httpCode = resp.status;
    body = await resp.text();
  } catch (err) {
    error = err.message;
    httpCode = 0;
  }

  const elapsed = Date.now() - startTime;
  let metadata = {};
  try {
    const parsed = JSON.parse(body);
    metadata = parsed.metadata || {};
  } catch {}

  // Parse response body for validation
  let generatedText = '';
  let textLength = 0;
  let bodyParsed = null;
  try {
    bodyParsed = JSON.parse(body);
    generatedText = bodyParsed.generatedText || '';
    textLength = generatedText.length;
  } catch {}

  const result = {
    idx,
    timestamp: new Date().toISOString(),
    httpCode,
    elapsedMs: elapsed,
    provider: metadata.provider || (error ? 'error' : '?'),
    model: metadata.model || '?',
    fallbackUsed: metadata.fallbackUsed || false,
    durationMs: metadata.durationMs || 0,
    inputTokens: metadata.usage?.inputTokens || 0,
    outputTokens: metadata.usage?.outputTokens || 0,
    textLength,
    error: error || null,
  };

  // Validation flags
  const isEmpty = httpCode === 200 && textLength === 0;
  const isTruncated = httpCode === 200 && textLength > 0 && textLength < 100; // <100 chars = incomplete
  const isTokenExhausted = httpCode === 200 && result.outputTokens >= 3990 && textLength < 200;
  const success = httpCode === 200 && textLength >= 100;

  const statusIcon = success ? '✅' : isEmpty ? '🈳' : isTruncated ? '✂️' : httpCode === 429 ? '⚠️' : '❌';
  console.log(
    `${statusIcon} Req ${String(idx).padStart(2, '0')}/30 | HTTP ${httpCode} | ` +
    `${(elapsed / 1000).toFixed(1)}s | ${result.provider}/${result.model} | ` +
    `tokens ${result.inputTokens}/${result.outputTokens} | text ${textLength} chars | fallback=${result.fallbackUsed}`,
  );
  if (isEmpty) console.log('  ⚠️  EMPTY RESPONSE');
  if (isTruncated) console.log('  ⚠️  TRUNCATED (<100 chars)');
  if (isTokenExhausted) console.log('  ⚠️  TOKEN EXHAUSTION (output=' + result.outputTokens + ', text=' + textLength + 'chars)');

  appendFileSync(RESULT_FILE, JSON.stringify(result) + '\n');
  return result;
}

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  DeepSeek Validation — 30 Requests             ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log(`║  Config:  stream=false, thinking=disabled`);
  console.log(`║  Target:  ${API_URL}`);
  console.log(`║  Count:   ${COUNT} requests`);
  console.log(`║  Spacing: ${INTERVAL_MS / 1000}s between requests`);
  console.log(`║  Est dur: ~${Math.round((COUNT * INTERVAL_MS) / 60000)} minutes`);
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');

  // Clear results file
  writeFileSync(RESULT_FILE, '');

  const results = [];
  let success = 0, fail429 = 0, fail500 = 0, failOther = 0;
  let emptyCount = 0, truncatedCount = 0, tokenExhaustCount = 0;

  for (let i = 1; i <= COUNT; i++) {
    const result = await sendRequest(i);
    results.push(result);

    if (result.httpCode === 200 && result.textLength >= 100) {
      success++;
    } else if (result.httpCode === 200 && result.textLength === 0) {
      emptyCount++;
      failOther++;
    } else if (result.httpCode === 200 && result.textLength < 100) {
      truncatedCount++;
      failOther++;
    } else if (result.httpCode === 429) {
      fail429++;
    } else if (result.httpCode >= 500) {
      fail500++;
    } else {
      failOther++;
    }

    // Token exhaustion check
    if (result.httpCode === 200 && result.outputTokens >= 3990 && result.textLength < 200) {
      tokenExhaustCount++;
    }

    if (i < COUNT) {
      console.log(`  ⏳ Sleeping ${INTERVAL_MS / 1000}s until next request...\n`);
      await sleep(INTERVAL_MS);
    }
  }

  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  Validation Complete                           ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log(`║  Success:        ${String(success).padStart(3)} / ${COUNT}`);
  console.log(`║  HTTP 500:       ${String(fail500).padStart(3)}`);
  console.log(`║  HTTP 429:       ${String(fail429).padStart(3)}`);
  console.log(`║  Other errors:   ${String(failOther).padStart(3)}`);
  console.log(`║  Empty responses:${String(emptyCount).padStart(3)}`);
  console.log(`║  Truncated text: ${String(truncatedCount).padStart(3)}`);
  console.log(`║  Token exhaust:  ${String(tokenExhaustCount).padStart(3)}`);
  console.log('╚════════════════════════════════════════════════╝');

  // ── Latency percentiles ──────────────────────────────────────────
  const successResults = results.filter(r => r.httpCode === 200 && r.textLength >= 100);
  const elapsedVals = successResults.map(r => r.elapsedMs).sort((a, b) => a - b);
  const p = (k) => elapsedVals.length > 0 ? elapsedVals[Math.max(0, Math.ceil((k/100) * elapsedVals.length) - 1)] : 0;

  const avgLatency = successResults.length > 0
    ? Math.round(successResults.reduce((a, r) => a + r.elapsedMs, 0) / successResults.length)
    : 0;
  const avgIn = successResults.length > 0
    ? Math.round(successResults.reduce((a, r) => a + r.inputTokens, 0) / successResults.length)
    : 0;
  const avgOut = successResults.length > 0
    ? Math.round(successResults.reduce((a, r) => a + r.outputTokens, 0) / successResults.length)
    : 0;

  console.log('');
  console.log('┌──────────────────────────────────────────────────┐');
  console.log('│  LATENCY (successful requests only)              │');
  console.log('├──────────┬──────────┬──────────┬────────────────┤');
  console.log('│  Average │    p50   │    p90   │    p95   │ p99 │');
  console.log('├──────────┼──────────┼──────────┼──────────┼─────┤');
  console.log(`│ ${String(avgLatency+'ms').padStart(6)}  │ ${String(p(50)+'ms').padStart(6)}  │ ${String(p(90)+'ms').padStart(6)}  │ ${String(p(95)+'ms').padStart(6)}  │ ${String(p(99)+'ms').padStart(4)} │`);
  console.log('└──────────┴──────────┴──────────┴──────────┴─────┘');

  console.log('');
  console.log('┌──────────────────────────────────────────────────┐');
  console.log('│  TOKENS (successful requests only)               │');
  console.log('├──────────────────────┬───────────────────────────┤');
  console.log(`│  Avg input tokens     │  ${String(avgIn).padStart(7)}                    │`);
  console.log(`│  Avg output tokens    │  ${String(avgOut).padStart(7)}                    │`);
  console.log('└──────────────────────┴───────────────────────────┘');

  // ── Final verdict ────────────────────────────────────────────────
  console.log('');
  const allPassed = success === COUNT && fail500 === 0 && fail429 === 0 && failOther === 0
    && emptyCount === 0 && truncatedCount === 0 && tokenExhaustCount === 0;

  if (allPassed) {
    console.log('✅ VERDICT: DeepSeek integration is PRODUCTION-READY.');
    console.log('   All 30 requests succeeded with valid Hindi text.');
    console.log('   No empty responses, no truncation, no token exhaustion.');
    console.log('   No HTTP 500, no HTTP 429.');
  } else {
    console.log('❌ VERDICT: DeepSeek integration FAILED validation.');
    if (fail500 > 0) console.log(`   ${fail500} HTTP 500 errors.`);
    if (fail429 > 0) console.log(`   ${fail429} HTTP 429 rate limits.`);
    if (emptyCount > 0) console.log(`   ${emptyCount} empty responses.`);
    if (truncatedCount > 0) console.log(`   ${truncatedCount} truncated responses.`);
    if (tokenExhaustCount > 0) console.log(`   ${tokenExhaustCount} token exhaustion events.`);
  }

  writeFileSync('profiling/summary.json', JSON.stringify({
    completedAt: new Date().toISOString(),
    total: COUNT,
    success,
    fail429,
    fail500,
    failOther,
  }));
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
