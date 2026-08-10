/**
 * ProtectedFacts — Structured immutable fact model for legal application generation.
 *
 * Every person gets their own relationship entry. Grouped inputs like
 * "रंजीत, अनूप दोनों के पिता स्वर्गीय राजकुमार" are expanded deterministically.
 *
 * NOTHING is inferred. Only explicitly stated facts are stored.
 */

export interface ProtectedPerson {
  /** Full name as stated in input. */
  name: string;
  /** Relation type: पिता, पति, माता, etc. */
  relationType: string;
  /** The related person's name. */
  relationName: string;
  /** Village/place of this person, if stated. */
  village?: string;
}

export interface ProtectedFacts {
  // ── Applicant ─────────────────────────────────────────────────────────
  applicantName: string;
  applicantFatherName?: string;
  applicantVillage?: string;
  applicantPost?: string;
  applicantThana?: string;
  applicantDistrict?: string;
  applicantState?: string;
  applicantMobile?: string;

  // ── People (accused, witnesses, etc.) ─────────────────────────────────
  /** Every person with their exact relationship mapping. */
  people: ProtectedPerson[];

  // ── Land / Property ───────────────────────────────────────────────────
  village?: string;
  khataNumber?: string;
  plotNumber?: string;
  areaRakba?: string;
  ownershipBasis?: string; // e.g. "हक हिस्सा" — must preserve exactly

  // ── Allegations ───────────────────────────────────────────────────────
  /** Only allegations explicitly stated by user. */
  allegations: string[];

  // ── Dates / Amounts ───────────────────────────────────────────────────
  dates: string[];
  amounts: string[];
  phoneNumbers: string[];

  // ── Other immutable values ────────────────────────────────────────────
  /** All other key-value pairs from form that must be preserved. */
  other: Map<string, string>;
}

// ── Factory ──────────────────────────────────────────────────────────────

/** Empty fact set — use factory methods to populate. */
export function createEmptyFacts(): ProtectedFacts {
  return {
    applicantName: '',
    people: [],
    allegations: [],
    dates: [],
    amounts: [],
    phoneNumbers: [],
    other: new Map(),
  };
}

/**
 * Extract ProtectedFacts from formData (React Native form object).
 * The form keys are in snake_case English — e.g. applicant_name, accused_name, etc.
 */
export function extractProtectedFacts(formData: Record<string, string>): ProtectedFacts {
  const facts = createEmptyFacts();

  // ── Applicant identity ───────────────────────────────────────────────
  facts.applicantName = formData['applicant_name']?.trim() || '';
  facts.applicantFatherName = formData['father_name']?.trim() ||
    formData['parent_spouse_name']?.trim() || '';
  facts.applicantVillage = formData['village']?.trim() || '';
  facts.applicantPost = formData['post']?.trim() || formData['post_office']?.trim() || '';
  facts.applicantThana = formData['thana']?.trim() ||
    formData['police_station']?.trim() || formData['police_station_name']?.trim() || '';
  facts.applicantDistrict = formData['district']?.trim() || '';
  facts.applicantState = formData['state']?.trim() || '';
  facts.applicantMobile = formData['mobile']?.trim() ||
    formData['applicant_phone']?.trim() || formData['phone']?.trim() || '';

  // ── Land ─────────────────────────────────────────────────────────────
  facts.village = formData['village']?.trim() || '';
  facts.khataNumber = formData['khata_number']?.trim() ||
    formData['khasra_number']?.trim() || formData['khata']?.trim() || '';
  facts.plotNumber = formData['plot_number']?.trim() ||
    formData['khasra_number']?.trim() || formData['plot']?.trim() || '';
  facts.areaRakba = formData['area']?.trim() || formData['rakba']?.trim() || '';
  facts.ownershipBasis = formData['ownership']?.trim() || '';

  // ── Amounts (comma-separated) ────────────────────────────────────────
  const amountRaw = formData['amount']?.trim() || formData['amounts']?.trim() || '';
  if (amountRaw) facts.amounts = amountRaw.split(/[,;]\s*/).filter(Boolean);

  // ── Phone numbers ────────────────────────────────────────────────────
  if (facts.applicantMobile) facts.phoneNumbers.push(facts.applicantMobile);
  const extraPhones = formData['phone_numbers']?.trim() || '';
  if (extraPhones) {
    facts.phoneNumbers.push(...extraPhones.split(/[,;]\s*/).map(p => p.trim()).filter(Boolean));
  }
  // Deduplicate
  facts.phoneNumbers = [...new Set(facts.phoneNumbers)];

  // ── Dates ────────────────────────────────────────────────────────────
  const incidentDate = formData['incident_date']?.trim() || formData['date']?.trim() || '';
  if (incidentDate) facts.dates.push(incidentDate);

  // ── Allegations ──────────────────────────────────────────────────────
  const allegationsStr = formData['allegations']?.trim() ||
    formData['incident_details']?.trim() ||
    formData['complaint_details']?.trim() ||
    formData['custom_description']?.trim() || '';
  if (allegationsStr) {
    facts.allegations = allegationsStr
      .split(/[।.]\s*/)
      .map(s => s.trim())
      .filter(s => s.length > 3);
  }

  // ── People (accused, etc.) ───────────────────────────────────────────
  facts.people = parseAccusedPeople(formData);

  // ── Other fields ─────────────────────────────────────────────────────
  for (const [key, val] of Object.entries(formData)) {
    if (val?.trim() && !key.startsWith('_')) {
      facts.other.set(key, val.trim());
    }
  }

  return facts;
}

