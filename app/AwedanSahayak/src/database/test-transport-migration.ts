/**
 * Phase 9G — Transport Office Migration Tests
 * Tests actual SQLite database behaviour.
 * Run: npx tsx src/database/test-transport-migration.ts
 */
import * as SQLite from 'expo-sqlite';
import { ApplicationTypeInsert } from '../types/database';

let p = 0, f = 0;
function ok(name: string, fn: () => Promise<void> | void) {
  (async () => {
    try { await fn(); p++; console.log('  \x1b[32m✓\x1b[0m', name); }
    catch (e: any) { f++; console.log('  \x1b[31m✗\x1b[0m', name, '\n   ', e.message); }
  })();
}

// ── Helpers ───────────────────────────────────────────────────────────────
let db: SQLite.SQLiteDatabase;

async function createOldDatabase() {
  db = await SQLite.openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const oldTypes = "('thana','block','bdo','co','sdo','sp','dc','court','bank','college','school','pwd','rcd','bcd')";

  await db.execAsync(`CREATE TABLE offices (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL CHECK(type IN ${oldTypes}), name_hindi TEXT NOT NULL, name_english TEXT NOT NULL, district TEXT, block TEXT, full_address TEXT, phone_number TEXT, latitude REAL, longitude REAL, working_hours TEXT, landmark TEXT, is_verified INTEGER NOT NULL DEFAULT 0);`);
  await db.execAsync(`CREATE TABLE application_types (id INTEGER PRIMARY KEY AUTOINCREMENT, office_type TEXT NOT NULL CHECK(office_type IN ${oldTypes}), name_hindi TEXT NOT NULL, name_english TEXT NOT NULL, keywords TEXT, required_fields TEXT, prompt_template TEXT, requires_legal_disclaimer INTEGER NOT NULL DEFAULT 0, disclaimer_text TEXT, version INTEGER NOT NULL DEFAULT 1, is_premium INTEGER NOT NULL DEFAULT 0, search_weight REAL NOT NULL DEFAULT 1.0, category TEXT);`);
  await db.execAsync('CREATE TABLE template_favorites (id INTEGER PRIMARY KEY AUTOINCREMENT, template_id INTEGER NOT NULL UNIQUE, added_at TEXT NOT NULL DEFAULT (datetime(\'now\')));');
  await db.execAsync('CREATE TABLE template_recents (id INTEGER PRIMARY KEY AUTOINCREMENT, template_id INTEGER NOT NULL, opened_at TEXT NOT NULL DEFAULT (datetime(\'now\')));');
  await db.execAsync('CREATE TABLE generated_applications (id INTEGER PRIMARY KEY AUTOINCREMENT, application_type_id INTEGER REFERENCES application_types(id) ON DELETE SET NULL, office_id INTEGER REFERENCES offices(id) ON DELETE SET NULL, raw_input_text TEXT NOT NULL, generated_text TEXT, pdf_path TEXT, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')));');
  await db.execAsync('CREATE TABLE schema_migrations (migration_key TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime(\'now\')));');

  // Insert test data
  await db.runAsync("INSERT INTO offices (type, name_hindi, name_english) VALUES ('thana', 'थाना', 'Police Station');");
  await db.runAsync("INSERT INTO offices (type, name_hindi, name_english) VALUES ('block', 'प्रखंड', 'Block Office');");
  await db.runAsync("INSERT INTO application_types (office_type, name_hindi, name_english, keywords, required_fields, prompt_template) VALUES ('thana', 'टेस्ट आवेदन', 'Test App', '[\"test\"]', '[\"a\",\"b\"]', 'Test prompt');");
  await db.runAsync("INSERT INTO template_favorites (template_id) VALUES (1);");
  await db.runAsync("INSERT INTO template_recents (template_id) VALUES (1);");
  await db.runAsync("INSERT INTO generated_applications (application_type_id, raw_input_text, generated_text) VALUES (1, 'test input', 'test output');");
  console.log('  Old database created (14 types).');
}

