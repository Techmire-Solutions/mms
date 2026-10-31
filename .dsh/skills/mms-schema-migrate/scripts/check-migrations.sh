#!/usr/bin/env bash
# MMS migration & RLS integrity auditor.
#
# Fails (exit 1) when:
#   1. the Drizzle journal or a journal-referenced SQL file is missing
#   2. a `drizzle-kit push` invocation exists anywhere (banned — forward-only DDL)
#   3. a tenant table has no ENABLE ROW LEVEL SECURITY anywhere in the migration set
#   4. the write-blocking index ratchet reports a NEW violation
#
# FORCE ROW LEVEL SECURITY coverage is reported as a gap list; it becomes a hard
# failure with MMS_RLS_STRICT=1. RLS coverage is evaluated across ALL migrations
# (a later migration may correctly harden a table created earlier), not just the
# file that created the table.
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT_DIR"

MIGRATIONS_DIR="apps/backend/src/db/migrations_drizzle"
JOURNAL_FILE="$MIGRATIONS_DIR/meta/_journal.json"
FAILED=0

echo "🔍 Checking Drizzle migrations, RLS coverage and DDL lock safety…"

if [[ ! -f "$JOURNAL_FILE" ]]; then
  echo "✗ Missing migrations journal: $JOURNAL_FILE"
  exit 1
fi
echo "• Migration journal present."

echo "• Scanning for banned 'drizzle-kit push' invocations…"
if grep -rn 'drizzle-kit push' package.json apps/*/package.json packages/*/package.json 2>/dev/null; then
  echo "✗ Prohibited 'drizzle-kit push' found — all schema changes must be forward migrations."
  FAILED=1
fi

echo "• Verifying RLS coverage for every tenant table…"
node -e '
const fs = require("node:fs");
const path = require("node:path");

const migrationsDir = path.resolve("apps/backend/src/db/migrations_drizzle");
const journal = JSON.parse(fs.readFileSync(path.join(migrationsDir, "meta", "_journal.json"), "utf8"));

let missing = 0;
const sqlFiles = [];
for (const entry of journal.entries) {
  const sqlFile = path.join(migrationsDir, `${entry.tag}.sql`);
  if (!fs.existsSync(sqlFile)) {
    console.error(`✗ Journal entry has no SQL file: ${entry.tag}.sql`);
    missing++;
    continue;
  }
  sqlFiles.push({ tag: entry.tag, content: fs.readFileSync(sqlFile, "utf8") });
}

// Pass 1 — tenant tables (they carry workspace_subdomain) and where they were created.
const tables = new Map();
for (const { tag, content } of sqlFiles) {
  for (const statement of content.match(/CREATE TABLE[^;]+;/gi) ?? []) {
    if (!/workspace_subdomain/i.test(statement)) continue;
    const match = statement.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["`]?([a-zA-Z0-9_]+)["`]?/i);
    if (match && !tables.has(match[1])) tables.set(match[1], tag);
  }
}

// Pass 1b — tables dropped later in the migration set no longer exist in any
// fully-migrated database (e.g. custom_tabs, created in 0000_init and dropped
// by 0043_drop_custom_fields_and_tabs.sql); exclude them from the audit set.
for (const { content } of sqlFiles) {
  for (const m of content.matchAll(/DROP TABLE\s+(?:IF EXISTS\s+)?["`]?([a-zA-Z0-9_]+)["`]?/gi)) {
    tables.delete(m[1]);
  }
}

// Pass 2 — every RLS statement in the whole migration set.
const enabled = new Set();
const forced = new Set();
for (const { content } of sqlFiles) {
  for (const m of content.matchAll(/ALTER TABLE\s+(?:ONLY\s+)?["`]?([a-zA-Z0-9_]+)["`]?\s+ENABLE ROW LEVEL SECURITY/gi)) {
    enabled.add(m[1]);
  }
  for (const m of content.matchAll(/ALTER TABLE\s+(?:ONLY\s+)?["`]?([a-zA-Z0-9_]+)["`]?\s+FORCE ROW LEVEL SECURITY/gi)) {
    forced.add(m[1]);
  }
}

// Pass 3 — dynamic DO-block RLS: FOREACH tbl IN ARRAY ARRAY[...] LOOP with
// EXECUTE format(... ENABLE/FORCE ROW LEVEL SECURITY, tbl). The literal regex
// above cannot see these; without this pass tables hardened via dynamic DDL
// (0093_finance_accounting_complete.sql) are reported as uncovered.
for (const { content } of sqlFiles) {
  for (const block of content.matchAll(/FOREACH\s+\w+\s+IN\s+ARRAY\s+ARRAY\s*\[([\s\S]*?)\]\s*LOOP([\s\S]*?)END\s+LOOP/gi)) {
    const names = [...block[1].matchAll(/[\x27"`]([a-zA-Z0-9_]+)[\x27"`]/g)].map((m) => m[1]);
    if (/ENABLE ROW LEVEL SECURITY/i.test(block[2])) names.forEach((n) => enabled.add(n));
    if (/FORCE ROW LEVEL SECURITY/i.test(block[2])) names.forEach((n) => forced.add(n));
  }
}

const noEnable = [];
const noForce = [];
for (const [table, tag] of tables) {
  if (!enabled.has(table)) noEnable.push(`${table} (created in ${tag})`);
  else if (!forced.has(table)) noForce.push(table);
}

if (noEnable.length) {
  console.error(`✗ ${noEnable.length} tenant table(s) never get ENABLE ROW LEVEL SECURITY:`);
  for (const row of noEnable.slice(0, 15)) console.error(`    ${row}`);
  if (noEnable.length > 15) console.error(`    … and ${noEnable.length - 15} more`);
  missing++;
}

if (noForce.length) {
  const strict = process.env.MMS_RLS_STRICT === "1";
  const log = strict ? console.error : console.warn;
  log(`⚠️  ${noForce.length}/${tables.size} tenant table(s) lack FORCE ROW LEVEL SECURITY (table owner bypasses RLS):`);
  for (const table of noForce.slice(0, 10)) console.log(`    ${table}`);
  if (noForce.length > 10) console.log(`    … and ${noForce.length - 10} more`);
  if (strict) missing++;
}

console.log(`  audited ${tables.size} tenant table(s) across ${sqlFiles.length} migration(s)`);
if (missing > 0) process.exit(1);
' || FAILED=1

echo "• Migration index lock safety ratchet…"
node scripts/check-migration-indexes.mjs || FAILED=1

if [[ "$FAILED" -ne 0 ]]; then
  echo "❌ Migration checks FAILED."
  exit 1
fi
echo "✅ Migrations, RLS coverage and lock safety verified."
