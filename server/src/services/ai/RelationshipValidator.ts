/**
 * RelationshipValidator — Validates that every person→relation mapping
 * from input survives AI generation intact.
 */

import { ProtectedPerson, ProtectedFacts } from './ProtectedFacts';

export interface RelationshipError {
  type: 'WRONG_FATHER' | 'MISSING_FATHER' | 'MISSING_PERSON' | 'SWAPPED_FATHER' | 'MERGED_PEOPLE' | 'INVENTED_PERSON' | 'WRONG_RELATION';
  person: string;
  expected?: string;
  found?: string;
  detail: string;
}

export interface RelationshipResult {
  passed: boolean;
  errors: RelationshipError[];
}

// ── Name normalization ────────────────────────────────────────────────────

const HONORIFICS = /^(श्रीमती|श्री|स्वर्गीय|स्व\.?|लेट|मोसमात|श्रीमान्?)\s+/i;

function normalise(s: string): string {
  return s.replace(HONORIFICS, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Fuzzy match: check if `needle` appears as a substring of `haystack`. */
function fuzzyContains(haystack: string, needle: string): boolean {
  const h = normalise(haystack);
  const n = normalise(needle);
  if (h.includes(n)) return true;
  // Check word parts (e.g. "रंजीत यादव" should match "रंजीत" alone in context)
  const parts = n.split(/\s+/).filter(p => p.length > 1);
  if (parts.length >= 2) {
    return parts.every(p => h.includes(p));
  }
  return false;
}

// ── Validation ────────────────────────────────────────────────────────────

/**
 * Validate that every protected person's relationship is preserved in generated text.
 *
 * For each person:
 * 1. Person's name must appear in output
 * 2. If they have a relationName, it must be associated with them in output
 * 3. Check for wrong father (person appears but with wrong father name)
 */
export function validateRelationships(
  facts: ProtectedFacts,
  generatedText: string,
): RelationshipResult {
  const errors: RelationshipError[] = [];

  for (const person of facts.people) {
    // 1. Check person name appears
    if (!fuzzyContains(generatedText, person.name)) {
      errors.push({
        type: 'MISSING_PERSON',
        person: person.name,
        detail: `Person "${person.name}" not found in generated text`,
      });
      continue;
    }

    // 2. If they have a relation name, check it appears NEAR their name
    if (person.relationName) {
      if (!fuzzyContains(generatedText, person.relationName)) {
        errors.push({
          type: 'MISSING_FATHER',
          person: person.name,
          expected: person.relationName,
          detail: `${person.name}'s ${person.relationType} "${person.relationName}" not found in output`,
        });
        continue;
      }

      // 3. Check for WRONG_FATHER — prefer explicit pattern over proximity
      const allFatherNames = [...new Set(
        facts.people.filter(p => p.relationName).map(p => p.relationName!)
      )];

      // First: try to find an explicit "पिता: X" or "पिता X" pattern
      // near the person's name. This is more reliable than proximity.
      const explicitFather = findExplicitFather(generatedText, person.name, allFatherNames);

      if (explicitFather) {
        // Explicit pattern found — use it directly
        if (explicitFather !== person.relationName &&
            !fuzzyContains(explicitFather, person.relationName)) {
          errors.push({
            type: 'WRONG_FATHER',
            person: person.name,
            expected: person.relationName,
            found: explicitFather,
            detail: `${person.name} appears with ${explicitFather} instead of ${person.relationName}`,
          });
        }
      } else {
        // No explicit pattern — fall back to proximity-based matching
        const nearestFather = findNearestFather(generatedText, person.name, allFatherNames);
        if (nearestFather && nearestFather !== person.relationName &&
            !fuzzyContains(nearestFather, person.relationName)) {
          errors.push({
            type: 'WRONG_FATHER',
            person: person.name,
            expected: person.relationName,
            found: nearestFather,
            detail: `${person.name} appears with ${nearestFather} instead of ${person.relationName}`,
          });
        }
      }
    }
  }

  // 4. SWAPPED_FATHER: only run for people WITHOUT explicit mappings.
  //    Explicit mappings (पिता: X) are authoritative — never overridden.
  //    Swap requires explicit evidence: both parties must have their
  //    nearest (non-explicit) father wrong in a mirrored way.
  const peopleWithExplicit = new Set<string>();
  for (const person of facts.people) {
    if (!person.relationName) continue;
    if (findExplicitFather(generatedText, person.name,
      facts.people.filter(p => p.relationName).map(p => p.relationName!))) {
      peopleWithExplicit.add(person.name);
    }
  }

  const allFatherNames = [...new Set(
    facts.people.filter(p => p.relationName).map(p => p.relationName!)
  )];
  for (let i = 0; i < facts.people.length; i++) {
    for (let j = i + 1; j < facts.people.length; j++) {
      const a = facts.people[i];
      const b = facts.people[j];
      if (!a.relationName || !b.relationName) continue;
      if (a.relationName === b.relationName) continue;

      // Skip if either person has an explicit mapping — it's authoritative
      if (peopleWithExplicit.has(a.name) || peopleWithExplicit.has(b.name)) continue;

      const nearestA = findNearestFather(generatedText, a.name, allFatherNames);
      const nearestB = findNearestFather(generatedText, b.name, allFatherNames);

      if (nearestA && nearestB &&
          nearestA === b.relationName && nearestB === a.relationName) {
        errors.push({
          type: 'SWAPPED_FATHER',
          person: `${a.name} ↔ ${b.name}`,
          expected: `${a.name}→${a.relationName}, ${b.name}→${b.relationName}`,
          detail: `Fathers appear swapped: ${a.name} shows ${b.relationName}, ${b.name} shows ${a.relationName}`,
        });
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

/**
 * Find an EXPLICIT father attribution near a person's name.
 * Looks for patterns like "पिता: X", "पिता X", "के पिता X"
 * within 50 chars after the person's name.
 *
 * Returns the father name found, or null if no explicit pattern found.
 */
const EXPLICIT_FATHER_RE = /(?:पिता|पति)\s*[:：]\s*(.+?)(?:[\r\n,\-]|$)|(?:के\s*)?(?:पिता|पति)\s+(.+?)(?:[\r\n,\-]|$)/;

function findExplicitFather(text: string, personName: string, fatherNames: string[]): string | null {
  const idx = text.indexOf(personName);
  if (idx < 0) return null;

  // Look at text from the person's name to 80 chars after
  const afterName = idx + personName.length;
  const windowEnd = Math.min(text.length, afterName + 80);
  const window = text.substring(afterName, windowEnd);

  // Try explicit pattern match
  const match = window.match(EXPLICIT_FATHER_RE);
  if (match) {
    const candidate = (match[1] || match[2] || '').trim();
    if (!candidate) return null;
    // Check if this candidate matches any known father name
    for (const fn of fatherNames) {
      if (fuzzyContains(candidate, fn) || fuzzyContains(fn, candidate)) {
        return fn;
      }
    }
    // If candidate is a known person name but not a father, don't return it
    return null;
  }

  return null;
}

/**
 * Extract text context around a person's name in generated text.
 * Uses a tighter window (80 chars) to avoid capturing other people's fathers.
 */
function extractContext(text: string, name: string, windowChars: number = 80): string {
  const idx = text.indexOf(name);
  if (idx < 0) return '';
  const start = Math.max(0, idx - windowChars);
  const end = Math.min(text.length, idx + name.length + windowChars);
  return text.substring(start, end);
}

/**
 * Find which father name appears closest to this person's name in the text.
 * Returns the father name found in closest proximity, or null if none found.
 */
function findNearestFather(text: string, personName: string, allFatherNames: string[]): string | null {
  const nameIdx = text.indexOf(personName);
  if (nameIdx < 0) return null;

  // Skip past this occurrence of the person's own name to avoid self-match
  // when a person's name IS another person's father (e.g. प्रेम is both accused and father)
  const afterName = nameIdx + personName.length;

  let closestFather: string | null = null;
  let closestDist = Infinity;

  for (const fatherName of allFatherNames) {
    // Search for father name in the vicinity (after the person name, within 120 chars)
    const searchEnd = Math.min(text.length, afterName + 120);
    const searchRegion = text.substring(afterName, searchEnd);
    const fatherIdx = searchRegion.indexOf(fatherName);

    if (fatherIdx >= 0) {
      const dist = fatherIdx;
      if (dist < closestDist) {
        closestDist = dist;
        closestFather = fatherName;
      }
    }
  }

  return closestFather;
}

/**
 * Build a repair instruction specific to relationship errors.
 */
export function buildRelationshipRepairPrompt(
  errors: RelationshipError[],
  facts: ProtectedFacts,
  draft: string,
): string {
  const errorLines = errors.map((e, i) =>
    `${i + 1}. ${e.detail}\n   Expected: ${e.expected || '(name should appear)'}`,
  );

  const corrections = facts.people
    .filter(p => p.relationName)
    .map(p => `- ${p.name} → ${p.relationType}: ${p.relationName}`);

  return `FIX THESE RELATIONSHIP ERRORS in the application draft:

${errorLines.join('\n\n')}

CORRECT PERSON→RELATION MAPPINGS:
${corrections.join('\n')}

DRAFT TO FIX:
${draft}

RULES:
1. Fix ONLY the relationship errors listed above
2. Each person MUST appear with exactly their correct ${facts.people[0]?.relationType || 'relation'} name
3. Do NOT change any other text, names, places, dates, or allegations
4. Do NOT add any new persons, allegations, or facts
5. Return the FULL corrected application text`;
}

export default validateRelationships;
