/**
 * Database service for Awedan Sahayak.
 *
 * Uses expo-sqlite (async API). All operations return Promises.
 * Aadhar full number is NEVER stored — see user_profile schema.
 */

import * as SQLite from 'expo-sqlite';
import {
  UserProfile,
  UserProfileInsert,
  Office,
  OfficeInsert,
  ApplicationType,
  ApplicationTypeInsert,
  GeneratedApplication,
  GeneratedApplicationInsert,
  OfficeType,
  SubscriptionStatus,
} from '../types/database';
import { OFFICE_SEEDS, APPLICATION_TYPE_SEEDS } from './seed';

// ── Database handle ─────────────────────────────────────────────────

let db: SQLite.SQLiteDatabase | null = null;

/** Returns the shared database instance. Must call initDatabase() first. */
export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error(
      'Database not initialized. Call initDatabase() before using any DB functions.',
    );
  }
  return db;
}

// ── Initialization ──────────────────────────────────────────────────

/** Opens (or creates) the database and runs migrations. Safe to call on every app launch. */
export async function initDatabase(): Promise<void> {
  console.log('[DB] Opening database...');
  db = await SQLite.openDatabaseAsync('awedan_sahayak.db');
  console.log('[DB] Database opened successfully.');

  // Enable WAL mode for better concurrent read performance
  // WAL can fail on some devices with limited storage — not fatal
  try {
    await db.execAsync('PRAGMA journal_mode = WAL;');
    console.log('[DB] WAL mode enabled.');
  } catch (walErr: any) {
    console.warn('[DB] WAL mode not available, using default journal:', walErr?.message);
  }

  await db.execAsync('PRAGMA foreign_keys = ON;');
  console.log('[DB] Foreign keys enabled.');

  // ── Create tables ───────────────────────────────────────────────

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      name                TEXT    NOT NULL,
      dob                 TEXT,
      gender              TEXT,
      address             TEXT,
      phone               TEXT,
      village             TEXT,
      post                TEXT,
      thana               TEXT,
      district            TEXT,
      state               TEXT,
      parent_spouse_name  TEXT,
      aadhar_last4        TEXT,    -- ONLY last 4 digits — full Aadhar NEVER stored
      created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS offices (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      type           TEXT    NOT NULL CHECK(type IN ('thana','block','bdo','co','sdo','sp','dc','court','bank','college','school','pwd','rcd','bcd')),
      name_hindi     TEXT    NOT NULL,
      name_english   TEXT    NOT NULL,
      district       TEXT,
      block          TEXT,
      full_address   TEXT,
      phone_number   TEXT,
      latitude       REAL,
      longitude      REAL,
      working_hours  TEXT,
      landmark       TEXT,
      is_verified    INTEGER NOT NULL DEFAULT 0
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS application_types (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      office_type               TEXT    NOT NULL CHECK(office_type IN ('thana','block','bdo','co','sdo','sp','dc','court','bank','college','school','pwd','rcd','bcd')),
      name_hindi                TEXT    NOT NULL,
      name_english              TEXT    NOT NULL,
      keywords                  TEXT,     -- JSON array
      required_fields           TEXT,     -- JSON array
      prompt_template           TEXT,     -- Claude API template with {{placeholders}}
      requires_legal_disclaimer INTEGER NOT NULL DEFAULT 0,  -- 1 = show disclaimer before generating
      disclaimer_text           TEXT      -- Legal disclaimer shown in UI
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS generated_applications (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      application_type_id  INTEGER REFERENCES application_types(id) ON DELETE SET NULL,
      office_id            INTEGER REFERENCES offices(id) ON DELETE SET NULL,
      raw_input_text       TEXT    NOT NULL,
      generated_text       TEXT,
      pdf_path             TEXT,
      is_escalation_of     INTEGER REFERENCES generated_applications(id) ON DELETE SET NULL,
      created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: add disclaimer columns if upgrading from older schema
  try {
    await db.execAsync(`ALTER TABLE application_types ADD COLUMN requires_legal_disclaimer INTEGER NOT NULL DEFAULT 0;`);
  } catch { /* column already exists */ }
  try {
    await db.execAsync(`ALTER TABLE application_types ADD COLUMN disclaimer_text TEXT;`);
  } catch { /* column already exists */ }

  // Migration: upgrade offices table with new fields
  try { await db.execAsync(`ALTER TABLE offices ADD COLUMN full_address TEXT;`); } catch { /* column exists */ }
  try { await db.execAsync(`ALTER TABLE offices ADD COLUMN phone_number TEXT;`); } catch { /* column exists */ }
  try { await db.execAsync(`ALTER TABLE offices ADD COLUMN landmark TEXT;`); } catch { /* column exists */ }
  try { await db.execAsync(`ALTER TABLE offices ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0;`); } catch { /* column exists */ }
  // Copy data from old columns if they exist
  try {
    await db.execAsync(`UPDATE offices SET full_address = address WHERE full_address IS NULL AND address IS NOT NULL;`);
  } catch { /* old column may not exist */ }
  try {
    await db.execAsync(`UPDATE offices SET phone_number = phone WHERE phone_number IS NULL AND phone IS NOT NULL;`);
  } catch { /* old column may not exist */ }

  // Migration: add base identity fields to all existing application types
  await migrateBaseIdentityFields();

  // Migration: add accused identification fields to complaint-type applications
  await migrateAccusedFields();

  // Migration: apply targeted field patches to existing application types
  // (general-purpose mechanism — add entries to FIELD_PATCHES below)
  await migrateFieldPatches();

  // Migration: update verified office data (skipped — offices are generic categories)
  await migrateVerifiedOfficeData();

  // Migration: add location + identity columns to user_profile
  await migrateUserProfileFields();

  // Migration: add reminder columns to generated_applications
  await migrateReminderColumns();

  // Migration: add app_metadata key-value table for monetization tracking
  await migrateAppMetadataTable();

  // Migration: add custom_office_name column for custom/blank applications
  await migrateCustomOfficeName();

  // Create indexes for common queries
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_offices_type ON offices(type);`);
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_app_types_office ON application_types(office_type);`);
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_gen_apps_date ON generated_applications(created_at DESC);`);

  // Seed initial data (safe — skips if data already exists)
  await seedIfEmpty();
}

// ── Base identity fields migration ───────────────────────────────────

/** Fields that every application type must include for header/footer generation. */
const BASE_IDENTITY_FIELDS = [
  'applicant_name',
  'parent_spouse_name',
  'village',
  'post',
  'thana',
  'district',
  'state',
  'mobile',
  'gender',
];

const APPLICANT_NAME_VARIANTS = new Set([
  'applicant_name', 'deponent_name', 'petitioner_name',
  'missing_person_name', 'child_name',
]);

const PARENT_NAME_VARIANTS = new Set([
  'parent_spouse_name', 'father_name', 'father_husband_name',
  'deponent_father_name',
]);

/**
 * Adds the standard base identity fields to every application type's
 * required_fields array if they're not already present (including
 * recognised variant names).
 *
 * Safe to call on every app launch — each row is only updated once.
 * Uses a lightweight tracker column (`disclaimer_text IS NOT NULL` is
 * already handled) — we check each row's fields individually and only
 * UPDATE when needed, so this is idempotent.
 */
async function migrateBaseIdentityFields(): Promise<void> {
  const database = getDb();
  console.log('[DB] Checking for base identity fields migration...');

  try {
    const rows = await database.getAllAsync<{ id: number; required_fields: string }>(
      'SELECT id, required_fields FROM application_types',
    );

    let migrated = 0;
    for (const row of rows) {
      let fields: string[];
      try {
        fields = JSON.parse(row.required_fields ?? '[]');
      } catch {
        fields = [];
      }
      if (!Array.isArray(fields) || fields.length === 0) continue;

      const existing = new Set(fields);
      const toAdd: string[] = [];

      for (const f of BASE_IDENTITY_FIELDS) {
        if (f === 'applicant_name' && fields.some((x) => APPLICANT_NAME_VARIANTS.has(x))) continue;
        if (f === 'parent_spouse_name' && fields.some((x) => PARENT_NAME_VARIANTS.has(x))) continue;
        if (!existing.has(f)) toAdd.push(f);
      }

      if (toAdd.length > 0) {
        const updated = [...toAdd, ...fields];
        await database.runAsync(
          'UPDATE application_types SET required_fields = ? WHERE id = ?',
          JSON.stringify(updated),
          row.id,
        );
        migrated++;
      }
    }

    if (migrated > 0) {
      console.log(`[DB] ✅ Base identity fields added to ${migrated} application type(s).`);
    } else {
      console.log('[DB] Base identity fields already present — no migration needed.');
    }
  } catch (err: any) {
    console.warn('[DB] Base identity fields migration failed (non-fatal):', err?.message);
  }
}

/**
 * Adds accused identification fields (father_name and village) to
 * complaint-type application types that involve an accused/opposing party.
 * Uses the correct prefix based on the existing field naming convention.
 *
 * Safe to call on every launch — idempotent, only adds missing fields.
 */
async function migrateAccusedFields(): Promise<void> {
  const database = getDb();
  console.log('[DB] Checking for accused fields migration...');

  // Map from existing "name" field → [father_name_field, village_field] to add
  const ACCUSED_FIELD_PAIRS: Record<string, [string, string]> = {
    accused_name:       ['accused_father_name', 'accused_village'],
    accused_names:      ['accused_father_name', 'accused_village'],
    accused_father:     ['accused_village', ''], // upgrade accused_father → accused_father_name handled separately
    opposing_party:     ['opposing_party_father_name', 'opposing_party_village'],
    opposing_party_name:['opposing_party_father_name', 'opposing_party_village'],
    encroacher_name:    ['encroacher_father_name', 'encroacher_village'],
    respondent_name:    ['respondent_father_name', 'respondent_village'],
    threat_source:      ['accused_father_name', 'accused_village'],
  };

  try {
    const rows = await database.getAllAsync<{ id: number; required_fields: string }>(
      'SELECT id, required_fields FROM application_types',
    );

    let migrated = 0;
    for (const row of rows) {
      let fields: string[];
      try {
        fields = JSON.parse(row.required_fields ?? '[]');
      } catch {
        fields = [];
      }
      if (!Array.isArray(fields) || fields.length === 0) continue;

      const existing = new Set(fields);
      const toAdd: string[] = [];

      // Rename accused_father → accused_father_name
      if (existing.has('accused_father')) {
        fields = fields.map((f) => (f === 'accused_father' ? 'accused_father_name' : f));
        existing.delete('accused_father');
        existing.add('accused_father_name');
      }

      // Check each accused name field pattern
      for (const [nameField, [fatherField, villageField]] of Object.entries(ACCUSED_FIELD_PAIRS)) {
        if (existing.has(nameField)) {
          if (fatherField && !existing.has(fatherField)) toAdd.push(fatherField);
          if (villageField && !existing.has(villageField)) toAdd.push(villageField);
        }
      }

      if (toAdd.length > 0) {
        const updated = [...fields, ...toAdd];
        await database.runAsync(
          'UPDATE application_types SET required_fields = ? WHERE id = ?',
          JSON.stringify(updated),
          row.id,
        );
        migrated++;
      }
    }

    if (migrated > 0) {
      console.log(`[DB] ✅ Accused fields added to ${migrated} application type(s).`);
    } else {
      console.log('[DB] Accused fields already present — no migration needed.');
    }
  } catch (err: any) {
    console.warn('[DB] Accused fields migration failed (non-fatal):', err?.message);
  }
}

// ── Targeted field patches ────────────────────────────────────────────
//
// GENERAL-PURPOSE MECHANISM for adding new required_fields to EXISTING
// application_type rows when we modify an existing type (as opposed to
// adding a brand-new type, which seedIfEmpty handles via insert).
//
// To add fields to an existing application type, add an entry below.
// Each entry is: { name: 'exact name_hindi', add: ['field1','field2'] }
//
// The migration reads the current required_fields JSON, adds any missing
// fields from the patch, and UPDATES the row if anything changed.
// Safe to call on every app launch — idempotent, checks before writing.

interface FieldPatch {
  /** Exact match on application_types.name_hindi. */
  name: string;
  /** Fields to ensure are present in required_fields. */
  add: string[];
}

const FIELD_PATCHES: FieldPatch[] = [
  // ── CO land types: add khata_number + ancestor fields ────────────
  {
    name: 'भूमि नापी आवेदन',
    add: ['original_owner_name', 'relation_to_owner'],
  },
  {
    name: 'दाखिल-खारिज आवेदन',
    add: ['original_owner_name', 'relation_to_owner'],
  },
  {
    name: 'परचा आवेदन',
    add: ['original_owner_name', 'relation_to_owner'],
  },
  {
    name: 'राजस्व रिकॉर्ड सुधार',
    add: ['khata_number', 'khasra_number', 'original_owner_name', 'relation_to_owner'],
  },
  {
    name: 'अतिक्रमण शिकायत',
    add: ['khata_number', 'original_owner_name', 'relation_to_owner'],
  },
  {
    name: 'भूमि विवाद आवेदन',
    add: ['khata_number', 'original_owner_name', 'relation_to_owner'],
  },
  {
    name: 'म्यूटेशन/LPC रोकने हेतु आवेदन',
    add: ['khasra_number', 'original_owner_name', 'relation_to_owner'],
  },
  {
    name: 'लगान रसीद निर्गत कराने हेतु आवेदन',
    add: ['khasra_number', 'khata_number', 'original_owner_name', 'relation_to_owner'],
  },
  {
    name: 'LPC निर्गत कराने हेतु आवेदन',
    add: ['khasra_number', 'khata_number', 'original_owner_name', 'relation_to_owner'],
  },
];

/**
 * Applies FIELD_PATCHES to existing application_type rows.
 *
 * For each patch entry, reads the current required_fields JSON,
 * merges in any missing fields from the patch, and UPDATEs the row
 * only if the JSON actually changed (idempotent — safe on every launch).
 */
async function migrateFieldPatches(): Promise<void> {
  const database = getDb();
  console.log('[DB] Checking for field patches to existing application types...');

  let patched = 0;

  try {
    for (const patch of FIELD_PATCHES) {
      // Fetch current row
      const row = await database.getFirstAsync<{ id: number; required_fields: string }>(
        'SELECT id, required_fields FROM application_types WHERE name_hindi = ?',
        patch.name,
      );
      if (!row) continue; // type doesn't exist yet — seedIfEmpty will create it

      let fields: string[];
      try {
        fields = JSON.parse(row.required_fields ?? '[]');
      } catch {
        fields = [];
      }
      if (!Array.isArray(fields)) fields = [];

      const existing = new Set(fields);
      let changed = false;

      for (const f of patch.add) {
        if (!existing.has(f)) {
          fields.push(f);
          existing.add(f);
          changed = true;
        }
      }

      if (changed) {
        await database.runAsync(
          'UPDATE application_types SET required_fields = ? WHERE id = ?',
          JSON.stringify(fields),
          row.id,
        );
        patched++;
        console.log(`[DB] 🔧 Patched "${patch.name}": added [${patch.add.filter((f) => !existing.has(f)).join(', ')}]`);
      }
    }

    if (patched > 0) {
      console.log(`[DB] ✅ Field patches applied to ${patched} application type(s).`);
    } else {
      console.log('[DB] Field patches: all types already up-to-date — no changes needed.');
    }
  } catch (err: any) {
    console.warn('[DB] Field patches migration failed (non-fatal):', err?.message);
  }
}

/**
 * Updates verified office records with real data from official sources.
 * Run on every launch — idempotent.
 *
 * NOTE: With generic office categories (pre-launch testing), there are
 * no location-specific records to verify. This migration is a no-op
 * until the Office Directory (कार्यालय tab) supports user-added
 * location-specific offices with verified data from official sources.
 */
async function migrateVerifiedOfficeData(): Promise<void> {
  console.log('[DB] Verified office data migration: skipped (offices are generic categories).');
}

/**
 * Seeds offices and application_types.
 *
 * Uses "insert if missing" logic (by type + name_hindi) so that new
 * seed entries are automatically added to existing databases on the
 * next launch — no need to wipe and re-seed.
 */
async function seedIfEmpty(): Promise<void> {
  const database = getDb();

  // ── Offices: insert any that don't already exist ──────────────────
  let officeAdded = 0;
  for (const office of OFFICE_SEEDS) {
    const existing = await database.getFirstAsync<{ cnt: number }>(
      'SELECT COUNT(*) AS cnt FROM offices WHERE type = ? AND name_hindi = ?',
      office.type, office.name_hindi,
    );
    if (!existing || existing.cnt === 0) {
      await database.runAsync(
        `INSERT INTO offices (type, name_hindi, name_english, district, block, full_address, phone_number, latitude, longitude, working_hours, landmark, is_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        office.type, office.name_hindi, office.name_english,
        office.district, office.block, office.full_address, office.phone_number,
        office.latitude, office.longitude, office.working_hours,
        office.landmark, office.is_verified,
      );
      officeAdded++;
    }
  }
  if (officeAdded > 0) {
    console.log(`[DB] Seeded ${officeAdded} new office(s) (${OFFICE_SEEDS.length} total in seed).`);
  }

  // ── Application types: insert any that don't already exist ────────
  let appTypeAdded = 0;
  for (const at of APPLICATION_TYPE_SEEDS) {
    const existing = await database.getFirstAsync<{ cnt: number }>(
      'SELECT COUNT(*) AS cnt FROM application_types WHERE office_type = ? AND name_hindi = ?',
      at.office_type, at.name_hindi,
    );
    if (!existing || existing.cnt === 0) {
      await database.runAsync(
        `INSERT INTO application_types (office_type, name_hindi, name_english, keywords, required_fields, prompt_template, requires_legal_disclaimer, disclaimer_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        at.office_type, at.name_hindi, at.name_english,
        at.keywords, at.required_fields, at.prompt_template,
        at.requires_legal_disclaimer, at.disclaimer_text,
      );
      appTypeAdded++;
    }
  }
  if (appTypeAdded > 0) {
    console.log(`[DB] Seeded ${appTypeAdded} new application type(s) (${APPLICATION_TYPE_SEEDS.length} total in seed).`);
  }
}

/**
 * Adds location + identity columns (gender, village, post, thana,
 * district, state, parent_spouse_name) to user_profile table for
 * existing installations. Safe to call on every launch — idempotent.
 */
/** Adds reminder_date, notification_id, and reminder_days columns to generated_applications. */
async function migrateReminderColumns(): Promise<void> {
  const database = getDb();
  console.log('[DB] Checking for reminder columns migration...');
  try {
    try { await database.execAsync(`ALTER TABLE generated_applications ADD COLUMN reminder_date TEXT;`); console.log('[DB] ✅ Added reminder_date'); } catch { /* exists */ }
    try { await database.execAsync(`ALTER TABLE generated_applications ADD COLUMN notification_id TEXT;`); console.log('[DB] ✅ Added notification_id'); } catch { /* exists */ }
    try { await database.execAsync(`ALTER TABLE generated_applications ADD COLUMN reminder_days INTEGER;`); console.log('[DB] ✅ Added reminder_days'); } catch { /* exists */ }
  } catch (err: any) {
    console.warn('[DB] Reminder columns migration warning:', err?.message);
  }
}

async function migrateUserProfileFields(): Promise<void> {
  const database = getDb();
  console.log('[DB] Checking for user_profile location columns migration...');

  const NEW_COLUMNS: [string, string][] = [
    ['gender',              'TEXT'],
    ['village',             'TEXT'],
    ['post',                'TEXT'],
    ['thana',               'TEXT'],
    ['district',            'TEXT'],
    ['state',               'TEXT'],
    ['parent_spouse_name',  'TEXT'],
  ];

  try {
    for (const [col, type] of NEW_COLUMNS) {
      try {
        await database.execAsync(`ALTER TABLE user_profile ADD COLUMN ${col} ${type};`);
        console.log(`[DB] ✅ Added column user_profile.${col}`);
      } catch {
        // Column already exists — safe to ignore
      }
    }
    console.log('[DB] user_profile location columns migration complete.');
  } catch (err: any) {
    console.warn('[DB] user_profile migration warning:', err?.message);
  }
}

/**
 * Creates the app_metadata key-value table for monetization tracking
 * (free usage count, subscription status, paid credits, etc.).
 * Safe to call on every launch — idempotent.
 */
async function migrateAppMetadataTable(): Promise<void> {
  const database = getDb();
  console.log('[DB] Checking for app_metadata table migration...');
  try {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS app_metadata (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    console.log('[DB] ✅ app_metadata table ready.');
  } catch (err: any) {
    console.warn('[DB] app_metadata migration warning:', err?.message);
  }
}

/**
 * Adds custom_office_name column to generated_applications for
 * the custom/blank application feature (users can create applications
 * for any office not covered by the 77+ predefined types).
 * Safe to call on every launch — idempotent.
 */
async function migrateCustomOfficeName(): Promise<void> {
  const database = getDb();
  console.log('[DB] Checking for custom_office_name migration...');
  try {
    await database.execAsync(`ALTER TABLE generated_applications ADD COLUMN custom_office_name TEXT;`);
    console.log('[DB] ✅ Added custom_office_name column');
  } catch {
    // Column already exists
  }
}

// ── App Metadata CRUD (key-value store) ────────────────────────────

/** Get a string value by key. Returns null if key doesn't exist. */
export async function getMetadata(key: string): Promise<string | null> {
  const row = await getDb().getFirstAsync<{ value: string }>(
    'SELECT value FROM app_metadata WHERE key = ?;',
    key,
  );
  return row?.value ?? null;
}

/** Set a string value for a key. Upserts (insert or replace). */
export async function setMetadata(key: string, value: string): Promise<void> {
  await getDb().runAsync(
    'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?);',
    key,
    value,
  );
}

/** Get an integer value by key. Returns 0 if key doesn't exist. */
export async function getMetadataInt(key: string): Promise<number> {
  const value = await getMetadata(key);
  if (value === null) return 0;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Set an integer value for a key. */
export async function setMetadataInt(key: string, value: number): Promise<void> {
  await setMetadata(key, String(Math.floor(value)));
}

// ── Address parser ────────────────────────────────────────────────────

export interface ParsedAddress {
  village: string | null;
  post: string | null;
  thana: string | null;
  district: string | null;
  state: string | null;
  parent_spouse_name: string | null;
  // the remaining cleaned-up address line(s)
  cleanedAddress: string;
}

/**
 * Parses a combined Indian address string (from Aadhar OCR or manual entry)
 * into structured location components using keyword pattern matching.
 *
 * Example input: "W/O राजेश कुमार ठाकुर, ग्राम मनार, पोस्ट ढौठवा,
 *                  थाना कटकमसांडी, हजारीबाग, झारखण्ड - 825408"
 */
export function parseAddressComponents(rawAddress: string): ParsedAddress {
  const result: ParsedAddress = {
    village: null,
    post: null,
    thana: null,
    district: null,
    state: null,
    parent_spouse_name: null,
    cleanedAddress: rawAddress.trim(),
  };

  if (!rawAddress || !rawAddress.trim()) return result;

  let text = rawAddress.trim();

  // 1. Extract parent/spouse name: "W/O X", "S/O X", "D/O X", "C/O X"
  const relationMatch = text.match(/([WSDC])\s*\/\s*O\s+([^,]+)/i);
  if (relationMatch) {
    const relType: Record<string, string> = { W: 'पति', S: 'पिता', D: 'पिता', C: 'अभिभावक' };
    const rel = relType[relationMatch[1].toUpperCase()] || relationMatch[1].toUpperCase();
    result.parent_spouse_name = `${relationMatch[2].trim()} (${rel})`;
    text = text.replace(relationMatch[0], '').trim();
    text = text.replace(/^[,\s]+/, '');
  }

  // 2. Extract PIN code (6 digits) — often at end of address
  const pinMatch = text.match(/\b(\d{6})\b/);
  if (pinMatch) {
    text = text.replace(pinMatch[0], '').trim();
    text = text.replace(/[,\s]*-\s*$/, '').trim();
  }

  // 3. Extract components using keyword patterns
  // Order matters — check more specific patterns first

  const patterns: Array<{ key: keyof ParsedAddress; regex: RegExp }> = [
    // State: often "झारखण्ड", "बिहार", "Jharkhand", etc.
    { key: 'state', regex: /(?:राज्य|State|झारखण्ड|Jharkhand|बिहार|Bihar|उत्तर\s*प्रदेश|Uttar\s*Pradesh|मध्य\s*प्रदेश|Madhya\s*Pradesh|राजस्थान|Rajasthan|गुजरात|Gujarat|महाराष्ट्र|Maharashtra|पंजाब|Punjab|हरियाणा|Haryana|पश्चिम\s*बंगाल|West\s*Bengal|ओडिशा|Odisha|छत्तीसगढ़|Chhattisgarh|उत्तराखंड|Uttarakhand|हिमाचल|Himachal|दिल्ली|Delhi)\b\s*/gi },
    // District: "जिला X", "जिला - X", "DIST: X", "District X", or bare district name before state
    { key: 'district', regex: /(?:जिला|DIST|District|Dist)\s*[-:]*\s*([^,]+)/i },
    // Thana/Police Station: "थाना X", "Thana X"
    { key: 'thana', regex: /(?:थाना|Thana)\s*[-:]*\s*([^,]+)/i },
    // Post: "पोस्ट X", "पो X", "PO: X", "Post X"
    { key: 'post', regex: /(?:पोस्ट|पो\.?\s*|PO\s*[:]?\s*|Post\s*[:]?\s*)([^,]+)/i },
    // Village: "ग्राम X", "गाँव X", "Vill X", "Village X"
    { key: 'village', regex: /(?:ग्राम|गाँव|Vill(?:age)?)\s*[-:]*\s*([^,]+)/i },
  ];

  for (const { key, regex } of patterns) {
    const m = text.match(regex);
    if (m) {
      const value = (m[1] || m[0]).replace(/[-:]/g, '').trim();
      if (value) {
        (result as any)[key] = value;
        // Remove the matched portion from text
        text = text.replace(m[0], '').trim();
        text = text.replace(/^[,\s]+/, '').replace(/,\s*,/g, ',');
      }
    }
  }

  // 4. Clean up remaining text
  result.cleanedAddress = text.replace(/,\s*,/g, ',').replace(/^[,\s]+/, '').replace(/[,\s]+$/, '').trim();

  return result;
}

// ── User Profile CRUD ───────────────────────────────────────────────

/** Fetch the user profile (app expects a single local user). */
export async function getUserProfile(): Promise<UserProfile | null> {
  const row = await getDb().getFirstAsync<UserProfile>('SELECT * FROM user_profile LIMIT 1;');
  if (__DEV__) { console.log('[DB] getUserProfile() returned:', JSON.stringify(row, null, 2)); }
  return row;
}

/** Create a new user profile. Will throw if a profile already exists. */
export async function createUserProfile(profile: UserProfileInsert): Promise<UserProfile> {
  const result = await getDb().runAsync(
    `INSERT INTO user_profile
       (name, dob, gender, address, phone, village, post, thana, district, state, parent_spouse_name, aadhar_last4)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    profile.name, profile.dob, profile.gender, profile.address, profile.phone,
    profile.village, profile.post, profile.thana, profile.district, profile.state,
    profile.parent_spouse_name, profile.aadhar_last4,
  );
  const row = await getDb().getFirstAsync<UserProfile>(
    'SELECT * FROM user_profile WHERE id = ?;',
    result.lastInsertRowId,
  );
  return row!;
}

/** Update the existing user profile. Returns the updated row. */
export async function updateUserProfile(profile: Partial<UserProfileInsert>): Promise<UserProfile | null> {
  const existing = await getUserProfile();
  if (!existing) return null;

  const merge = (key: keyof UserProfileInsert): any =>
    profile[key] !== undefined ? profile[key] : existing[key as keyof UserProfile] ?? null;

  const name = merge('name');
  const dob = merge('dob');
  const gender = merge('gender');
  const address = merge('address');
  const phone = merge('phone');
  const village = merge('village');
  const post = merge('post');
  const thana = merge('thana');
  const district = merge('district');
  const state = merge('state');
  const parent_spouse_name = merge('parent_spouse_name');
  const aadhar_last4 = merge('aadhar_last4');

  await getDb().runAsync(
    `UPDATE user_profile SET
       name=?, dob=?, gender=?, address=?, phone=?,
       village=?, post=?, thana=?, district=?, state=?,
       parent_spouse_name=?, aadhar_last4=?
     WHERE id=?;`,
    name, dob, gender, address, phone,
    village, post, thana, district, state,
    parent_spouse_name, aadhar_last4,
    existing.id,
  );
  return getUserProfile();
}

// ── Offices CRUD ────────────────────────────────────────────────────

/** Get all offices, optionally filtered by type. */
export async function getOffices(type?: OfficeType): Promise<Office[]> {
  if (type) {
    return getDb().getAllAsync<Office>('SELECT * FROM offices WHERE type = ? ORDER BY name_hindi;', type);
  }
  return getDb().getAllAsync<Office>('SELECT * FROM offices ORDER BY type, name_hindi;');
}

/** Get a single office by id. */
export async function getOfficeById(id: number): Promise<Office | null> {
  return getDb().getFirstAsync<Office>('SELECT * FROM offices WHERE id = ?;', id);
}

/** Insert a user-added office (e.g. a specific local police station). */
export async function insertOffice(office: OfficeInsert): Promise<Office> {
  const result = await getDb().runAsync(
    `INSERT INTO offices (type, name_hindi, name_english, district, block, full_address, phone_number, latitude, longitude, working_hours, landmark, is_verified)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    office.type, office.name_hindi, office.name_english,
    office.district, office.block, office.full_address, office.phone_number,
    office.latitude, office.longitude, office.working_hours,
    office.landmark, office.is_verified,
  );
  return (await getOfficeById(result.lastInsertRowId))!;
}

/** Update a user-added office's details (seeded offices can also be updated to fill in local data). */
export async function updateOffice(id: number, fields: Partial<OfficeInsert>): Promise<Office | null> {
  const existing = await getOfficeById(id);
  if (!existing) return null;

  await getDb().runAsync(
    `UPDATE offices SET
       type=?, name_hindi=?, name_english=?, district=?, block=?,
       full_address=?, phone_number=?, latitude=?, longitude=?, working_hours=?,
       landmark=?, is_verified=?
     WHERE id=?;`,
    fields.type ?? existing.type,
    fields.name_hindi ?? existing.name_hindi,
    fields.name_english ?? existing.name_english,
    fields.district !== undefined ? fields.district : existing.district,
    fields.block !== undefined ? fields.block : existing.block,
    fields.full_address !== undefined ? fields.full_address : existing.full_address,
    fields.phone_number !== undefined ? fields.phone_number : existing.phone_number,
    fields.latitude !== undefined ? fields.latitude : existing.latitude,
    fields.longitude !== undefined ? fields.longitude : existing.longitude,
    fields.working_hours !== undefined ? fields.working_hours : existing.working_hours,
    fields.landmark !== undefined ? fields.landmark : existing.landmark,
    fields.is_verified !== undefined ? fields.is_verified : existing.is_verified,
    id,
  );
  return getOfficeById(id);
}

/** Delete a user-added office. Safeguard: requires explicit confirmation for seeded offices. */
export async function deleteOffice(id: number): Promise<boolean> {
  const result = await getDb().runAsync('DELETE FROM offices WHERE id = ?;', id);
  return (result.changes ?? 0) > 0;
}

// ── Application Types CRUD ─────────────────────────────────────────

/** Get all application types, optionally filtered by office_type. */
export async function getApplicationTypes(officeType?: OfficeType): Promise<ApplicationType[]> {
  if (officeType) {
    return getDb().getAllAsync<ApplicationType>(
      'SELECT * FROM application_types WHERE office_type = ? ORDER BY name_hindi;',
      officeType,
    );
  }
  return getDb().getAllAsync<ApplicationType>('SELECT * FROM application_types ORDER BY office_type, name_hindi;');
}

/** Get a single application type by id. */
export async function getApplicationTypeById(id: number): Promise<ApplicationType | null> {
  return getDb().getFirstAsync<ApplicationType>('SELECT * FROM application_types WHERE id = ?;', id);
}

/** Search application types by keyword (searches name_hindi, name_english, and keywords JSON). */
export async function searchApplicationTypes(query: string): Promise<ApplicationType[]> {
  const pattern = `%${query}%`;
  return getDb().getAllAsync<ApplicationType>(
    `SELECT * FROM application_types
     WHERE name_hindi LIKE ? OR name_english LIKE ? OR keywords LIKE ?
     ORDER BY office_type, name_hindi;`,
    pattern, pattern, pattern,
  );
}

// ── Generated Applications CRUD ─────────────────────────────────────

/** Row returned by getApplicationsWithDetails — includes joined type/office names. */
export interface ApplicationListItem {
  id: number;
  application_type_id: number | null;
  office_id: number | null;
  generated_text: string | null;
  pdf_path: string | null;
  created_at: string;
  type_name_hindi: string | null;
  type_name_english: string | null;
  office_type: string | null;
  office_name_hindi: string | null;
  office_name_english: string | null;
  reminder_date: string | null;
  notification_id: string | null;
  reminder_days: number | null;
  custom_office_name: string | null;
}

/** Get all generated applications with JOINed type and office names, newest first. */
export async function getApplicationsWithDetails(): Promise<ApplicationListItem[]> {
  return getDb().getAllAsync<ApplicationListItem>(
    `SELECT
       ga.id, ga.application_type_id, ga.office_id,
       ga.generated_text, ga.pdf_path, ga.created_at,
       ga.reminder_date, ga.notification_id, ga.reminder_days,
       ga.custom_office_name,
       COALESCE(at.name_hindi, ga.custom_office_name)  AS type_name_hindi,
       COALESCE(at.name_english, ga.custom_office_name) AS type_name_english,
       COALESCE(o.type, 'custom')         AS office_type,
       COALESCE(o.name_hindi, ga.custom_office_name)   AS office_name_hindi,
       COALESCE(o.name_english, ga.custom_office_name) AS office_name_english
     FROM generated_applications ga
     LEFT JOIN application_types at ON ga.application_type_id = at.id
     LEFT JOIN offices o ON ga.office_id = o.id
     ORDER BY ga.created_at DESC;`,
  );
}

/** Get all generated applications, newest first. */
export async function getGeneratedApplications(): Promise<GeneratedApplication[]> {
  return getDb().getAllAsync<GeneratedApplication>(
    'SELECT * FROM generated_applications ORDER BY created_at DESC;',
  );
}

/** Get a single generated application by id. */
export async function getGeneratedApplicationById(id: number): Promise<GeneratedApplication | null> {
  return getDb().getFirstAsync<GeneratedApplication>(
    'SELECT * FROM generated_applications WHERE id = ?;',
    id,
  );
}

/** Get applications that escalated from a given application. */
export async function getEscalationsFor(parentId: number): Promise<GeneratedApplication[]> {
  return getDb().getAllAsync<GeneratedApplication>(
    'SELECT * FROM generated_applications WHERE is_escalation_of = ? ORDER BY created_at DESC;',
    parentId,
  );
}

/** Insert a new generated application. */
export async function insertGeneratedApplication(app: GeneratedApplicationInsert): Promise<GeneratedApplication> {
  const result = await getDb().runAsync(
    `INSERT INTO generated_applications (application_type_id, office_id, raw_input_text, generated_text, pdf_path, is_escalation_of, reminder_date, notification_id, reminder_days, custom_office_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    app.application_type_id, app.office_id, app.raw_input_text,
    app.generated_text, app.pdf_path, app.is_escalation_of,
    (app as any).reminder_date ?? null,
    (app as any).notification_id ?? null,
    (app as any).reminder_days ?? null,
    (app as any).custom_office_name ?? null,
  );
  return (await getGeneratedApplicationById(result.lastInsertRowId))!;
}

/** Update a generated application (e.g. after PDF export). */
export async function updateGeneratedApplication(
  id: number,
  fields: Partial<Pick<GeneratedApplicationInsert, 'generated_text' | 'pdf_path'>>,
): Promise<GeneratedApplication | null> {
  const existing = await getGeneratedApplicationById(id);
  if (!existing) return null;

  await getDb().runAsync(
    `UPDATE generated_applications SET generated_text=?, pdf_path=?, reminder_date=?, notification_id=?, reminder_days=? WHERE id=?;`,
    fields.generated_text !== undefined ? fields.generated_text : existing.generated_text,
    fields.pdf_path !== undefined ? fields.pdf_path : existing.pdf_path,
    (fields as any).reminder_date !== undefined ? (fields as any).reminder_date : (existing as any).reminder_date,
    (fields as any).notification_id !== undefined ? (fields as any).notification_id : (existing as any).notification_id,
    (fields as any).reminder_days !== undefined ? (fields as any).reminder_days : (existing as any).reminder_days,
    id,
  );
  return getGeneratedApplicationById(id);
}

/** Cancel a scheduled reminder by clearing its notification fields. */
export async function cancelReminder(id: number): Promise<boolean> {
  const result = await getDb().runAsync(
    `UPDATE generated_applications SET notification_id = NULL WHERE id = ?;`,
    id,
  );
  return (result.changes ?? 0) > 0;
}

/** Delete a generated application and its escalation chain (orphaned escalations). */
export async function deleteGeneratedApplication(id: number): Promise<boolean> {
  // Unlink escalations before deleting
  await getDb().runAsync(
    'UPDATE generated_applications SET is_escalation_of = NULL WHERE is_escalation_of = ?;',
    id,
  );
  const result = await getDb().runAsync('DELETE FROM generated_applications WHERE id = ?;', id);
  return (result.changes ?? 0) > 0;
}
