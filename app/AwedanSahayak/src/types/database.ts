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
  | 'bcd';

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
}

// ── Insert types (omit auto-generated id & timestamp) ───────────────

export type UserProfileInsert = Omit<UserProfile, 'id' | 'created_at'>;
export type OfficeInsert = Omit<Office, 'id'>;
export type ApplicationTypeInsert = Omit<ApplicationType, 'id'>;
export type GeneratedApplicationInsert = Omit<GeneratedApplication, 'id' | 'created_at'>;
