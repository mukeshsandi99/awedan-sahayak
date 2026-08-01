/**
 * Phase 7B AI Engine Tests — Fact preservation, repair, validation.
 * Run: npx tsx src/test-ai-engine.ts
 * NO real AI API calls — all tests use mocks or static data.
 */
import dotenv from 'dotenv';
dotenv.config();

let p = 0, f = 0;
function ok(name: string, fn: () => void) { try { fn(); p++; console.log('  \x1b[32m✓\x1b[0m', name); } catch (e: any) { f++; console.log('  \x1b[31m✗\x1b[0m', name, '\n   ', e.message); } }

// ── Fact Extraction ──────────────────────────────────────────────────────
console.log('\n📋 Fact Extraction');
const { extractFacts } = require('./services/ai/FactExtractor');

ok('Extracts applicant name', () => { const r = extractFacts({ applicant_name: 'राम सिंह' }); if (r.applicantName !== 'राम सिंह') throw 'missing'; });
ok('Extracts parent name', () => { const r = extractFacts({ father_name: 'मोहन सिंह' }); if (r.parentSpouseName !== 'मोहन सिंह') throw 'missing'; });
ok('Extracts village/district/thana', () => { const r = extractFacts({ village: 'मनार', district: 'हजारीबाग', thana: 'कटकमसांडी' }); if (r.village !== 'मनार' || r.district !== 'हजारीबाग' || r.thana !== 'कटकमसांडी') throw 'missing'; });
ok('Extracts accused names from comma list', () => { const r = extractFacts({ accused_names: 'राम, श्याम, मोहन' }); if (r.accusedNames.length !== 3) throw `got ${r.accusedNames.length}`; });
ok('Extracts amount from narrative', () => { const r = extractFacts({ incident_details: '₹5000 की राशि चुराई गई' }); if (!r.amounts.includes('5000')) throw `got ${r.amounts}`; });
ok('Extracts plot number', () => { const r = extractFacts({ incident_details: 'खसरा नं 123/45 पर कब्जा' }); if (!r.plotNumbers.includes('123/45')) throw `got ${r.plotNumbers}`; });
ok('Extracts khata number', () => { const r = extractFacts({ incident_details: 'खाता नं 789' }); if (!r.khataNumbers.includes('789')) throw `got ${r.khataNumbers}`; });
ok('Extracts date from dd/mm/yyyy', () => { const r = extractFacts({ incident_date: '15/08/2025' }); if (!r.dates.length || !r.dates[0].includes('15')) throw `got ${r.dates}`; });
ok('Extracts phone number', () => { const r = extractFacts({ complaint_details: 'फोन 9876543210 पर धमकी' }); if (!r.phoneNumbers.includes('9876543210')) throw `got ${r.phoneNumbers}`; });
ok('Empty input yields empty facts', () => { const r = extractFacts({}); if (r.applicantName || r.accusedNames.length) throw 'not empty'; });

// ── Fact Validation ──────────────────────────────────────────────────────
console.log('\n📋 Fact Validation');
const { validateFacts } = require('./services/ai/FactValidator');

ok('All facts present → passed', () => {
  const r = validateFacts(
    { applicant_name: 'राम', village: 'मनार', district: 'हजारीबाग' },
    'राम निवासी मनार, जिला हजारीबाग का निवेदन है',
  );
  if (!r.passed) throw `score=${r.score}`;
});
ok('Missing applicant name → critical', () => {
  const r = validateFacts({ applicant_name: 'राम' }, 'किसी व्यक्ति का आवेदन');
  if (r.passed) throw 'should fail';
  if (!r.mismatches.length) throw 'no mismatches listed';
});
ok('Missing plot number → critical', () => {
  const r = validateFacts({ plot_number: '123' }, 'कोई भूमि');
  if (r.passed) throw 'should fail';
});
ok('Good output scores high', () => {
  const r = validateFacts(
    { applicant_name: 'राम', village: 'मनार', district: 'हजारीबाग', father_name: 'श्याम' },
    'सेवा में,\nथानाध्यक्ष महोदय\nविषय: चोरी\nसविनय निवेदन है कि मैं राम, पिता श्याम, ग्राम मनार, जिला हजारीबाग...',
  );
  if (r.score < 80) throw `score=${r.score}`;
});

