/**
 * Database row types for Awedan Sahayak.
 *
 * PRIVACY: Aadhar full number is NEVER stored. Only `aadhar_last4`
 * (last 4 digits) is persisted for user reference purposes.
 */

// ── Enums ───────────────────────────────────────────────────────────

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
  | 'bcd'
  | 'transport';

// ── Table row types ─────────────────────────────────────────────────

/** Stored user profile. Aadhar full number is NEVER persisted. */
export interface UserProfile {
  id: number;
  name: string;
  dob: string | null;
  gender: string | null;
  address: string | null;
  phone: string | null;
  /** Location — parsed from combined address or entered manually. */
  village: string | null;
  post: string | null;
  thana: string | null;
  district: string | null;
  state: string | null;
  parent_spouse_name: string | null;
  /** ONLY last 4 digits of Aadhar — full number never stored. */
  aadhar_last4: string | null;
  created_at: string;
}

/** A government office entry (seeded + user-added). */
export interface Office {
  id: number;
  type: OfficeType;
  name_hindi: string;
  name_english: string;
  district: string | null;
  block: string | null;
  full_address: string | null;
  phone_number: string | null;
  latitude: number | null;
  longitude: number | null;
  working_hours: string | null;
  landmark: string | null;
  /** Whether this office data has been verified (1) or is placeholder (0). */
  is_verified: number; // SQLite boolean (0/1)
}

/** A type of formal application that can be generated for an office. */
export interface ApplicationType {
  id: number;
  office_type: OfficeType;
  name_hindi: string;
  name_english: string;
  /** JSON array of search keywords e.g. ["चोरी","theft","stolen"]. */
  keywords: string | null;
  /** JSON array of required field names e.g. ["incident_date","location"]. */
  required_fields: string | null;
  /** Claude API prompt template with {{placeholders}} for user data. */
  prompt_template: string | null;
  /** If true, the UI must show a legal disclaimer before generating. */
  requires_legal_disclaimer: number; // SQLite boolean (0/1)
  /** Legal disclaimer text shown when requires_legal_disclaimer is true. */
  disclaimer_text: string | null;
}

/** A generated application (drafted via Claude API). */
export interface GeneratedApplication {
  id: number;
  application_type_id: number | null;
  office_id: number | null;
  /** Raw user input (text or transcribed voice). */
  raw_input_text: string;
  /** Claude-generated formal application text. */
  generated_text: string | null;
  /** Local file path to the exported PDF. */
  pdf_path: string | null;
  /** FK to parent application if this is an escalation. */
  is_escalation_of: number | null;
  created_at: string;
  /** ISO date string when the follow-up reminder should fire. */
  reminder_date: string | null;
  /** Expo Notifications identifier string (for cancellation). */
  notification_id: string | null;
  /** Number of days after generation to remind (default 15). */
  reminder_days: number | null;
  /** Free-text office name for custom/blank applications (null for predefined types). */
  custom_office_name: string | null;
}

// ── Monetization types ─────────────────────────────────────────────────

export type SubscriptionStatus = 'active' | 'expired' | 'none';

// ── New feature table types (v2 expansion) ───────────────────────────

/** Scam Link / UPI Safety Check record. */
export interface SafetyCheck {
  id: number;
  input_type: 'url' | 'upi' | 'mobile' | 'payment_text' | 'qr_result';
  input_value: string;
  risk_level: 'low' | 'caution' | 'high';
  reasons: string | null; // JSON array of Hindi reason strings
  created_at: string;
}