// ── Accused/Person parser ────────────────────────────────────────────────

/**
 * Parse accused/people with relationships from form data.
 *
 * Handles multiple input patterns:
 * 1. Flat lists with separate father fields per person:
 *    accused_name: "रंजीत यादव, अनूप यादव"
 *    accused_father_name: "स्वर्गीय राजकुमार यादव, स्वर्गीय राजकुमार यादव"
 *
 * 2. Single accused name with single father:
 *    accused_name: "रंजीत यादव"
 *    accused_father_name: "स्वर्गीय राजकुमार यादव"
 *
 * 3. Grouped relationship in description fields:
 *    "रंजीत यादव, अनूप यादव दोनों के पिता स्वर्गीय राजकुमार यादव"
 */
function parseAccusedPeople(formData: Record<string, string>): ProtectedPerson[] {
  const people: ProtectedPerson[] = [];

  // ── Try structured field pairs ──────────────────────────────────────
  const nameKeys = [
    'accused_name', 'accused_names', 'encroacher_name', 'opposing_party',
    'opposing_party_name', 'respondent_name',
  ];
  const fatherKeys = [
    'accused_father_name', 'accused_father', 'encroacher_father_name',
    'opposing_party_father_name', 'respondent_father_name',
  ];
  const villageKeys = [
    'accused_village', 'encroacher_village', 'opposing_party_village',
    'respondent_village',
  ];

  let rawNames = '';
  let rawFathers = '';
  let rawVillages = '';

  for (const k of nameKeys) { if (formData[k]?.trim()) { rawNames = formData[k].trim(); break; } }
  for (const k of fatherKeys) { if (formData[k]?.trim()) { rawFathers = formData[k].trim(); break; } }
  for (const k of villageKeys) { if (formData[k]?.trim()) { rawVillages = formData[k].trim(); break; } }

  const names = splitPersonList(rawNames);
  const fathers = splitPersonList(rawFathers);
  const villages = splitPersonList(rawVillages);

  // Map names to fathers by position
  for (let i = 0; i < names.length; i++) {
    people.push({
      name: names[i],
      relationType: detectRelationType(formData),
      relationName: fathers[i] || '',
      village: villages[i] || undefined,
    });
  }

  // ── Parse grouped relationships from description fields ─────────────
  const descFields = [
    'custom_description', 'incident_details', 'complaint_details',
    'description', 'threat_details', 'encroachment_details',
  ];
  for (const key of descFields) {
    const text = formData[key]?.trim();
    if (!text) continue;
    const parsed = parseGroupedRelationships(text);
    for (const p of parsed) {
      // Avoid duplicates
      if (!people.some(existing =>
        existing.name === p.name && existing.relationName === p.relationName)) {
        people.push(p);
      }
    }
  }

  return people;
}

