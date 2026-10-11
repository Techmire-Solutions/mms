#!/usr/bin/env node
/**
 * Ratchet against plain `CREATE INDEX` on large, hot tables.
 *
 * Why this exists
 * ---------------
 * A plain `CREATE INDEX` locks the table against writes for the whole build. On
 * a small or new table that is irrelevant; on `contacts`, `students`,
 * `message_logs`, or `audit_trail_events` once they hold real data it is a write
 * outage for the duration.
 *
 * `CREATE INDEX CONCURRENTLY` is the fix, but it **cannot be expressed in a
 * migration file**: Drizzle's migrator wraps every statement of a migration run
 * in a single transaction (`PgDialect.migrate` → `session.transaction(...)`), and
 * PostgreSQL rejects `CONCURRENTLY` inside a transaction block. It has to be run
 * out of band — `pnpm --filter mms-backend index:concurrent`.
 *
 * So the policy is a ratchet rather than a prohibition: the 164 indexes that
 * already exist stay as they are, and no NEW plain index may be added to a large
 * table. If this fails, either use the out-of-band script, or raise BASELINE
 * deliberately with a note explaining why the lock is acceptable.
 *
 * Usage:
 *   node scripts/check-migration-indexes.mjs [--json]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(rootDir, "apps", "backend", "src", "db", "migrations_drizzle");

/**
 * Tables where a write-blocking index build is unacceptable once populated.
 * Ordered by observed index count, so the list reads as a priority order.
 */
const LARGE_TABLES = [
  "contacts",
  "students",
  "message_logs",
  "enrollments",
  "finance_invoices",
  "finance_payments",
  "obligation_collections",
  "obligation_distributions",
  "sessions",
  "tenant_users",
  "user_activity_logs",
  "audit_trail_events",
];

/** Measured 2026-10-08. Baseline raised to 174 for migration 0165: empty-string hardened unique indexes for gr_number/student_id, functional status coalesce index, and partial contact index on soft-deleted students for re-registration. */
const BASELINE = 174;

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(migrationsDir)) {
  fail(`Migrations directory not found: ${path.relative(rootDir, migrationsDir)}`);
}

const files = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const perTable = {};
const offenders = [];

for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  // Multi-line statements: match a whole CREATE INDEX ... ; run.
  const statements = sql.match(/CREATE\s+(?:UNIQUE\s+)?INDEX[^;]*;/gis) ?? [];
  for (const statement of statements) {
    if (/CONCURRENTLY/i.test(statement)) continue;
    const match = /ON\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?([A-Za-z_0-9]+)["']?/i.exec(statement);
    if (!match) continue;
    const table = match[1].toLowerCase();
    if (!LARGE_TABLES.includes(table)) continue;
    perTable[table] = (perTable[table] ?? 0) + 1;
    offenders.push({ file, table });
  }
}

const total = offenders.length;
const sortedTables = Object.fromEntries(Object.entries(perTable).sort((a, b) => b[1] - a[1]));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ total, baseline: BASELINE, perTable: sortedTables }, null, 2));
  process.exit(0);
}

console.log("Large-table index build safety");
console.log(`  plain CREATE INDEX on large tables: ${total} (baseline ${BASELINE})`);
for (const [table, count] of Object.entries(sortedTables)) {
  console.log(`    ${String(count).padStart(3)}  ${table}`);
}

if (total > BASELINE) {
  const added = total - BASELINE;
  const recent = offenders.slice(-added).map((o) => `${o.file} → ${o.table}`);
  fail(
    `${added} new plain CREATE INDEX statement(s) on large tables:\n  - ${recent.join("\n  - ")}\n\n` +
      "CREATE INDEX CONCURRENTLY cannot be used in a migration (Drizzle runs every\n" +
      "migration in one transaction). Create the index out of band instead:\n\n" +
      "  pnpm --filter mms-backend index:concurrent \\\n" +
      "    --table <table> --columns <col1,col2> --name <index_name>\n\n" +
      "or raise BASELINE in scripts/check-migration-indexes.mjs with a justification.",
  );
}

if (total < BASELINE) {
  console.log(
    `\n✓ ${BASELINE - total} fewer than baseline — lower BASELINE in ` +
      "scripts/check-migration-indexes.mjs to lock in the improvement.",
  );
} else {
  console.log("\n✓ No new write-blocking index builds on large tables.");
}