async function closeDb() {
  if (db) { await db.closeAsync(); db = null as any; }
}

async function runMigration() {
  const t15 = "('thana','block','bdo','co','sdo','sp','dc','court','bank','college','school','pwd','rcd','bcd','transport')";
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  await db.execAsync('BEGIN TRANSACTION;');
  // Rebuild offices
  await db.execAsync(`CREATE TABLE offices_new (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL CHECK(type IN ${t15}), name_hindi TEXT NOT NULL, name_english TEXT NOT NULL, district TEXT, block TEXT, full_address TEXT, phone_number TEXT, latitude REAL, longitude REAL, working_hours TEXT, landmark TEXT, is_verified INTEGER NOT NULL DEFAULT 0);`);
  await db.execAsync('INSERT INTO offices_new SELECT * FROM offices;');
  await db.execAsync('DROP TABLE offices;');
  await db.execAsync('ALTER TABLE offices_new RENAME TO offices;');
  // Rebuild app_types
  await db.execAsync(`CREATE TABLE application_types_new (id INTEGER PRIMARY KEY AUTOINCREMENT, office_type TEXT NOT NULL CHECK(office_type IN ${t15}), name_hindi TEXT NOT NULL, name_english TEXT NOT NULL, keywords TEXT, required_fields TEXT, prompt_template TEXT, requires_legal_disclaimer INTEGER NOT NULL DEFAULT 0, disclaimer_text TEXT, version INTEGER NOT NULL DEFAULT 1, is_premium INTEGER NOT NULL DEFAULT 0, search_weight REAL NOT NULL DEFAULT 1.0, category TEXT);`);
  await db.execAsync('INSERT INTO application_types_new SELECT * FROM application_types;');
  await db.execAsync('DROP TABLE application_types;');
  await db.execAsync('ALTER TABLE application_types_new RENAME TO application_types;');
  // Record migration
  await db.runAsync("INSERT INTO schema_migrations (migration_key) VALUES ('add_transport_office_type_v1');");
  await db.execAsync('COMMIT;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  console.log('  Migration applied.');
}

// ── Tests ────────────────────────────────────────────────────────────────
console.log('\n📋 Migration Setup');
ok('Create old 14-type database', async () => { await createOldDatabase(); });
ok('Transport insert fails before migration', async () => {
  try {
    await db.runAsync("INSERT INTO offices (type, name_hindi, name_english) VALUES ('transport', 'परिवहन', 'Transport');");
    throw 'Should have failed';
  } catch (e: any) {
    if (!e.message?.includes('CHECK constraint')) throw 'Unexpected error: ' + e.message;
  }
});
ok('Office count before migration = 2', async () => {
  const r = await db.getFirstAsync<{cnt:number}>('SELECT COUNT(*) AS cnt FROM offices;');
  if (r?.cnt !== 2) throw `Expected 2, got ${r?.cnt}`;
});
ok('App type count before migration = 1', async () => {
  const r = await db.getFirstAsync<{cnt:number}>('SELECT COUNT(*) AS cnt FROM application_types;');
  if (r?.cnt !== 1) throw `Expected 1, got ${r?.cnt}`;
});
ok('Favorites preserved before migration', async () => {
  const r = await db.getFirstAsync<{cnt:number}>('SELECT COUNT(*) AS cnt FROM template_favorites;');
  if (r?.cnt !== 1) throw `Expected 1, got ${r?.cnt}`;
});

console.log('\n📋 Migration Execution');
ok('Migration runs without error', async () => { await runMigration(); });
ok('Migration record created', async () => {
  const r = await db.getFirstAsync<{cnt:number}>("SELECT COUNT(*) AS cnt FROM schema_migrations WHERE migration_key='add_transport_office_type_v1';");
  if (r?.cnt !== 1) throw 'Missing';
});
ok('Office count preserved (2)', async () => {
  const r = await db.getFirstAsync<{cnt:number}>('SELECT COUNT(*) AS cnt FROM offices;');
  if (r?.cnt !== 2) throw `Expected 2, got ${r?.cnt}`;
});
ok('Existing office ID preserved', async () => {
  const r = await db.getFirstAsync<{id:number}>('SELECT id FROM offices WHERE type=?', 'thana');
  if (r?.id !== 1) throw `Expected id 1, got ${r?.id}`;
});
ok('App type count preserved (1)', async () => {
  const r = await db.getFirstAsync<{cnt:number}>('SELECT COUNT(*) AS cnt FROM application_types;');
  if (r?.cnt !== 1) throw `Expected 1, got ${r?.cnt}`;
});
ok('Existing app type ID preserved', async () => {
  const r = await db.getFirstAsync<{id:number}>('SELECT id FROM application_types;');
  if (r?.id !== 1) throw `Expected id 1, got ${r?.id}`;
});
ok('Favorites preserved', async () => {
  const r = await db.getFirstAsync<{cnt:number}>('SELECT COUNT(*) AS cnt FROM template_favorites;');
  if (r?.cnt !== 1) throw `Expected 1, got ${r?.cnt}`;
});
ok('Recents preserved', async () => {
  const r = await db.getFirstAsync<{cnt:number}>('SELECT COUNT(*) AS cnt FROM template_recents;');
  if (r?.cnt !== 1) throw `Expected 1, got ${r?.cnt}`;
});
ok('Generated application preserved', async () => {
  const r = await db.getFirstAsync<{cnt:number}>('SELECT COUNT(*) AS cnt FROM generated_applications;');
  if (r?.cnt !== 1) throw `Expected 1, got ${r?.cnt}`;
});

console.log('\n📋 Post-Migration Insert');
ok('Transport office inserts after migration', async () => {
  await db.runAsync("INSERT INTO offices (type, name_hindi, name_english) VALUES ('transport', 'परिवहन', 'Transport');");
  const r = await db.getFirstAsync<{cnt:number}>("SELECT COUNT(*) AS cnt FROM offices WHERE type='transport';");
  if (r?.cnt !== 1) throw `Expected 1, got ${r?.cnt}`;
});
ok('Transport template inserts after migration', async () => {
  await db.runAsync("INSERT INTO application_types (office_type, name_hindi, name_english, keywords, required_fields, prompt_template) VALUES ('transport', 'ड्राइविंग टेस्ट', 'Driving Test', '[\"driving\"]', '[\"a\"]', 'Test');");
  const r = await db.getFirstAsync<{cnt:number}>("SELECT COUNT(*) AS cnt FROM application_types WHERE office_type='transport';");
  if (r?.cnt !== 1) throw `Expected 1, got ${r?.cnt}`;
});
ok('Migration rerun is idempotent', async () => {
  const before = await db.getFirstAsync<{cnt:number}>('SELECT COUNT(*) AS cnt FROM offices;');
  await runMigration(); // Should not throw
  const after = await db.getFirstAsync<{cnt:number}>('SELECT COUNT(*) AS cnt FROM offices;');
  if (before?.cnt !== after?.cnt) throw `Count changed: ${before?.cnt} vs ${after?.cnt}`;
});
ok('Foreign key check empty', async () => {
  const fk = await db.getAllAsync('PRAGMA foreign_key_check;');
  if (fk.length > 0) throw `${fk.length} violations: ${JSON.stringify(fk)}`;
});

console.log('\n📋 Cleanup');
ok('Close database', async () => { await closeDb(); });

// ── Results ──────────────────────────────────────────────────────────────
setTimeout(() => {
  console.log(`\n═══════════════`);
  console.log(`  Migration Tests: ${p} passed, ${f} failed`);
  console.log(`═══════════════\n`);
  process.exit(f > 0 ? 1 : 0);
}, 2000);