// ── Grouped relationship parser ──────────────────────────────────────────

interface GroupMatch {
  names: string[];
  relationType: string;
  relationName: string;
}

/**
 * Parse grouped relationship patterns like:
 *   "रंजीत यादव, अनूप यादव दोनों के पिता स्वर्गीय राजकुमार यादव"
 *   "पोखन, खिरोधर, मोहन, प्रेम चारों के पिता स्वर्गीय तिलक यादव"
 */
const GROUP_PATTERNS = [
  // "दोनों के पिता X", "तीनों के पिता X", "चारों के पिता X", "सभी के पिता X"
  // Matches: names... numbers_word के relation_type name
  /([^।]+?)\s*(दोनों|तीनों|चारों|पाँचों|छहों|सातों|आठों|सभी|सब)\s*(?:के|की)\s*(पिता|माता|पति|पत्नी|भाई|बहन|चाचा|मामा|बेटा|बेटी|पुत्र|पुत्री)\s+(.+?)(?:\s*$|[।,;])/g,
];

function parseGroupedRelationships(text: string): ProtectedPerson[] {
  const people: ProtectedPerson[] = [];

  for (const pattern of GROUP_PATTERNS) {
    let match: RegExpExecArray | null;
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const namesPart = match[1].trim();
      const relationType = match[3].trim();
      const relationName = match[4].trim();

      // Split the names part by commas, "और", "एवं"
      const names = namesPart
        .split(/[,;]|\s+और\s+|\s+एवं\s+/)
        .map(n => n.trim())
        .filter(n => n.length > 1);

      for (const name of names) {
        people.push({
          name,
          relationType,
          relationName,
        });
      }
    }
  }

  return people;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Split comma/word-separated person list into individual names. */
function splitPersonList(raw: string): string[] {
  if (!raw?.trim()) return [];
  return raw.split(/[,;]|\s+और\s+|\s+एवं\s+/).map(s => s.trim()).filter(Boolean);
}

/** Detect relation type from form fields. */
function detectRelationType(formData: Record<string, string>): string {
  if (formData['relation_type']?.trim()) return formData['relation_type'].trim();
  // Default: पिता is most common in legal applications
  return 'पिता';
}

// ── Serialize for prompts ────────────────────────────────────────────────

/**
 * Build an IMMUTABLE FACTS block for the AI system/user prompt.
 * Every fact is in a format the AI cannot misinterpret.
 */
