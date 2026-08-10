/**
 * LIVE PRODUCTION TEST — Santosh Yadav Fixture
 * Runs against https://awedan-sahayak-api.onrender.com
 * Run: npx tsx src/test-live-santosh.ts
 */
import { extractProtectedFacts } from './services/ai/ProtectedFacts';
import { validateRelationships } from './services/ai/RelationshipValidator';
import { detectForbiddenInventions, checkOwnershipSafety, checkAllegationSafety } from './services/ai/ForbiddenDetector';
import { computeFactDiff, sanitizeForProduction } from './services/ai/FactDiff';

const API_BASE = 'https://awedan-sahayak-api.onrender.com';
const APP_TOKEN = 'awedan-sahayak-mobile-app-2026';

const FIXTURE = {
  applicationName: 'मारपीट एवं गाली-गलौज से संबंधित प्रार्थना पत्र',
  officeType: 'thana',
  promptTemplate: 'थाना में शिकायत',
  formData: {
    applicant_name: 'संतोष यादव',
    father_name: 'मुंशी यादव',
    village: 'होरिया',
    thana: 'पदमा',
    district: 'हजारीबाग',
    state: 'झारखंड',
    mobile: '1234567890',
    accused_name: 'रंजीत यादव, अनूप यादव, पोखन यादव, खिरोधर यादव, मोहन यादव, प्रेम यादव, नकुल यादव, अजय यादव',
    accused_father_name: 'स्वर्गीय राजकुमार यादव, स्वर्गीय राजकुमार यादव, स्वर्गीय तिलक यादव, स्वर्गीय तिलक यादव, स्वर्गीय तिलक यादव, स्वर्गीय तिलक यादव, प्रेम यादव, सिविल यादव',
    accused_village: 'नवादी',
    custom_description: 'रंजीत यादव, अनूप यादव दोनों के पिता स्वर्गीय राजकुमार यादव। पोखन यादव, खिरोधर यादव, मोहन यादव, प्रेम यादव चारों के पिता स्वर्गीय तिलक यादव। नकुल यादव पिता प्रेम यादव। अजय यादव पिता सिविल यादव। सभी ग्राम नवादी, पोस्ट कुट्टी पीसी, थाना पदमा, जिला हजारीबाग, झारखंड के निवासी हैं। पूरे परिवार के साथ मारपीट, गाली-गलौज, पहले भी गाली-गलौज, लगातार धमकाते मारते-पीटते रहते हैं, दबंग किस्म के लोग।',
    khata_number: '96',
    plot_number: '1267',
    ownership: 'मेरा हक हिस्सा का है',
  },
};

async function callApi(endpoint: string, body: any): Promise<any> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Token': APP_TOKEN,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

