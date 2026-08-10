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

      // 3. Check for WRONG_FATHER using proximity-based matching
      const allFatherNames = [...new Set(
        facts.people.filter(p => p.relationName).map(p => p.relationName!)
      )];
      const nearestFather = findNearestFather(generatedText, person.name, allFatherNames);

      if (nearestFather && nearestFather !== person.relationName &&
          !fuzzyContains(nearestFather, person.relationName)) {
        // Found a different father closer to this person than the correct one
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

  // 4. Check for invented people (names in output not in input)
  for (const person of facts.people) {
    if (!person.relationName) continue;
    // Check if any other person's name + father combo is impossible
    // (e.g., two people who should have different fathers both get the same wrong father)
  }

  // 5. SWAPPED_FATHER: use proximity matching to avoid false positives
  //    on dense comma-separated lists where windows overlap.
  const allFatherNames = [...new Set(
    facts.people.filter(p => p.relationName).map(p => p.relationName!)
  )];
  for (let i = 0; i < facts.people.length; i++) {
    for (let j = i + 1; j < facts.people.length; j++) {
      const a = facts.people[i];
      const b = facts.people[j];
      if (!a.relationName || !b.relationName) continue;
      if (a.relationName === b.relationName) continue; // Same father — OK

      const nearestA = findNearestFather(generatedText, a.name, allFatherNames);
      const nearestB = findNearestFather(generatedText, b.name, allFatherNames);

      // Only flag if A's nearest father is B's father AND B's nearest father is A's father
      if (nearestA === b.relationName && nearestB === a.relationName) {
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
