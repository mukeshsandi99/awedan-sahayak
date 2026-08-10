/**
 * ForbiddenDetector — Post-generation validation that AI output contains
 * NO unsupported allegations, inventions, or embellishments.
 *
 * Every check is driven by what the user ACTUALLY stated in input.
 * If a phrase/concept is not in supportedFacts, it is flagged.
 */

export interface ForbiddenFinding {
  category: string;
  phrase: string;
  severity: 'CRITICAL' | 'WARNING';
  description: string;
}

export interface ForbiddenResult {
  passed: boolean;
  findings: ForbiddenFinding[];
}

// ── Category definitions ─────────────────────────────────────────────────

interface CategoryDef {
  id: string;
  severity: 'CRITICAL' | 'WARNING';
  patterns: RegExp[];
  description: string;
}

/**
 * Categories that MUST NOT appear in output unless explicitly in input.
 * Each category has regex patterns to detect the concept even if phrased differently.
 */
const CATEGORIES: CategoryDef[] = [
  // ── Caste/Community slurs ────────────────────────────────────────────
  {
    id: 'caste_slur',
    severity: 'CRITICAL',
    patterns: [
      /जाति\s*सूचक/,
      /जातिसूचक/,
      /जाति\s*गत/,
      /जातिगत/,
      /जातीय/,
      /जाति.*गाली/,
      /caste\s*ist/i,
    ],
    description: 'Caste-based slur or allegation — not stated by user',
  },

  // ── Death threats ─────────────────────────────────────────────────────
  {
    id: 'death_threat',
    severity: 'CRITICAL',
    patterns: [
      /जान\s*से\s*मार/,
      /हत्या\s*की\s*धमकी/,
      /मार\s*डालने\s*की\s*धमकी/,
      /जीवन\s*से\s*हाथ\s*धो/,
      /जान\s*लेवा/,
      /जीवन\s*का\s*खतरा/,
      /प्राण\s*घातक/,
      /प्राणघातक/,
      /kill.*threat/i,
      /death.*threat/i,
    ],
    description: 'Death threat or murder threat — not stated by user',
  },

  // ── Weapons ───────────────────────────────────────────────────────────
  {
    id: 'weapons',
    severity: 'CRITICAL',
    patterns: [
      /हथियार/,
      /बंदूक/,
      /चाकू/,
      /लाठी/,
      /तलवार/,
      /धारदार/,
      /भाला/,
      /कुल्हाड़ी/,
      /फरसा/,
      /पिस्टल/,
      /रिवाल्वर/,
      /गोली/,
      /असलाह/,
      /weapon|gun|knife|rifle/i,
    ],
    description: 'Weapon mentioned — not stated by user',
  },

  // ── Ancestral/Inherited land ──────────────────────────────────────────
  {
    id: 'ancestral_land',
    severity: 'CRITICAL',
    patterns: [
      /पूर्वजों\s*(?:से|की)/,
      /बाप\s*दादा/,
      /पुश्तैनी/,
      /वंशानुगत/,
      /पुरखों/,
      /ancestral|inherited/i,
    ],
    description: 'Ancestral/inherited land claim — user did not state this ownership basis',
  },

  // ── Father's revenue record ownership ─────────────────────────────────
  {
    id: 'father_revenue_record',
    severity: 'CRITICAL',
    patterns: [
      /पिता\s*के\s*नाम\s*(?:से\s*)?(?:राजस्व|दर्ज|रिकॉर्ड|खतियान)/,
      /राजस्व\s*अभिलेख\s*में\s*पिता/,
      /पिता\s*के\s*नाम\s*दर्ज/,
      /father.*revenue/i,
      /father.*record/i,
    ],
    description: 'Father\'s revenue record claim — user did not state this',
  },

  // ── Serious injury / blood / hospital ─────────────────────────────────
  {
    id: 'serious_injury',
    severity: 'CRITICAL',
    patterns: [
      /गंभीर\s*चोट/,
      /खून\s*बह/,
      /खून\s*निकल/,
      /अस्पताल\s*(?:में\s*)?भर्ती/,
      /गंभीर\s*रूप\s*से\s*घायल/,
      /हड्डी\s*टूट/,
      /फ्रैक्चर/,
      /चोटिल/,
      /hospitalized|serious\s*injury|fracture/i,
    ],
    description: 'Serious injury / blood / hospitalization — not stated by user',
  },

  // ── FIR / Legal section request (ALLOWED for police applications) ────
  // Only reject INVENTED PRIOR FIR history, not normal police-action requests.
  {
    id: 'prior_fir_history',
    severity: 'CRITICAL',
    patterns: [
      /पहले\s*से\s*(?:ही\s*)?(?:FIR|प्राथमिकी|एफ\.?\s*आई\.?\s*आर\.?)\s*(?:दर्ज|मौजूद|है)/,
      /(?:पूर्व|पहले)\s*(?:में\s*)?(?:FIR|प्राथमिकी|एफ\.?\s*आई\.?\s*आर\.?)\s*(?:दर्ज|संख्या|नं)/,
      /पूर्व\s*में\s*दर्ज\s*प्राथमिकी/,
      /पिछली\s*(?:FIR|प्राथमिकी)/,
      /(?:FIR|प्राथमिकी)\s*(?:संख्या|नं\.?|No\.?)\s*\d/,
      /prior\s*FIR|existing\s*FIR|previous\s*FIR/i,
    ],
    description: 'Prior/existing FIR history invented — not stated by user',
  },

  // ── Invented arrest ──────────────────────────────────────────────────
  {
    id: 'invented_arrest',
    severity: 'CRITICAL',
    patterns: [
      /गिरफ्तार\s*(?:कर|किया)/,
      /गिरफ्तारी/,
      /हिरासत\s*में\s*ले/,
    ],
    description: 'Arrest/detention claim invented — not stated by user',
  },

  // ── Invented legal sections ──────────────────────────────────────────
  {
    id: 'invented_legal_sections',
    severity: 'WARNING',
    patterns: [
      /धारा\s*\d{2,4}/,
      /IPC\s*\d/,
      /CrPC\s*\d/,
      /BNS\s*\d/,
    ],
    description: 'Legal section (IPC/CrPC/BNS) invented — not stated by user',
  },

  // ── Medical report ───────────────────────────────────────────────────
  {
    id: 'medical_report',
    severity: 'WARNING',
    patterns: [
      /मेडिकल\s*रिपोर्ट/,
      /चिकित्सा\s*रिपोर्ट/,
      /चिकित्सकीय\s*प्रमाण/,
      /डॉक्टर\s*का\s*प्रमाण/,
      /medical\s*report|doctor.*certificate/i,
    ],
    description: 'Medical report claim — not stated by user',
  },

  // ── Court order ──────────────────────────────────────────────────────
  {
    id: 'court_order',
    severity: 'WARNING',
    patterns: [
      /न्यायालय\s*(?:का|से)\s*आदेश/,
      /कोर्ट\s*(?:का|से)\s*ऑर्डर/,
      /कोर्ट\s*आर्डर/,
      /अदालत\s*का\s*फैसला/,
      /न्यायिक\s*आदेश/,
      /court\s*order|judicial\s*order/i,
    ],
    description: 'Court order/decision claim — not stated by user',
  },

  // ── Attempt to murder ────────────────────────────────────────────────
  {
    id: 'attempt_murder',
    severity: 'CRITICAL',
    patterns: [
      /हत्या\s*का\s*प्रयास/,
      /हत्या\s*की\s*कोशिश/,
      /मार\s*डालने\s*का\s*प्रयास/,
      /attempt.*murder/i,
    ],
    description: 'Attempt to murder claim — not stated by user',
  },

  // ── Police complaint history ──────────────────────────────────────────
  {
    id: 'police_history',
    severity: 'WARNING',
    patterns: [
      /पहले\s*भी\s*(?:शिकायत|FIR|एफ\.?\s*आई\.?\s*आर\.?|प्राथमिकी)/,
      /पूर्व\s*में\s*(?:शिकायत|FIR)/,
      /पूर्व\s*शिकायत/,
      /पिछली\s*शिकायत/,
    ],
    description: 'Prior police complaint/FIR history — not stated by user',
  },
];

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Detect forbidden inventions in AI-generated output.
 *
 * @param generatedText  The AI-generated application text.
 * @param supportedFacts Structured facts from user input (used to check
 *                       if a detected phrase was actually in the input).
 * @returns ForbiddenResult with any violations found.
 */
