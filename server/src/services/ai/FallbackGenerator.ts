/**
 * Deterministic Fallback Generator — builds a formal Hindi application
 * using ONLY user-supplied facts. Zero AI inference. No creative additions.
 *
 * Used when AI generation fails fact validation and repair cannot fix it.
 */

import { ProtectedFacts } from './ProtectedFacts';

export interface FallbackRequest {
  facts: ProtectedFacts;
  officeType: string;
  applicationName: string;
  /** The description/issue as stated by user. */
  userDescription?: string;
}

// ── Office metadata ──────────────────────────────────────────────────────

const OFFICE_DESIGNATIONS: Record<string, string> = {
  thana: 'थाना प्रभारी/थानाध्यक्ष महोदय',
  block: 'तहसीलदार/ब्लॉक अधिकारी महोदय',
  bdo: 'खंड विकास अधिकारी महोदय',
  co: 'सर्किल अधिकारी/राजस्व अधिकारी महोदय',
  sdo: 'अनुविभागीय अधिकारी महोदय',
  sp: 'पुलिस अधीक्षक महोदय',
  dc: 'जिलाधिकारी/जिला दंडाधिकारी महोदय',
  court: 'माननीय न्यायाधीश महोदय',
};

const LOCATION_LABEL: Record<string, string> = {
  thana: 'थाना', block: 'तहसील', bdo: 'प्रखंड',
  co: 'अंचल', sdo: 'अनुविभाग', sp: 'थाना',
  dc: 'जिला', court: 'न्यायालय',
};

// ── Main fallback generator ──────────────────────────────────────────────

/**
 * Generate a formal Hindi application deterministically from facts.
 * Uses template-based assembly — no AI, no inference, no creativity.
 */
export function generateFallbackApplication(req: FallbackRequest): string {
  const f = req.facts;
  const designation = OFFICE_DESIGNATIONS[req.officeType] || 'संबंधित अधिकारी महोदय';
  const locLabel = LOCATION_LABEL[req.officeType] || 'कार्यालय';
  const today = formatDateHindi(new Date());

  const lines: string[] = [];

  // ── Header ──────────────────────────────────────────────────────────
  lines.push('सेवा में,');
  lines.push(designation + ',');
  lines.push(`${locLabel}–${f.applicantThana || '............'}, जिला–${f.applicantDistrict || '............'}, राज्य–${f.applicantState || '............'}।`);
  lines.push('');

  // ── Subject ─────────────────────────────────────────────────────────
  lines.push(`विषय: ${req.applicationName} हेतु प्रार्थना पत्र।`);
  lines.push('');

  // ── Body ────────────────────────────────────────────────────────────
  lines.push('महोदय,');
  lines.push('');

  // Opening statement
  const applicantLine = buildApplicantLine(f);
  lines.push(applicantLine);
  lines.push('');

  // Description/issue — user's own words, safely
  if (req.userDescription?.trim()) {
    lines.push(`प्रार्थी का कथन इस प्रकार है: मेरे द्वारा दी गई जानकारी के अनुसार, ${req.userDescription.trim()}`);
  } else {
    lines.push('प्रार्थी का कथन इस प्रकार है:');
  }
  lines.push('');

  // Accused people with relationships
  if (f.people.length > 0) {
    lines.push('उक्त घटना/विवाद में निम्नलिखित व्यक्ति/व्यक्तिगण संलिप्त हैं:');
    for (const p of f.people) {
      const relLine = p.relationName
        ? `  - ${p.name}, ${p.relationType}: ${p.relationName}${p.village ? `, ग्राम: ${p.village}` : ''}`
        : `  - ${p.name}${p.village ? `, ग्राम: ${p.village}` : ''}`;
      lines.push(relLine);
    }
    lines.push('');
  }

  // Allegations (only what user stated)
  if (f.allegations.length > 0) {
    lines.push('प्रार्थी के अनुसार, घटना का विवरण निम्नानुसार है:');
    for (const a of f.allegations) {
      lines.push(`  - ${a}`);
    }
    lines.push('');
  }

  // Land info if applicable
  if (f.khataNumber || f.plotNumber) {
    const landParts: string[] = [];
    if (f.village) landParts.push(`ग्राम ${f.village}`);
    if (f.khataNumber) landParts.push(`खाता संख्या ${f.khataNumber}`);
    if (f.plotNumber) landParts.push(`प्लॉट/खसरा संख्या ${f.plotNumber}`);
    if (f.areaRakba) landParts.push(`रकबा ${f.areaRakba}`);
    lines.push(`प्रार्थी की भूमि का विवरण: ${landParts.join(', ')}।`);
    if (f.ownershipBasis) {
      lines.push(`उक्त भूमि में प्रार्थी का ${f.ownershipBasis} है।`);
    }
    lines.push('');
  }

  // ── Request ─────────────────────────────────────────────────────────
  lines.push('अतः श्रीमान/महोदय से सविनय निवेदन है कि उपरोक्त तथ्यों पर संज्ञान लेते हुए उचित कार्रवाई करने की कृपा करें।');
  lines.push('');

  // ── Gratitude ───────────────────────────────────────────────────────
  lines.push('इसके लिए प्रार्थी सदैव आपका आभारी रहेगा।');
  lines.push('');

  // ── Footer ──────────────────────────────────────────────────────────
  lines.push(`दिनांक: ${today}    स्थान: ${f.applicantVillage || f.applicantDistrict || ''}`);
  lines.push('');
  lines.push('                            भवदीय,');
  lines.push('');
  lines.push(`                            ${f.applicantName}`);
  if (f.applicantFatherName) lines.push(`                            ${f.applicantFatherName}`);
  if (f.applicantVillage) lines.push(`                            ग्राम–${f.applicantVillage}, ${locLabel}–${f.applicantThana || ''}, जिला–${f.applicantDistrict || ''}`);
  if (f.applicantMobile) lines.push(`                            मोबाइल: ${f.applicantMobile}`);

  return lines.join('\n');
}

// ── Helpers ──────────────────────────────────────────────────────────────

function buildApplicantLine(f: ProtectedFacts): string {
  const parts: string[] = ['सविनय निवेदन है कि मैं'];

  if (f.applicantName) parts.push(f.applicantName);
  if (f.applicantFatherName) parts.push(f.applicantFatherName);
  if (f.applicantVillage) parts.push(`ग्राम–${f.applicantVillage}`);
  if (f.applicantThana) parts.push(`थाना–${f.applicantThana}`);
  if (f.applicantDistrict) parts.push(`जिला–${f.applicantDistrict}`);

  parts.push('का/की निवासी हूँ।');
  return parts.join(', ');
}

function formatDateHindi(date: Date): string {
  const months = [
    'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
    'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर',
  ];
  return `${date.getDate().toString().padStart(2, '0')} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export default generateFallbackApplication;