function validateOutput(text: string, run: number) {
  console.log(`\n━━━ RUN ${run} ━━━`);
  console.log(`Generated: ${text.length} chars`);

  const facts = extractProtectedFacts(FIXTURE.formData);
  const relResult = validateRelationships(facts, text);
  const forbidden = detectForbiddenInventions(text, facts.allegations);
  const ownership = checkOwnershipSafety(text, facts.ownershipBasis || '');
  const allegation = checkAllegationSafety(text, facts.allegations);
  const diff = computeFactDiff(facts, text, relResult, forbidden, ownership.safe, allegation.safe);

  console.log(`Relationships: ${relResult.passed ? 'PASS' : 'FAIL'} (${relResult.errors.length} errors)`);
  for (const e of relResult.errors) {
    console.log(`  [${e.type}] ${e.detail}`);
  }

  console.log(`Forbidden: ${forbidden.passed ? 'PASS' : 'FAIL'} (${forbidden.findings.length} findings)`);
  for (const f of forbidden.findings) {
    console.log(`  [${f.severity}] ${f.description}: "${f.phrase}"`);
  }

  console.log(`Ownership: ${ownership.safe ? 'SAFE' : 'VIOLATION'}`);
  if (!ownership.safe) console.log(`  ${ownership.violation}`);

  console.log(`Allegation: ${allegation.safe ? 'SAFE' : 'STRENGTHENED'}`);

  console.log(`FactDiff: ${sanitizeForProduction(diff)}`);
  console.log(`Overall: ${diff.status}`);

  // Check specific relationships
  const expectedFathers: Record<string, string> = {
    'रंजीत यादव': 'स्वर्गीय राजकुमार यादव',
    'अनूप यादव': 'स्वर्गीय राजकुमार यादव',
    'पोखन यादव': 'स्वर्गीय तिलक यादव',
    'खिरोधर यादव': 'स्वर्गीय तिलक यादव',
    'मोहन यादव': 'स्वर्गीय तिलक यादव',
    'प्रेम यादव': 'स्वर्गीय तिलक यादव',
    'नकुल यादव': 'प्रेम यादव',
    'अजय यादव': 'सिविल यादव',
  };
  let relMatches = 0;
  for (const [name, father] of Object.entries(expectedFathers)) {
    if (text.includes(name) && text.includes(father)) relMatches++;
  }
  console.log(`Rel matches: ${relMatches}/8`);

  // Check forbidden inventions
  const forbiddenChecks: Record<string, string[]> = {
    'Death threat': ['जान से मारने', 'जान से मार'],
    'Caste slur': ['जातिसूचक', 'जाति सूचक'],
    'Weapons': ['हथियार', 'लाठी', 'बंदूक', 'चाकू'],
    'Ancestral land': ['पूर्वजों', 'पुश्तैनी'],
    'Father revenue': ['पिता के नाम राजस्व', 'राजस्व अभिलेख'],
    'FIR': ['प्राथमिकी', 'एफआईआर'],
    'Medical': ['गंभीर चोट', 'मेडिकल', 'अस्पताल'],
    'Arrest': ['गिरफ्तार'],
    'IPC/BNS': ['धारा'],
  };

  let inventions = 0;
  for (const [label, patterns] of Object.entries(forbiddenChecks)) {
    for (const p of patterns) {
      if (text.includes(p)) {
        console.log(`  INVENTION: ${label} ("${p}")`);
        inventions++;
        break;
      }
    }
  }

  // Check property
  const propertyChecks = ['होरिया', '96', '1267', 'हक'];
  const propOk = propertyChecks.every(c => text.includes(c));
  console.log(`Property: ${propOk ? 'PRESERVED' : 'MISSING'}`);

  return {
    passed: diff.status === 'PASS',
    relErrors: relResult.errors.length,
    forbiddenFindings: forbidden.findings.length,
    relMatches,
    inventions,
    propOk,
    diff,
  };
}

async function main() {
  console.log('========================================');
  console.log('LIVE PRODUCTION FACT PRESERVATION TEST');
  console.log('Santosh Yadav Fixture — 5 runs');
  console.log('========================================');
  console.log(`Server: ${API_BASE}`);

  // Check health
  try {
    const health = await (await fetch(`${API_BASE}/api/health`, {
      headers: { 'X-App-Token': APP_TOKEN },
    })).json();
    console.log(`Health: ${JSON.stringify(health)}`);
  } catch (e: any) {
    console.log(`Health: FAILED — ${e.message}`);
    console.log('Server may be cold-starting. Continuing anyway...');
  }

  const results: any[] = [];
  let totalPass = 0;

  for (let run = 1; run <= 5; run++) {
    console.log(`\n>>> Run ${run}/5 — Sending request...`);
    try {
      const apiResp = await callApi('/api/generate-application', FIXTURE);
      if (apiResp.error) {
        console.log(`API error: ${apiResp.error}`);
        results.push({ run, error: apiResp.error });
        continue;
      }

      const text = apiResp.generatedText || '';
      console.log(`Metadata: provider=${apiResp.metadata?.provider}, model=${apiResp.metadata?.model}, repair=${apiResp.metadata?.repairApplied ?? false}, fallback=${apiResp.metadata?.fallbackUsed ?? false}`);

      // Show first 500 chars
      console.log(`\n--- Output preview (first 500 chars) ---`);
      console.log(text.substring(0, 500));
      console.log('--- End preview ---');
      const valResult = validateOutput(text, run);
      results.push(valResult);
      if (valResult.passed) totalPass++;

      // Small delay between runs
      if (run < 5) await new Promise(r => setTimeout(r, 2000));
    } catch (e: any) {
      console.log(`Run ${run} failed: ${e.message}`);
      results.push({ run, error: e.message });
    }
  }

  // ── Summary ────────────────────────────────────────────────────────
  console.log('\n\n========================================');
  console.log('FINAL SUMMARY');
  console.log('========================================');

  for (const r of results) {
    if (r.error) {
      console.log(`Run ${r.run}: ERROR — ${r.error}`);
    } else {
      console.log(`Run ${r.run}: ${r.passed ? 'PASS' : 'FAIL'} | rel=${r.relMatches}/8 matches | forbidden=${r.forbiddenFindings} | inventions=${r.inventions} | ${r.diff?.status}`);
    }
  }

  console.log(`\nTotal: ${totalPass}/5 passed`);
  console.log(totalPass === 5 ? '✅ ALL LIVE TESTS PASSED' : '❌ SOME LIVE TESTS FAILED');
}

main().catch(console.error);