export function detectForbiddenInventions(
  generatedText: string,
  supportedAllegations: string[],
): ForbiddenResult {
  const findings: ForbiddenFinding[] = [];

  // Build a single sanitized string of all user-stated facts
  const userInputStr = supportedAllegations.join(' ');

  for (const cat of CATEGORIES) {
    for (const pattern of cat.patterns) {
      const match = generatedText.match(pattern);
      if (!match) continue;

      const matchedPhrase = match[0];

      // Check if this phrase/concept exists in user's input
      const isSupported = cat.patterns.some(p => p.test(userInputStr)) ||
        userInputStr.includes(matchedPhrase);

      if (!isSupported) {
        findings.push({
          category: cat.id,
          phrase: matchedPhrase,
          severity: cat.severity,
          description: cat.description,
        });
        break; // One finding per category is enough
      }
    }
  }

  return {
    passed: findings.filter(f => f.severity === 'CRITICAL').length === 0,
    findings,
  };
}

/**
 * Check if generated text adds ownership language
 * not present in the user's input.
 */
export function checkOwnershipSafety(
  generatedText: string,
  userOwnershipBasis: string,
): { safe: boolean; violation?: string } {
  if (!userOwnershipBasis?.trim()) return { safe: true };

  const basis = userOwnershipBasis.trim();

  // Check for forbidden ownership rewrites
  const forbiddenRewrites = [
    { pattern: /पूर्वजों\s*से\s*चली\s*आ\s*रही/, desc: 'ancestral ownership claim invented' },
    { pattern: /पिता\s*के\s*नाम\s*(?:से\s*)?राजस्व/, desc: 'father revenue record invented' },
    { pattern: /बाप\s*दादा\s*के\s*समय\s*से/, desc: 'inherited from forefathers invented' },
    { pattern: /विरासत\s*में\s*मिली/, desc: 'inherited claim invented' },
  ];

  for (const { pattern, desc } of forbiddenRewrites) {
    if (pattern.test(generatedText) && !pattern.test(basis)) {
      return { safe: false, violation: desc };
    }
  }

  // Check that user's actual wording appears
  // For "हक हिस्सा", verify it's preserved or safely reworded
  if (basis.includes('हक') || basis.includes('हिस्सा')) {
    if (!generatedText.includes('हक') && !generatedText.includes('हिस्सा')) {
      return {
        safe: false,
        violation: `Ownership basis "${basis}" lost or replaced in output`,
      };
    }
  }

  return { safe: true };
}