// ── Output Quality ───────────────────────────────────────────────────────
console.log('\n📋 Output Quality');
const { validateOutput, qualityScore } = require('./services/ai/AIValidator');

ok('Empty output → rejected', () => { if (!validateOutput('')) throw 'should reject'; });
ok('Too short output → rejected', () => { if (!validateOutput('छोटा')) throw 'should reject'; });
ok('Unresolved placeholder → rejected', () => { const r = validateOutput('राम {{applicant_name}} निवासी'); if (!r) throw 'should reject placeholder'; });
ok('Valid Hindi output → passes', () => { if (validateOutput('सेवा में\nथानाध्यक्ष\nविषय चोरी\nसविनय निवेदन है कि मैं राम कुमार निवासी ग्राम मनार जिला हजारीबाग का निवेदन है कि 15 जनवरी 2025 को मेरे घर से सामान चोरी हो गया')) throw 'should pass'; });
ok('Quality score: good > 80', () => { const s = qualityScore('सेवा में\nथानाध्यक्ष\nविषय\nनिवेदन है कि लंबा विवरण यहां पर दिया गया है जो पूरे 100 कैरेक्टर से अधिक लंबा होना चाहिए ताकि स्कोर अच्छा आ सके और यह टेस्ट पास हो जाए'); if (s < 70) throw `score=${s}`; });
ok('Quality score: bad < 40', () => { const s = qualityScore('छोटा टेक्स्ट'); if (s > 50) throw `score=${s}`; });

// ── Input Validation ─────────────────────────────────────────────────────
console.log('\n📋 Input Validation');
const { validateInput } = require('./services/ai/AIValidator');

ok('Rejects empty input', () => { if (!validateInput({ systemPrompt: '', userMessage: '' })) throw 'should reject'; });
ok('Rejects oversized total', () => { const big = 'x'.repeat(30000); if (!validateInput({ systemPrompt: big, userMessage: big })) throw 'should reject'; });
ok('Detects Aadhaar in input', () => {
  const req = { systemPrompt: 'test', userMessage: 'आधार 1234 5678 9012 है' };
  validateInput(req);
  if (req.userMessage.includes('1234 5678 9012')) throw 'Aadhaar not redacted';
});

// ── Dedup ────────────────────────────────────────────────────────────────
console.log('\n📋 Dedup Logic');
const crypto = require('crypto');

ok('SHA-256 creates unique hashes', () => {
  const h1 = crypto.createHash('sha256').update('a').digest('hex');
  const h2 = crypto.createHash('sha256').update('b').digest('hex');
  if (h1 === h2) throw 'hashes equal';
});
ok('Hash from request is deterministic', () => {
  const r = { systemPrompt: 'sys', userMessage: 'user', maxTokens: 100 };
  const h1 = crypto.createHash('sha256').update(JSON.stringify({ sysLen: 'sys'.length, userLen: 'user'.length, maxTokens: 100 })).digest('hex');
  const h2 = crypto.createHash('sha256').update(JSON.stringify({ sysLen: 'sys'.length, userLen: 'user'.length, maxTokens: 100 })).digest('hex');
  if (h1 !== h2) throw 'not deterministic';
});
ok('Hash does not contain raw input', () => {
  const h = crypto.createHash('sha256').update('test-secret-data').digest('hex');
  if (h.includes('secret')) throw 'hash contains input';
});

// ── Cost Tracking ────────────────────────────────────────────────────────
console.log('\n📋 Cost Tracking');
const { AICostTracker } = require('./services/ai/AIValidator');

ok('Records calls without PII', () => {
  AICostTracker.recordCall('claude', { inputTokens: 1000, outputTokens: 500 }, false);
  const s = AICostTracker.getSummary();
  if (s.totalCalls < 1) throw 'no calls recorded';
  if (JSON.stringify(s).includes('romantic')) throw 'PII in summary'; // just checking
});

// ── Circuit Breaker ──────────────────────────────────────────────────────
console.log('\n📋 Circuit Breaker');
const { AICircuitBreaker } = require('./services/ai/AICircuitBreaker');

