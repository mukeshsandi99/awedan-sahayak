/**
 * Fact Extractor — Extracts deterministic facts from input form data.
 *
 * Extracts structured facts (names, dates, places, amounts, etc.)
 * from form key-value pairs. Free-text fields use conservative regex.
 * Nothing is inferred — only explicit values are extracted.
 */

export interface ExtractedFacts {
  // People
  applicantName: string | null;
  parentSpouseName: string | null;
  accusedNames: string[];
  witnesses: string[];
  // Dates & Times
  incidentDate: string | null;
  incidentTime: string | null;
  dates: string[]; // all dates found
  // Places
  village: string | null;
  post: string | null;
  thana: string | null;
  district: string | null;
  state: string | null;
  // Numbers
  amounts: string[]; // monetary amounts
  ages: string[];
  phoneNumbers: string[];
  // Identifiers
  plotNumbers: string[];
  khataNumbers: string[];
  documentNumbers: string[];
  vehicleNumbers: string[];
  // Relationships
  relationships: string[];
  // Narrative
  injuries: string[];
  threats: string[];
  incidentSequence: string[]; // phrases describing what happened
}

// ── Field name to fact key mapping ───────────────────────────────────────

const FIELD_MAP: Array<{ keys: string[]; target: keyof ExtractedFacts }> = [
  { keys: ['applicant_name', 'deponent_name', 'petitioner_name', 'missing_person_name', 'child_name'], target: 'applicantName' },
  { keys: ['parent_spouse_name', 'father_name', 'father_husband_name', 'deponent_father_name'], target: 'parentSpouseName' },
  { keys: ['village'], target: 'village' },
  { keys: ['post', 'post_office'], target: 'post' },
  { keys: ['thana', 'police_station'], target: 'thana' },
  { keys: ['district'], target: 'district' },
  { keys: ['state'], target: 'state' },
  { keys: ['incident_date'], target: 'incidentDate' },
  { keys: ['incident_time'], target: 'incidentTime' },
];

const ARRAY_FIELDS: Array<{ keys: string[]; target: keyof ExtractedFacts }> = [
  { keys: ['accused_name', 'accused_names', 'encroacher_name', 'opposing_party', 'opposing_party_name', 'respondent_name', 'threat_source'], target: 'accusedNames' },
  { keys: ['witnesses', 'witness_present'], target: 'witnesses' },
];

// Direct-to-array fields — values placed directly into the array
const DIRECT_ARRAY_MAP: Array<{ keys: string[]; target: keyof ExtractedFacts }> = [
  { keys: ['khasra_number', 'plot_number'], target: 'plotNumbers' },
  { keys: ['khata_number'], target: 'khataNumbers' },
  { keys: ['document_number'], target: 'documentNumbers' },
  { keys: ['vehicle_number', 'registration_number'], target: 'vehicleNumbers' },
];

// ── Regex patterns ───────────────────────────────────────────────────────

const AMOUNT_PATTERN = /(?:रु\.?|₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)|(\d{2,})\s*(?:रुपये|रुपया|rupees)/gi;
const DATE_PATTERN = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/g;
const KHATA_PATTERN = /खाता\s*(?:नं\.?|संख्या)?\s*[:#]?\s*(\d[\d\-\/]*)/gi;
const PLOT_PATTERN = /(?:खसरा|प्लॉट|खतौनी|Khasra|Plot)\s*(?:नं\.?|संख्या)?\s*[:#]?\s*(\d[\d\-\/]*)/gi;
const VEHICLE_PATTERN = /[A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,3}\s*\d{1,4}/gi;
const AGE_PATTERN = /(?:उम्र|आयु|Age)\s*[:#]?\s*(\d{1,3})\s*(?:वर्ष|साल|years?)?/gi;
const PHONE_PATTERN = /(?:\+91[\s\-]?)?[6-9]\d{9}\b/g;

// ── Main extraction ──────────────────────────────────────────────────────

export function extractFacts(formData: Record<string, string>): ExtractedFacts {
  const facts: ExtractedFacts = {
    applicantName: null,
    parentSpouseName: null,
    accusedNames: [],
    witnesses: [],
    incidentDate: null,
    incidentTime: null,
    dates: [],
    village: null,
    post: null,
    thana: null,
    district: null,
    state: null,
    amounts: [],
    ages: [],
    phoneNumbers: [],
    plotNumbers: [],
    khataNumbers: [],
    documentNumbers: [],
    vehicleNumbers: [],
    relationships: [],
    injuries: [],
    threats: [],
    incidentSequence: [],
  };

  // 1. Direct field mapping
  for (const { keys, target } of FIELD_MAP) {
    for (const key of keys) {
      const val = formData[key]?.trim();
      if (val) { (facts as any)[target] = val; break; }
    }
  }

  // 1b. Auto-extract date from incident_date field
  if (facts.incidentDate) {
    facts.dates.push(facts.incidentDate);
  }

  // 2. Array fields (comma-separated)
  for (const { keys, target } of ARRAY_FIELDS) {
    for (const key of keys) {
      const val = formData[key]?.trim();
      if (val) {
        (facts as any)[target] = val.split(/[,;]|\s+और\s+/).map((s: string) => s.trim()).filter(Boolean);
        break;
      }
    }
  }

  // 2b. Direct array fields (single values → array)
  for (const { keys, target } of DIRECT_ARRAY_MAP) {
    for (const key of keys) {
      const val = formData[key]?.trim();
      if (val) {
        const existing = (facts as any)[target] as string[];
        if (!existing.includes(val)) existing.push(val);
        break;
      }
    }
  }

  // 3. Regex extraction from narrative fields
  const narratives = selectNarrativeFields(formData);
  for (const text of narratives) {
    // Dates
    let m: any;
    while ((m = DATE_PATTERN.exec(text)) !== null) {
      facts.dates.push(`${m[1]}/${m[2]}/${m[3]}`);
    }
    // Amounts
    while ((m = AMOUNT_PATTERN.exec(text)) !== null) {
      facts.amounts.push((m[1] || m[2]).replace(/,/g, ''));
    }
    // Khata numbers
    while ((m = KHATA_PATTERN.exec(text)) !== null) {
      facts.khataNumbers.push(m[1]);
    }
    // Plot numbers
    while ((m = PLOT_PATTERN.exec(text)) !== null) {
      facts.plotNumbers.push(m[1]);
    }
    // Vehicle numbers
    while ((m = VEHICLE_PATTERN.exec(text)) !== null) {
      facts.vehicleNumbers.push(m[0]);
    }
    // Ages
    while ((m = AGE_PATTERN.exec(text)) !== null) {
      facts.ages.push(m[1]);
    }
    // Phone numbers
    while ((m = PHONE_PATTERN.exec(text)) !== null) {
      facts.phoneNumbers.push(m[0]);
    }
  }

  // Deduplicate arrays
  for (const key of Object.keys(facts) as (keyof ExtractedFacts)[]) {
    if (Array.isArray(facts[key])) {
      (facts as any)[key] = [...new Set((facts as any)[key])];
    }
  }

  return facts;
}

/** Select narrative text fields for regex scanning. */
function selectNarrativeFields(formData: Record<string, string>): string[] {
  const narrativeKeys = [
    'incident_details', 'complaint_details', 'grievance_details',
    'threat_details', 'encroachment_details', 'dispute_details',
    'incident_history', 'description', 'custom_description',
    'dowry_demands', 'refusal_details', 'appeal_grounds',
    'statement_of_facts', 'facts_of_case', 'specific_details',
  ];
  return narrativeKeys
    .map((k) => formData[k])
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

export default extractFacts;