export function buildImmutableFactsBlock(facts: ProtectedFacts): string {
  const lines: string[] = [];

  lines.push('=== IMMUTABLE FACTS — THESE MUST APPEAR EXACTLY AS SHOWN ===');
  lines.push('');

  // Applicant
  lines.push('APPLICANT:');
  lines.push(`  Name: ${facts.applicantName}`);
  if (facts.applicantFatherName) lines.push(`  Father/Husband: ${facts.applicantFatherName}`);
  if (facts.applicantVillage) lines.push(`  Village: ${facts.applicantVillage}`);
  if (facts.applicantThana) lines.push(`  Thana: ${facts.applicantThana}`);
  if (facts.applicantDistrict) lines.push(`  District: ${facts.applicantDistrict}`);
  if (facts.applicantMobile) lines.push(`  Mobile: ${facts.applicantMobile}`);
  lines.push('');

  // Accused/People with relationships
  if (facts.people.length > 0) {
    lines.push('ACCUSED PERSONS WITH RELATIONSHIPS (each person → their exact relation):');
    for (const p of facts.people) {
      if (p.relationName) {
        lines.push(`  ${p.name} → ${p.relationType}: ${p.relationName}${p.village ? ` (ग्राम: ${p.village})` : ''}`);
      } else {
        lines.push(`  ${p.name}${p.village ? ` (ग्राम: ${p.village})` : ''}`);
      }
    }
    lines.push('');
  }

  // Land
  if (facts.khataNumber || facts.plotNumber || facts.ownershipBasis) {
    lines.push('LAND/PROPERTY:');
    if (facts.village) lines.push(`  Village: ${facts.village}`);
    if (facts.khataNumber) lines.push(`  Khata: ${facts.khataNumber}`);
    if (facts.plotNumber) lines.push(`  Plot: ${facts.plotNumber}`);
    if (facts.areaRakba) lines.push(`  Area: ${facts.areaRakba}`);
    if (facts.ownershipBasis) lines.push(`  Ownership basis (exact wording): "${facts.ownershipBasis}"`);
    lines.push('');
  }

  // Allegations
  if (facts.allegations.length > 0) {
    lines.push('ALLEGATIONS (only these — do not strengthen, embellish, or invent):');
    for (const a of facts.allegations) {
      lines.push(`  - ${a}`);
    }
    lines.push('');
  }

  // Dates & Amounts
  if (facts.dates.length > 0) lines.push(`DATES: ${facts.dates.join(', ')}`);
  if (facts.amounts.length > 0) lines.push(`AMOUNTS: ${facts.amounts.join(', ')}`);
  if (facts.phoneNumbers.length > 0) lines.push(`PHONE: ${facts.phoneNumbers.join(', ')}`);
  lines.push('');

  lines.push('FORBIDDEN INVENTIONS — DO NOT ADD ANY OF THESE UNLESS EXPLICITLY STATED ABOVE:');
  lines.push('  - जातिसूचक शब्द / caste-based abuse');
  lines.push('  - जान से मारने की धमकी / death threats');
  lines.push('  - हथियार / weapons (लाठी, चाकू, बंदूक, तलवार, etc.)');
  lines.push('  - पूर्वजों की जमीन / ancestral land claims');
  lines.push('  - पिता के नाम राजस्व रिकॉर्ड / father\'s revenue record ownership');
  lines.push('  - गंभीर चोट / serious injury / खून / blood / hospital');
  lines.push('  - FIR / case number / police complaint number');
  lines.push('  - Medical report / मेडिकल रिपोर्ट');
  lines.push('  - Court order / कोर्ट का आदेश');
  lines.push('  - Any legal section (IPC, CrPC, BNS) not stated by user');
  lines.push('');
  lines.push('Do not infer, strengthen, embellish, or legally dramatize any allegation.');
  lines.push('=== END IMMUTABLE FACTS ===');

  return lines.join('\n');
}

// ── Serialize for deterministic fallback ─────────────────────────────────

/** Build plain facts summary for deterministic fallback generation. */
export function buildFactsSummary(facts: ProtectedFacts): string {
  const parts: string[] = [];

  parts.push(`प्रार्थी: ${facts.applicantName}`);
  if (facts.applicantFatherName) parts.push(`पिता/पति: ${facts.applicantFatherName}`);
  if (facts.applicantVillage) parts.push(`ग्राम: ${facts.applicantVillage}`);
  if (facts.applicantThana) parts.push(`थाना: ${facts.applicantThana}`);
  if (facts.applicantDistrict) parts.push(`जिला: ${facts.applicantDistrict}`);

  if (facts.people.length > 0) {
    parts.push(`\nअभियुक्तगण:`);
    for (const p of facts.people) {
      parts.push(`  - ${p.name}, ${p.relationType}: ${p.relationName || '(अज्ञात)'}`);
    }
  }

  if (facts.village && facts.khataNumber) {
    parts.push(`\nभूमि: ग्राम ${facts.village}, खाता ${facts.khataNumber}${facts.plotNumber ? `, प्लॉट ${facts.plotNumber}` : ''}`);
    if (facts.ownershipBasis) parts.push(`स्वामित्व: ${facts.ownershipBasis}`);
  }

  if (facts.allegations.length > 0) {
    parts.push(`\nआरोप: ${facts.allegations.join('; ')}`);
  }

  return parts.join('\n');
}

export default extractProtectedFacts;