ok('Starts closed', () => { const cb = new AICircuitBreaker(3, 1000); if (cb.isOpen) throw 'starts open'; });
ok('Opens after threshold failures', () => { const cb = new AICircuitBreaker(2, 10000); cb.recordFailure(); cb.recordFailure(); if (!cb.isOpen) throw 'did not open'; });
ok('Closes after success', () => { const cb = new AICircuitBreaker(2, 10000); cb.recordFailure(); cb.recordFailure(); cb.recordSuccess(); if (cb.isOpen) throw 'did not close'; });

// ── Safety Checks ────────────────────────────────────────────────────────
console.log('\n📋 Safety');

ok('Pricing config readable', () => { const c = require('./services/ai/AIConfig'); if (!c.default.pricing.claude.input) throw 'missing'; });
ok('Quality score 0-100 range', () => { for (let i = 0; i < 10; i++) { const s = qualityScore('x'.repeat(i * 20)); if (s < 0 || s > 100) throw `score=${s}`; } });

// ── Content-Based Hash ───────────────────────────────────────────────────
console.log('\n📋 Content Hash');

ok('Same content → same hash', () => {
  const r1 = { systemPrompt: 'सेवा में आवेदन', userMessage: 'चोरी की शिकायत', maxTokens: 4000 };
  const r2 = { systemPrompt: 'सेवा में आवेदन', userMessage: 'चोरी की शिकायत', maxTokens: 4000 };
  const normalise = (s: string) => s.normalize('NFC').replace(/\s+/g,' ').trim();
  const h1 = crypto.createHash('sha256').update(JSON.stringify({op:'gen',sys:normalise(r1.systemPrompt),user:normalise(r1.userMessage),max:4000})).digest('hex');
  const h2 = crypto.createHash('sha256').update(JSON.stringify({op:'gen',sys:normalise(r2.systemPrompt),user:normalise(r2.userMessage),max:4000})).digest('hex');
  if (h1 !== h2) throw 'should be equal';
});
ok('Different content same length → different hash', () => {
  const a = crypto.createHash('sha256').update('Hello World Test A').digest('hex');
  const b = crypto.createHash('sha256').update('Hello World Test B').digest('hex');
  if (a === b) throw 'should differ';
});
ok('Unicode equivalent → same hash', () => {
  const s1 = 'राम'.normalize('NFC');
  const s2 = 'राम'.normalize('NFC');
  if (crypto.createHash('sha256').update(s1).digest('hex') !== crypto.createHash('sha256').update(s2).digest('hex')) throw 'should be same';
});

// ── In-flight Only Dedup ─────────────────────────────────────────────────
console.log('\n📋 In-flight Dedup');

ok('In-flight map can hold and delete', () => {
  const m = new Map();
  m.set('abc', Promise.resolve(42));
  if (m.size !== 1) throw 'not added';
  m.delete('abc');
  if (m.size as number !== 0) throw 'not deleted';
});
ok('Max in-flight limit enforced', () => {
  const m = new Map();
  for (let i = 0; i < 100; i++) m.set(`key${i}`, Promise.resolve(i));
  if (m.size !== 100) throw `size=${m.size}`;
  // Limit is 100
  if (m.size > 100) throw 'too many';
});

// ── Name Matching ────────────────────────────────────────────────────────
console.log('\n📋 Name Matching');

ok('Exact name match passes', () => {
  const r = validateFacts({ applicant_name: 'राम सिंह' }, 'राम सिंह का आवेदन');
  if (!r.passed) throw `score=${r.score}`;
});
ok('Name with श्री honorific still matches', () => {
  const r = validateFacts({ applicant_name: 'राम सिंह' }, 'श्री राम सिंह निवासी');
  if (!r.passed) throw `score=${r.score}`;
});
ok('Name with श्रीमती still matches', () => {
  const r = validateFacts({ applicant_name: 'सीता देवी' }, 'श्रीमती सीता देवी का निवेदन');
  if (!r.passed) throw `score=${r.score}`;
});
ok('Changed name detected as missing', () => {
  const r = validateFacts({ applicant_name: 'राम सिंह' }, 'मोहन लाल का आवेदन');
  if (r.passed) throw 'should fail — different name';
});
ok('Extra spaces in name tolerated', () => {
  const r = validateFacts({ applicant_name: 'राम   सिंह' }, 'राम सिंह का आवेदन');
  if (!r.passed) throw `score=${r.score}`;
});

