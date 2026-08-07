/**
 * Protected Fact Validator for revise-application.
 * Ensures identity/location/contact facts survive AI revision.
 */
import { createLogger } from '../config/logger';

const log = createLogger('FactGuard');

// ── Protected keys ──────────────────────────────────────────────────

const PROTECTED_KEYS = [
  'applicant_name', 'parent_spouse_name', 'father_name', 'husband_name',
  'village', 'post', 'thana', 'police_station', 'district', 'state',
  'mobile', 'phone', 'date', 'amount', 'khata', 'plot', 'area',
];

// ── Amount normalization ─────────────────────────────────────────────

function stripAmountFormatting(s: string): string {
  return s.replace(/[₹,,\s]/g, '').trim();
}

const HINDI_DIGITS: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

function normalizeHindiDigits(s: string): string {
  let out = '';
  for (const ch of s) {
    out += HINDI_DIGITS[ch] || ch;
  }
  return out;
}

/** Returns true if both strings represent the same monetary amount. */
function amountsMatch(a: string, b: string): boolean {
  const na = stripAmountFormatting(normalizeHindiDigits(a));
  const nb = stripAmountFormatting(normalizeHindiDigits(b));
  if (na === nb) return true;
  // Also check for Hindi word equivalents
  const words: Record<string, number> = {
    'पच्चीसहजार': 25000, 'पचीसहजार': 25000, 'पच्चीस हजार': 25000,
    'पचीस हजार': 25000,
  };
  for (const [word, num] of Object.entries(words)) {
    const strippedB = b.replace(/[,\s]/g, '');
    if (strippedB.includes(word)) return String(num) === na;
  }
  return false;
}

// ── Fact extraction ──────────────────────────────────────────────────

interface ProtectedFacts {
  keys: string[];
  values: Map<string, string>;
  amount: string | null;
  phones: string[];
}

/** Extract protected facts from formData. */
export function extractProtectedFacts(formData: Record<string, string>): ProtectedFacts {
  const values = new Map<string, string>();
  let amount: string | null = null;
  const phones: string[] = [];

  for (const key of PROTECTED_KEYS) {
    const val = formData[key]?.trim();
    if (!val) continue;
    values.set(key, val);
    if (key === 'amount') amount = val;
    if (key === 'mobile' || key === 'phone') phones.push(val);
  }

  return { keys: PROTECTED_KEYS, values, amount, phones };
}

/** Check if instruction explicitly targets a protected value for change. */
function instructionTargetsValue(instruction: string, value: string): boolean {
  // If the value appears in the instruction, assume user wants to change it
  const norm = value.replace(/[,\s]/g, '');
  const instNorm = instruction.replace(/[,\s]/g, '');
  return instNorm.includes(norm);
}

/** Returns list of protected facts lost during revision. */
export function findLostFacts(
  original: string,
  revised: string,
  formData: Record<string, string>,
  instruction: string,
): string[] {
  const lost: string[] = [];
  const facts = extractProtectedFacts(formData);

  for (const [key, val] of facts.values) {
    // Skip if instruction targets this value for change
    if (instructionTargetsValue(instruction, val)) continue;

    const inOriginal = original.includes(val);

    // Amount: check equivalence
    if (key === 'amount') {
      if (inOriginal && !amountsMatch(val, revised)) {
        // Check if amount appears in any equivalent form
        const revNumeric = revised.replace(/[^0-9]/g, '');
        const valNumeric = val.replace(/[^0-9]/g, '');
        if (!revNumeric.includes(valNumeric)) {
          // Check Hindi word form
          const hasWordForm = amountsMatch(val, revised);
          if (!hasWordForm) lost.push(`amount:${val}`);
        }
      }
      continue;
    }

    // Phone: must appear exactly
    if (key === 'mobile' || key === 'phone') {
      if (inOriginal && !revised.includes(val)) {
        lost.push(`phone:${val}`);
      }
      continue;
    }

    // All other protected facts: must appear exactly if they were in original
    if (inOriginal && !revised.includes(val)) {
      lost.push(val);
    }
  }

  return lost;
}

/**
 * Build a strong "protected facts" block for the AI prompt.
 * Places facts BEFORE the original text so the AI sees them first.
 */
export function buildProtectedBlock(formData: Record<string, string>): string {
  const lines: string[] = [];
  for (const key of PROTECTED_KEYS) {
    const val = formData[key]?.trim();
    if (val) lines.push(`${key}: ${val}`);
  }
  if (lines.length === 0) return '';
  return 'PROTECTED FACTS — DO NOT CHANGE OR REMOVE:\n' + lines.join('\n');
}

/**
 * Single repair attempt prompt.
 */
export const REPAIR_INSTRUCTION =
  'मूल आवेदन के सभी नाम, स्थान, तारीख, राशि, फोन, खाता, प्लॉट और अन्य तथ्य अक्षरशः रखें। केवल भाषा/संरचना में मांगा गया सुधार करें।';

/**
 * Returns true if the lost facts are identity-critical (names, locations).
 * Non-critical losses (amount rendered in words) don't trigger repair.
 */
export function isIdentityCritical(lostFacts: string[]): boolean {
  return lostFacts.some(f =>
    !f.startsWith('amount:') && !f.startsWith('phone:')
  );
}

export { PROTECTED_KEYS };
