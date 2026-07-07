/**
 * Shared types for Awedan Sahayak.
 *
 * These types are shared between the React Native app and the Node.js
 * backend server. Keep them in sync — the server and app both import
 * from this canonical definition.
 *
 * @module shared/types
 */

// ── Office types ───────────────────────────────────────────────────────

/** Government office types supported by the app. */
export type OfficeType =
  | 'thana'
  | 'block'
  | 'bdo'
  | 'co'
  | 'sdo'
  | 'sp'
  | 'dc'
  | 'court'
  | 'bank'
  | 'college'
  | 'school'
  | 'pwd'
  | 'rcd'
  | 'bcd';

/** Hindi + English labels for each office type. */
export const OFFICE_LABELS: Record<OfficeType, { hi: string; en: string }> = {
  thana:   { hi: 'थाना',                     en: 'Police Station' },
  block:   { hi: 'प्रखंड कार्यालय',          en: 'Block Office' },
  bdo:     { hi: 'BDO कार्यालय',             en: 'BDO Office' },
  co:      { hi: 'अंचल कार्यालय',            en: 'CO Office (Circle Officer)' },
  sdo:     { hi: 'SDO कार्यालय',             en: 'SDO Office (Sub-Divisional Officer)' },
  sp:      { hi: 'SP कार्यालय',              en: 'SP Office (Superintendent of Police)' },
  dc:      { hi: 'DC कार्यालय (समाहरणालय)', en: 'DC Office (District Collector)' },
  court:   { hi: 'व्यवहार न्यायालय',         en: 'Civil Court' },
  bank:    { hi: 'बैंक शाखा',                en: 'Bank Branch' },
  college: { hi: 'महाविद्यालय',              en: 'College' },
  school:  { hi: 'विद्यालय',                 en: 'School' },
  pwd:     { hi: 'लोक निर्माण विभाग (PWD)',  en: 'Public Works Department (PWD)' },
  rcd:     { hi: 'ग्रामीण कार्य विभाग (RCD)', en: 'Rural Construction Department (RCD)' },
  bcd:     { hi: 'भवन निर्माण विभाग (BCD)',  en: 'Building Construction Department (BCD)' },
};

/** Designation used in the "सेवा में" (To) section for each office type. */
export const OFFICE_DESIGNATIONS: Record<OfficeType, string> = {
  thana:   'थाना प्रभारी/थानाध्यक्ष महोदय',
  block:   'तहसीलदार/ब्लॉक अधिकारी महोदय',
  bdo:     'खंड विकास अधिकारी महोदय',
  co:      'सर्किल अधिकारी/राजस्व अधिकारी महोदय',
  sdo:     'अनुविभागीय अधिकारी महोदय',
  sp:      'पुलिस अधीक्षक महोदय',
  dc:      'जिलाधिकारी/जिला दंडाधिकारी महोदय',
  court:   'माननीय न्यायाधीश महोदय',
  bank:    'शाखा प्रबंधक महोदय',
  college: 'प्राचार्य महोदय',
  school:  'प्रधानाध्यापक/प्राचार्य महोदय',
  pwd:     'कार्यपालक अभियंता महोदय',
  rcd:     'कार्यपालक अभियंता महोदय',
  bcd:     'कार्यपालक अभियंता महोदय',
};

// ── API contracts ──────────────────────────────────────────────────────

/** POST /api/generate-application request body. */
export interface GenerateApplicationRequest {
  applicationName: string;
  officeType: string;
  promptTemplate: string;
  formData: Record<string, string>;
}

/** POST /api/generate-application response body. */
export interface GenerateApplicationResponse {
  success: true;
  generatedText: string;
  metadata: {
    provider: string;
    model: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
    };
  };
}

/** POST /api/ocr-aadhar request body. */
export interface OcrAadharRequest {
  /** Base64-encoded image (JPEG/PNG). */
  imageBase64: string;
}

/** POST /api/ocr-aadhar response body. */
export interface OcrAadharResponse {
  name: string | null;
  dob: string | null;
  gender: string | null;
  address: string | null;
  phone_number: string | null;
  rawText: string;
}

/** POST /api/scan-document request body. */
export interface ScanDocumentRequest {
  /** Base64-encoded image of a handwritten document. */
  imageBase64: string;
}

/** POST /api/scan-document response body. */
export interface ScanDocumentResponse {
  rawText: string;
}

/** POST /api/cleanup-ocr request body. */
export interface CleanupOcrRequest {
  rawText: string;
}

/** POST /api/cleanup-ocr response body. */
export interface CleanupOcrResponse {
  cleanedText: string;
  provider: string;
}

/** Generic API error response. */
export interface ApiErrorResponse {
  error: string;
  detail?: string;
}

// ── Aadhar extracted data ──────────────────────────────────────────────

/** Structured data extracted from an Aadhar card via OCR. */
export interface AadharExtractedData {
  name: string | null;
  dob: string | null;
  gender: string | null;
  address: string | null;
  phone_number: string | null;
  /** Raw OCR text (for debugging — never persisted). */
  rawText: string;
}

// ── Application template types ─────────────────────────────────────────

/** The seven-part structure of a formal Hindi application. */
export type ApplicationSection =
  | 'header'          // सेवा में (addressing the officer)
  | 'subject'         // विषय (subject line)
  | 'salutation'      // सविनय निवेदन (respectful opening)
  | 'narrative'       // घटना विवरण (chronological incident description)
  | 'prayer'          // अतः निवेदन (formal request)
  | 'gratitude'       // आभार (thanks)
  | 'signature';      // हस्ताक्षर (signature block)

/** Base identity fields present on every application form. */
export const BASE_IDENTITY_FIELDS = [
  'applicant_name',
  'parent_spouse_name',
  'village',
  'post',
  'thana',
  'district',
  'state',
  'mobile',
  'gender',
] as const;