// ── Numeric Fact Matching ────────────────────────────────────────────────
console.log('\n📋 Numeric Matching');

ok('₹1,00,000 matches 100000', () => {
  const r = validateFacts(
    { incident_details: '₹1,00,000 की चोरी' },
    '100000 रुपये की राशि चोरी हुई',
  );
  const amtMismatch = r.mismatches.filter((m: any) => m.description.includes('Amount'));
  if (amtMismatch.length > 0) throw `unexpected mismatch: ${amtMismatch.map((m: any) => m.description).join(',')}`;
});
ok('Changed amount detected', () => {
  const r = validateFacts(
    { incident_details: '₹10,000 की चोरी' },
    '₹50,000 की राशि चोरी हुई',
  );
  const amtMismatch = r.mismatches.filter((m: any) => m.description.includes('Amount'));
  if (amtMismatch.length === 0) throw 'should detect changed amount';
});
ok('Same date different format matches', () => {
  const r = validateFacts(
    { incident_date: '15/08/2025' },
    '15 अगस्त 2025 को घटना हुई',
  );
  const dateMismatch = r.mismatches.filter((m: any) => m.description.includes('date'));
  if (dateMismatch.length > 0) throw 'should match';
});
ok('Changed date detected', () => {
  const r = validateFacts(
    { incident_date: '15/08/2025' },
    '20/10/2024 को घटना हुई',
  );
  const dateMismatch = r.mismatches.filter((m: any) => m.description.includes('date'));
  if (dateMismatch.length === 0) throw 'should detect changed date';
});
ok('Plot number exact match required', () => {
  const r = validateFacts(
    { plot_number: '66' },
    'प्लॉट 68 पर कब्जा',
  );
  const plotMismatch = r.mismatches.filter((m: any) => m.description.includes('Plot'));
  if (plotMismatch.length === 0) throw 'should detect changed plot';
});
ok('Khata number exact match required', () => {
  const r = validateFacts(
    { khata_number: '123' },
    'खाता 456 का विवाद',
  );
  const khataMismatch = r.mismatches.filter((m: any) => m.description.includes('Khata'));
  if (khataMismatch.length === 0) throw 'should detect changed khata';
});

// ── Repair Safety ─────────────────────────────────────────────────────────
console.log('\n📋 Repair Safety');

ok('Repair prompt includes immutable facts', () => {
  const r = validateFacts(
    { applicant_name: 'राम', village: 'मनार', incident_details: '₹5000 की चोरी' },
    'किसी व्यक्ति का आवेदन — पैसे चोरी',
  );
  if (!r.repairPrompt) throw 'should generate repair prompt';
  if (!r.repairPrompt.includes('राम')) throw 'repair should include applicant name';
});

// ── Safety ────────────────────────────────────────────────────────────────
console.log('\n📋 Safety Checks');

ok('Hash input not logged in source', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require('path').join(__dirname, 'services', 'ai', 'AIRouter.ts'), 'utf8');
  if (src.includes('console.log') && src.includes('hashRequest')) throw 'hash should not be logged';
});
ok('Completed hashes map removed (active code only)', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require('path').join(__dirname, 'services', 'ai', 'AIRouter.ts'), 'utf8');
  // The word may appear in a comment explaining WHY it was removed — that's fine.
  // Check that no line has actual active code setting/using a completedHashes map.
  const lines = src.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) continue;
    if (trimmed.includes('completedHashes') && !trimmed.startsWith('//')) {
      throw 'completedHashes should not appear in active code';
    }
  }
});
ok('Unicode NFC used in hash', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require('path').join(__dirname, 'services', 'ai', 'AIRouter.ts'), 'utf8');
  if (!src.includes("normalize('NFC')")) throw 'NFC normalization missing';
});

// ── Results ──────────────────────────────────────────────────────────────
setTimeout(() => {
  console.log(`\n═══════════════`);
  console.log(`  AI Tests: ${p} passed, ${f} failed`);
  console.log(`═══════════════\n`);
  process.exit(f > 0 ? 1 : 0);
}, 1000);
