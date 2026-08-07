/**
 * Fact Validator — Validates that facts from input are preserved in output.
 *
 * Detects mismatches, generates repair prompts, and determines if
 * the output is safe to return to the user.
 */

import { ExtractedFacts, extractFacts } from './FactExtractor';
import { createLogger } from '../../config/logger';

const log = createLogger('FactValidator');

// ── Types ────────────────────────────────────────────────────────────────

export interface FactMismatch {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  inputValues: string[];
  foundInOutput: boolean;
}

export interface ValidationResult {
  passed: boolean;
  score: number; // 0-100
  mismatches: FactMismatch[];
  repairPrompt?: string;
}

// ── Name normalization ────────────────────────────────────────────────────

/** Honorifics stripped before comparison. */
const HONORIFICS = [/^(श्रीमती|श्री|कु\.?|स्व\.?|स्वर्गीय|मोसमात|श्रीमान्?)\s+/i, /^(Mr\.?|Mrs\.?|Ms\.?|Shri|Smt\.?)\s+/i];

function normaliseName(s: string): string {
  let n = s.normalize('NFC').replace(/\s+/g, ' ').trim();
  for (const h of HONORIFICS) n = n.replace(h, '');
  return n.toLowerCase();
}

function namesMatch(input: string, output: string): boolean {
  const a = normaliseName(input);
  const b = normaliseName(output);
  // Exact match after normalization
  if (a === b) return true;
  // Any name: check if the normalized input appears in the output
  // (honorifics already stripped, so श्री राम = राम in search)
  if (b.includes(a)) return true;
  // For longer names (3+ parts): check all parts appear
  const aParts = a.split(/\s+/).filter((p: string) => p.length > 1);
  if (aParts.length >= 2) {
    return aParts.every((p: string) => b.includes(p));
  }
  return false;
}

// ── Numeric normalization ─────────────────────────────────────────────────

function normaliseNumber(s: string): string {
  return s.replace(/[₹,\s]/g, '').replace(/रुपये|रुपया/gi, '').trim();
}

function numbersMatch(input: string, output: string): boolean {
  const a = normaliseNumber(input);
  const b = normaliseNumber(output);
  return a === b || b.includes(a) || a.includes(b);
}

function dateMatch(input: string, output: string): boolean {
  // Normalize both to digit-only for comparison
  const inputDigits = input.replace(/\D/g, '');
  const outputDigits = output.replace(/\D/g, '');
  // Exact digit match
  if (inputDigits.length >= 4 && inputDigits === outputDigits) return true;
  // Partial match: input DDMM or DDMMYY against output
  if (inputDigits.length >= 4 && outputDigits.length >= 4) {
    // Check if the last 4 digits match (DDMM or MMDD)
    if (inputDigits.substring(inputDigits.length - 4) === outputDigits.substring(outputDigits.length - 4)) return true;
    // Check if year matches (4-digit year)
    const inputYear = inputDigits.match(/\d{4}$/);
    const outputYear = outputDigits.match(/\d{4}$/);
    if (inputYear && outputYear && inputYear[0] === outputYear[0]) return true;
  }
  return false;
}

// ── Fact checkers ────────────────────────────────────────────────────────

function checkPresence(value: string | null | string[], output: string, label: string, severity: FactMismatch['severity'], matchFn?: (a: string, b: string) => boolean): FactMismatch | null {
  const values = Array.isArray(value) ? value : (value ? [value] : []);
  if (values.length === 0) return null;
  const outNorm = output.normalize('NFC');
  const matcher = matchFn ?? ((a, b) => b.normalize('NFC').toLowerCase().includes(a.normalize('NFC').toLowerCase()));
  const found = values.some((v) => matcher(v, outNorm));
  if (!found) {
    return { type: 'fact_missing', severity, description: `${label} missing: ${values.join(', ')}`, inputValues: values, foundInOutput: false };
  }
  return null;
}

function checkExact(value: string | null, output: string, label: string, severity: FactMismatch['severity'], matchFn: (a: string, b: string) => boolean): FactMismatch | null {
  if (!value) return null;
  const outNorm = output.normalize('NFC');
  if (!matchFn(value, outNorm)) {
    return { type: 'fact_changed', severity, description: `${label} changed`, inputValues: [value], foundInOutput: false };
  }
  return null;
}

function checkUnsupported(output: string, pattern: RegExp, label: string, inputFacts: ExtractedFacts): FactMismatch | null {
  const matches = output.match(pattern);
  if (!matches) return null;
  // Check if any match was in the input
  const inInput = inputFacts.dates.some((d) => matches.some((m) => m.includes(d)));
  if (!inInput) {
    return { type: 'unsupported_fact', severity: 'warning', description: `${label} found in output but not in input: ${matches.join(', ')}`, inputValues: matches, foundInOutput: true };
  }
  return null;
}

