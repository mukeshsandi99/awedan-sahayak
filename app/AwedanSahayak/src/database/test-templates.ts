/**
 * Phase 9B — Template Quality Test Suite
 * Run: npx tsx src/database/test-templates.ts
 */
import { APPLICATION_TYPE_SEEDS } from './seed';
import { NEW_TEMPLATES } from './seed-expansion';
import type { ApplicationTypeInsert } from '../types/database';

let p = 0, f = 0;
function ok(name: string, fn: () => void) {
  try { fn(); p++; console.log('  \x1b[32m✓\x1b[0m', name); }
  catch (e: any) { f++; console.log('  \x1b[31m✗\x1b[0m', name, '\n   ', e.message); }
}

const all: (ApplicationTypeInsert & { _src: string; _idx: number })[] = [
  ...APPLICATION_TYPE_SEEDS.map((t, i) => ({ ...t, _src: 'seed', _idx: i })),
  ...NEW_TEMPLATES.map((t, i) => ({ ...t, _src: 'expansion', _idx: i })),
];

// ── Counts ───────────────────────────────────────────────────────────────
console.log('\n📋 Template Counts');
ok(`Total >= 200 (actual: ${all.length})`, () => { if (all.length < 200) throw `only ${all.length}`; });
ok(`Original 77 preserved (actual: ${APPLICATION_TYPE_SEEDS.length})`, () => { if (APPLICATION_TYPE_SEEDS.length !== 77) throw `${APPLICATION_TYPE_SEEDS.length}`; });

// ── Uniqueness ────────────────────────────────────────────────────────────
console.log('\n📋 Uniqueness');
const seenNameOffice = new Map<string, number>();
for (const t of all) {
  const key = `${t.office_type}|${t.name_hindi}`;
  seenNameOffice.set(key, (seenNameOffice.get(key) ?? 0) + 1);
}
const dupes = [...seenNameOffice.entries()].filter(([, c]) => c > 1);
ok(`No duplicate same-office + Hindi title (${dupes.length} dupes)`, () => { if (dupes.length > 0) throw dupes.map(d => d[0]).join(', '); });

const seenEng = new Map<string, number>();
for (const t of all) {
  const key = `${t.office_type}|${t.name_english}`;
  seenEng.set(key, (seenEng.get(key) ?? 0) + 1);
}
const edupes = [...seenEng.entries()].filter(([k,c]) => c > 1);
// Only flag if same English name in SAME office, and not empty
// Cross-source duplicates are acceptable (same English name, different expansion)
const realEdupes = edupes.filter(([k]) => { const parts = k.split('|'); return parts[1]?.trim().length > 0; });
if (realEdupes.length > 0) {
  console.log(`  ⚠️  ${realEdupes.length} duplicate English title(s) found (info only):`);
  realEdupes.forEach(([k]) => console.log(`      ${k}`));
}
ok(`English titles are unique within source files`, () => {
  // Check within same source only
  const checkDupes = (arr: any[], label: string) => {
    const s = new Map<string,string>();
    for (const t of arr) {
      const k = t.office_type + '|' + (t.name_english||'').trim();
      if (!k.split('|')[1]) continue;
      if (s.has(k)) throw `${label}: duplicate "${k}" in ${t.name_hindi}`;
      s.set(k, t.name_hindi);
    }
  };
  checkDupes(APPLICATION_TYPE_SEEDS, 'seed');
  checkDupes(NEW_TEMPLATES, 'expansion');
});

// ── Completeness ────────────────────────────────────────────────────────
console.log('\n📋 Completeness');
ok('No empty Hindi title', () => { const e = all.filter(t => !t.name_hindi?.trim()); if (e.length) throw `${e.length} empty`; });
ok('No empty English title', () => { const e = all.filter(t => !t.name_english?.trim()); if (e.length) throw `${e.length} empty`; });
ok('No empty prompt', () => { const e = all.filter(t => !t.prompt_template?.trim()); if (e.length) throw `${e.length} empty`; });
ok('No empty keywords', () => { const e = all.filter(t => !t.keywords?.trim() || t.keywords === '[]'); if (e.length) throw `${e.length} empty`; });
ok('All office_type valid', () => {
  const valid = new Set(['thana','block','bdo','co','sdo','sp','dc','court','bank','college','school','pwd','rcd','bcd','transport']);
  const bad = all.filter(t => !valid.has(t.office_type)).map(t => t.name_hindi);
  if (bad.length) throw bad.join(', ');
});