/**
 * Check if generated text strengthens an allegation beyond what user stated.
 */
export function checkAllegationSafety(
  generatedText: string,
  userAllegations: string[],
): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const userStr = userAllegations.join(' ');

  // If user only said "मारपीट" but output says "गंभीर मारपीट" — flag it
  const strengtheningPairs: Array<{ userHas: RegExp; strongerInOutput: RegExp; desc: string }> = [
    {
      userHas: /मारपीट/,
      strongerInOutput: /गंभीर\s*मारपीट|बेरहमी\s*से\s*मारपीट|निर्मम\s*मारपीट|बर्बर\s*मारपीट/,
      desc: 'मारपीट strengthened to "गंभीर/बेरहम मारपीट"',
    },
    {
      userHas: /गाली/,
      strongerInOutput: /जातिसूचक\s*गाली|जाति\s*सूचक\s*गाली|अपशब्द/,
      desc: 'गाली strengthened to "जातिसूचक गाली"',
    },
    {
      userHas: /धमकी|धमका/,
      strongerInOutput: /जान\s*से\s*मारने\s*की\s*धमकी|हत्या\s*की\s*धमकी/,
      desc: 'धमकी strengthened to "जान से मारने की धमकी"',
    },
  ];

  for (const { userHas, strongerInOutput, desc } of strengtheningPairs) {
    // Only check if user DID state the base allegation but did NOT state the stronger version
    if (userHas.test(userStr) && !strongerInOutput.test(userStr)) {
      if (strongerInOutput.test(generatedText)) {
        violations.push(desc);
      }
    }
  }

  return { safe: violations.length === 0, violations };
}

export default detectForbiddenInventions;