/** Marriage Biodata draft. */
export interface MarriageBiodataDraft {
  id: number;
  full_name: string | null;
  photo_uri: string | null;
  dob: string | null;
  age: number | null;
  height: string | null;
  gender: string | null;
  religion: string | null;
  caste: string | null;
  gotra: string | null;
  education: string | null;
  occupation: string | null;
  income: string | null;
  father_name: string | null;
  mother_name: string | null;
  family_details: string | null;
  address: string | null;
  contact_details: string | null;
  siblings: string | null;
  hobbies: string | null;
  expectations: string | null;
  horoscope_details: string | null;
  template_style: string; // 'simple' | 'traditional' | 'modern' | 'photo_focused'
  language: string; // 'hi' | 'en'
  is_draft: number; // SQLite boolean
  created_at: string;
  updated_at: string;
}

/** Barcode scan history record. */
export interface BarcodeHistory {
  id: number;
  barcode_type: string; // 'qr' | 'code128' | 'code39' | 'ean13' | 'ean8' | 'upc_a' | 'pdf417' | 'aztec' | 'data_matrix'
  raw_value: string;
  scanned_at: string;
}

/** CGPA calculation history record. */
export interface CgpaHistory {
  id: number;
  mode: 'cgpa_to_percent' | 'percent_to_cgpa';
  input_value: number;
  result_value: number;
  formula_used: string;
  created_at: string;
}

/** Handwriting document record. */
export interface HandwritingDocument {
  id: number;
  title: string | null;
  input_text: string;
  page_style: string; // 'ruled' | 'plain' | 'notebook'
  ink_color: string; // 'blue' | 'black'
  font_size: number;
  line_spacing: number;
  page_margin: number;
  watermark_enabled: number; // SQLite boolean
  language: string;
  pdf_path: string | null;
  image_path: string | null;
  created_at: string;
}

/** Court petition draft. */
export interface CourtPetitionDraft {
  id: number;
  petition_type: string;
  court_name: string | null;
  district: string | null;
  case_type: string | null;
  case_number: string | null;
  year: string | null;
  petitioner_name: string | null;
  respondent_name: string | null;
  advocate_name: string | null;
  police_station: string | null;
  fir_number: string | null;
  sections_of_law: string | null;
  date_of_occurrence: string | null;
  custody_date: string | null;
  facts_of_case: string | null;
  grounds: string | null;
  prayer: string | null;
  verification_text: string | null;
  place: string | null;
  date: string | null;
  // Plaint-specific
  cause_of_action: string | null;
  jurisdiction: string | null;
  valuation: string | null;
  court_fee: string | null;
  property_schedule: string | null;
  relief_sought: string | null;
  limitation_statement: string | null;
  document_list: string | null;
  // Bail-specific
  criminal_history: string | null;
  cooperation_assurance: string | null;
  flight_risk_statement: string | null;
  evidence_tampering_assurance: string | null;
  medical_family_grounds: string | null;
  co_accused_parity: string | null;
  // Metadata
  reviewed_by_advocate: number; // SQLite boolean
  is_draft: number; // SQLite boolean
  generated_text: string | null;
  pdf_path: string | null;
  created_at: string;
  updated_at: string;
}

// ── Insert types (omit auto-generated id & timestamp) ───────────────

export type UserProfileInsert = Omit<UserProfile, 'id' | 'created_at'>;
export type OfficeInsert = Omit<Office, 'id'>;
export type ApplicationTypeInsert = Omit<ApplicationType, 'id'>;
export type GeneratedApplicationInsert = Omit<GeneratedApplication, 'id' | 'created_at'>;
export type SafetyCheckInsert = Omit<SafetyCheck, 'id' | 'created_at'>;
export type MarriageBiodataDraftInsert = Omit<MarriageBiodataDraft, 'id' | 'created_at' | 'updated_at'>;
export type BarcodeHistoryInsert = Omit<BarcodeHistory, 'id' | 'scanned_at'>;
export type CgpaHistoryInsert = Omit<CgpaHistory, 'id' | 'created_at'>;
export type HandwritingDocumentInsert = Omit<HandwritingDocument, 'id' | 'created_at'>;
export type CourtPetitionDraftInsert = Omit<CourtPetitionDraft, 'id' | 'created_at' | 'updated_at'>;
