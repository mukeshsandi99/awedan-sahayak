/**
 * FactDiff — Computes the difference between input facts and AI output.
 *
 * For every generated application, internally computes:
 *   - FACTS_IN_INPUT
 *   - FACTS_IN_OUTPUT
 *   - MISSING_FACTS
 *   - CHANGED_FACTS
 *   - INVENTED_FACTS
 *
 * Production logs only counts (no sensitive values).
 * Development/test logs use sanitized fixtures.
 */

import { ProtectedFacts, ProtectedPerson } from './ProtectedFacts';
import { RelationshipResult } from './RelationshipValidator';
import { ForbiddenResult } from './ForbiddenDetector';

export interface FactDiffReport {
  // Counts
  protected: number;
  missing: number;
  changed: number;
  invented: number;

  // Status
  status: 'PASS' | 'FAIL';

  // Details (for dev/test — sanitized in production)
  missingDetails: string[];
  changedDetails: string[];
  inventedDetails: string[];

  // Sub-results
  relationships: RelationshipResult | null;
  forbidden: ForbiddenResult | null;
  ownershipSafe: boolean;
  allegationSafe: boolean;

  // Summary
  summary: string;
}

/**
 * Compute a full fact diff between input facts and generated output.
 */
export function computeFactDiff(
  facts: ProtectedFacts,
  generatedText: string,
  relationships: RelationshipResult | null,
  forbidden: ForbiddenResult | null,
  ownershipSafe: boolean,
  allegationSafe: boolean,
): FactDiffReport {
  const missingDetails: string[] = [];
  const changedDetails: string[] = [];
  const inventedDetails: string[] = [];

  // Count protected facts
  let protectedCount = 1; // applicantName
  if (facts.applicantFatherName) protectedCount++;
  if (facts.applicantVillage) protectedCount++;
  if (facts.applicantThana) protectedCount++;
  if (facts.applicantDistrict) protectedCount++;
  if (facts.applicantMobile) protectedCount++;
  protectedCount += facts.people.length * 2; // name + relation per person
  protectedCount += facts.khataNumber ? 1 : 0;
  protectedCount += facts.plotNumber ? 1 : 0;
  protectedCount += facts.ownershipBasis ? 1 : 0;
  protectedCount += facts.amounts.length;
  protectedCount += facts.phoneNumbers.length;
  protectedCount += facts.dates.length;

  // ── Check applicant identity ───────────────────────────────────────
  if (facts.applicantName && !generatedText.includes(facts.applicantName)) {
    missingDetails.push(`Applicant name: ${facts.applicantName}`);
  }
  if (facts.applicantFatherName && !generatedText.includes(facts.applicantFatherName)) {
    missingDetails.push(`Applicant father: ${facts.applicantFatherName}`);
  }
  if (facts.applicantVillage && !generatedText.includes(facts.applicantVillage)) {
    missingDetails.push(`Village: ${facts.applicantVillage}`);
  }

  // ── Check people relationships ─────────────────────────────────────
  for (const p of facts.people) {
    if (!generatedText.includes(p.name)) {
      missingDetails.push(`Person missing: ${p.name}`);
    }
    if (p.relationName && !generatedText.includes(p.relationName)) {
      missingDetails.push(`${p.name}'s ${p.relationType} missing: ${p.relationName}`);
    }
  }

  // ── Check land ─────────────────────────────────────────────────────
  if (facts.khataNumber && !generatedText.includes(facts.khataNumber)) {
    missingDetails.push(`Khata: ${facts.khataNumber}`);
    changedDetails.push(`Khata ${facts.khataNumber} changed or missing`);
  }
  if (facts.plotNumber && !generatedText.includes(facts.plotNumber)) {
    missingDetails.push(`Plot: ${facts.plotNumber}`);
    changedDetails.push(`Plot ${facts.plotNumber} changed or missing`);
  }

  // ── Ownership ──────────────────────────────────────────────────────
  if (!ownershipSafe) {
    changedDetails.push('Ownership basis altered');
  }

  // ── Forbidden inventions ───────────────────────────────────────────
  if (forbidden && !forbidden.passed) {
    for (const f of forbidden.findings) {
      inventedDetails.push(`${f.severity}: ${f.description} ("${f.phrase}")`);
    }
  }

  // ── Relationship errors ────────────────────────────────────────────
  if (relationships && !relationships.passed) {
    for (const e of relationships.errors) {
      changedDetails.push(`${e.type}: ${e.detail}`);
    }
  }

  // ── Allegation safety ──────────────────────────────────────────────
  if (!allegationSafe) {
    inventedDetails.push('Allegation strengthened beyond user statement');
  }

  // ── Compute counts ─────────────────────────────────────────────────
  const missing = missingDetails.length;
  const changed = changedDetails.length;
  const invented = inventedDetails.length;
  const passed = missing === 0 && changed === 0 && invented === 0;

  // ── Summary ────────────────────────────────────────────────────────
  const summary = passed
    ? `protected=${protectedCount} missing=0 changed=0 invented=0 status=PASS`
    : `protected=${protectedCount} missing=${missing} changed=${changed} invented=${invented} status=FAIL`;

  return {
    protected: protectedCount,
    missing,
    changed,
    invented,
    status: passed ? 'PASS' : 'FAIL',
    missingDetails,
    changedDetails,
    inventedDetails,
    relationships,
    forbidden,
    ownershipSafe,
    allegationSafe,
    summary,
  };
}

/**
 * Sanitized version for production logs — counts only, no PII.
 */
export function sanitizeForProduction(report: FactDiffReport): string {
  return `protected=${report.protected} missing=${report.missing} changed=${report.changed} invented=${report.invented} status=${report.status}`;
}

export default computeFactDiff;