// ── Chinese full stops ───────────────────────────────────────────────────
console.log('\n📋 Unicode Cleanliness');
ok('No Chinese full stops in prompts', () => {
  const bad = all.filter(t => (t.prompt_template ?? '').includes('。'));
  if (bad.length) throw `${bad.length} templates with 。`;
});
ok('No truncated prompts (<50 chars)', () => {
  const bad = all.filter(t => ((t as any).prompt_template ?? '').length < 50);
  if (bad.length) throw bad.map(t => `${t.name_hindi}(${(t as any).prompt_template?.length})`).join(', ');
});

// ── Legal Safety ─────────────────────────────────────────────────────────
console.log('\n📋 Legal Safety');
ok('Court templates have disclaimer', () => {
  const court = all.filter(t => t.office_type === 'court');
  const missing = court.filter(t => !t.requires_legal_disclaimer);
  if (missing.length) throw `${missing.length} court templates missing disclaimer`;
});
ok('No fake FIR claim in prompts', () => {
  const bad = all.filter(t => (t.prompt_template ?? '').includes('FIR दर्ज हो चुका') || (t.prompt_template ?? '').includes('गिरफ्तारी कर'));
  if (bad.length) throw bad.map(t => t.name_hindi).join(', ');
});

// ── Field Safety ─────────────────────────────────────────────────────────
console.log('\n📋 Field Safety');
ok('No full Aadhaar required field', () => {
  const bad = all.filter(t => {
    const fields: string[] = JSON.parse(t.required_fields ?? '[]');
    return fields.some(f => f.includes('aadhaar') && !f.includes('last4'));
  });
  if (bad.length) throw bad.map(t => t.name_hindi).join(', ');
});
ok('No full bank account required (only last4 or generic)', () => {
  const bad = all.filter(t => {
    const fields: string[] = JSON.parse(t.required_fields ?? '[]');
    return fields.some(f => f === 'bank_account_number');
  });
  if (bad.length) throw bad.map(t => t.name_hindi).join(', ');
});
ok('No password/OTP/PIN/CVV field', () => {
  const bad = all.filter(t => {
    const fields: string[] = JSON.parse(t.required_fields ?? '[]');
    return fields.some(f => /password|otp|pin|cvv|secret/i.test(f));
  });
  if (bad.length) throw bad.map(t => t.name_hindi).join(', ');
});

// ── Search Quality ───────────────────────────────────────────────────────
console.log('\n📋 Search Quality');
function search(q: string, minExpected: number) {
  const words = q.split(/\s+/);
  const results = all.filter(t =>
    words.every(w =>
      t.name_hindi.includes(w) || t.name_english?.toLowerCase().includes(w.toLowerCase()) ||
      (t.keywords ?? '').includes(w)
    )
  );
  ok(`Search "${q}" returns >= ${minExpected} (actual: ${results.length})`, () => {
    if (results.length < minExpected) throw `only ${results.length} results`;
  });
}
search('मारपीट', 3);
search('जमीन कब्जा', 2);
search('LPC', 2);
search('पेंशन', 3);
search('बिजली बिल', 2);
search('RTI', 4);
search('राशन', 5);
search('ड्राइविंग लाइसेंस', 1);
search('फसल नुकसान', 1);
search('महिला प्रताड़ना', 1);
search('लोन', 2);
search('स्ट्रीट लाइट', 1);

// ── Results ──────────────────────────────────────────────────────────────
setTimeout(() => {
  console.log(`\n═══════════════`);
  console.log(`  Template Tests: ${p} passed, ${f} failed`);
  console.log(`═══════════════\n`);
  process.exit(f > 0 ? 1 : 0);
}, 1000);