export function validateFacts(
  formData: Record<string, string>,
  generatedText: string,
): ValidationResult {
  const facts = extractFacts(formData);
  const filtered: FactMismatch[] = [];

  // Critical checks (names use tolerant matching)
  filtered.push(...[
    checkPresence(facts.applicantName, generatedText, 'Applicant name', 'critical', namesMatch),
    checkPresence(facts.parentSpouseName, generatedText, 'Parent/Spouse name', 'critical', namesMatch),
    checkPresence(facts.village, generatedText, 'Village', 'critical'),
    checkPresence(facts.district, generatedText, 'District', 'critical'),
    checkPresence(facts.thana, generatedText, 'Thana', 'critical'),
    checkExact(facts.incidentDate, generatedText, 'Incident date', 'critical', dateMatch),
  ].filter(Boolean) as FactMismatch[]);

  // Warning checks
  filtered.push(...[
    checkPresence(facts.accusedNames, generatedText, 'Accused name(s)', 'warning', namesMatch),
    checkPresence(facts.post, generatedText, 'Post office', 'warning'),
    checkPresence(facts.state, generatedText, 'State', 'warning'),
  ].filter(Boolean) as FactMismatch[]);

  // Exact numeric checks
  for (const amt of facts.amounts) {
    const r = checkExact(amt, generatedText, `Amount ₹${amt}`, 'critical', numbersMatch); if (r) filtered.push(r);
  }
  for (const plot of facts.plotNumbers) {
    const r = checkExact(plot, generatedText, `Plot ${plot}`, 'critical', (a, b) => b.includes(a)); if (r) filtered.push(r);
  }
  for (const khata of facts.khataNumbers) {
    const r = checkExact(khata, generatedText, `Khata ${khata}`, 'critical', (a, b) => b.includes(a)); if (r) filtered.push(r);
  }
  for (const phone of facts.phoneNumbers) {
    const r = checkExact(phone, generatedText, `Phone ${phone}`, 'warning', (a, b) => b.includes(a)); if (r) filtered.push(r);
  }
  // Unsupported facts
  filtered.push(...[
    checkUnsupported(generatedText, /गिरफ्तार|धारा\s*\d{2,4}/g, 'Arrest/legal section claim', facts),
    checkUnsupported(generatedText, /मेडिकल\s*रिपोर्ट|चिकित्सा\s*रिपोर्ट/g, 'Medical report claim', facts),
    checkUnsupported(generatedText, /न्यायालय\s*का\s*आदेश|कोर्ट\s*ऑर्डर/g, 'Court order claim', facts),
  ].filter(Boolean) as FactMismatch[]);

  const criticalCount = filtered.filter((m) => m.severity === 'critical').length;
  const warningCount = filtered.filter((m) => m.severity === 'warning').length;
  const score = Math.max(0, 100 - (criticalCount * 20) - (warningCount * 5));

  return {
    passed: criticalCount === 0,
    score,
    mismatches: filtered,
    repairPrompt: filtered.length > 0 ? buildRepairPrompt(facts, filtered, generatedText) : undefined,
  };
}

function buildRepairPrompt(
  facts: ExtractedFacts,
  mismatches: FactMismatch[],
  currentDraft: string,
): string {
  const criticalFixes = mismatches
    .filter((m) => m.severity === 'critical')
    .map((m) => `- ${m.description}`)
    .join('\n');

  const immutableFacts = [
    facts.applicantName && `Applicant: ${facts.applicantName}`,
    facts.parentSpouseName && `Parent/Spouse: ${facts.parentSpouseName}`,
    facts.village && `Village: ${facts.village}`,
    facts.district && `District: ${facts.district}`,
    facts.thana && `Thana: ${facts.thana}`,
    facts.incidentDate && `Date: ${facts.incidentDate}`,
    ...facts.amounts.map((a) => `Amount: ${a}`),
    ...facts.plotNumbers.map((p) => `Plot: ${p}`),
    ...facts.khataNumbers.map((k) => `Khata: ${k}`),
  ].filter(Boolean).join('\n');

  return `REPAIR INSTRUCTIONS:
The following draft application has ${mismatches.length} fact issue(s). Please fix ONLY these issues:

CRITICAL ISSUES TO FIX:
${criticalFixes}

IMMUTABLE FACTS (must appear exactly as shown):
${immutableFacts}

RULES:
1. Only fix the specific issues listed above
2. Do NOT change any other text
3. Do NOT add any new facts, names, dates, or amounts
4. Keep the same format and structure
5. Return the corrected full application text

DRAFT TO REPAIR:
${currentDraft}`;
}

export default validateFacts;
