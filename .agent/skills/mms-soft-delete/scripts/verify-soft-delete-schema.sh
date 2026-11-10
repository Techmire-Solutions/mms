#!/usr/bin/env bash
set -euo pipefail

# MMS Soft-Delete System Schema & Index Auditor
echo "🔍 Auditing Soft-Delete System Schemas & Indexes..."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT_DIR"

# 1. Run the migration index ratchet
echo "• Checking migration index lock safety..."
node scripts/check-migration-indexes.mjs

# 2. Check for softDeleteColumns mixin or deleted_at in primary tenant schemas
echo "• Verifying soft-delete column definitions in schema..."
node -e '
const fs = require("node:fs");
const path = require("node:path");

const schemaDir = path.resolve("apps/backend/src/db/schema");
const files = fs.readdirSync(schemaDir).filter(f => f.endsWith(".ts"));

let issues = 0;
/**
 * Files that actually declare soft-deletable tenant tables.
 *
 * They must be table modules, not barrels: `contacts.ts`, `sessions.ts`, `examinations.ts` and
 * `financeInvoices.ts` (the old list) contain no `pgTable()` at all, so the check reported false
 * failures for the barrels and silently skipped the file that did not exist — which is how
 * `attendance.ts` drifted three soft-delete columns behind its own database for four releases.
 */
const tenantEntityFiles = [
  "students.ts",
  "contactCoreTables.ts",
  "sessionCoreTables.ts",
  "sessionSections.ts",
  "enrollments.ts",
  "finance.ts",
  "attendance.ts",
  "faculty.ts",
  // `hasanat.ts` is a barrel since the 0230-era split; the entity module declares the table.
  "hasanatDistributions.ts",
  "examinationExamTables.ts",
];

for (const file of tenantEntityFiles) {
  const filePath = path.join(schemaDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`✗ Expected schema file ${file} is missing`);
    issues++;
    continue;
  }
  const content = fs.readFileSync(filePath, "utf8");
  if (!content.includes("pgTable(")) {
    console.error(`✗ ${file} declares no pgTable() — the soft-delete audit list points at a barrel`);
    issues++;
    continue;
  }

  const hasDeletedAt = content.includes("deletedAt") || content.includes("deleted_at") || content.includes("softDeleteColumns");
  if (!hasDeletedAt) {
    console.error(`✗ Table schema ${file} is missing soft-delete columns (deletedAt/softDeleteColumns)`);
    issues++;
  }

  const hasCategoryBIndex = content.includes("deletedAt") && (content.includes("is null") || content.includes("isNull"));
  if (!hasCategoryBIndex && hasDeletedAt) {
    console.warn(`⚠️ Table schema ${file} defines deletedAt but might lack Category B partial index (WHERE deleted_at IS NULL)`);
  }
}

if (issues > 0) {
  process.exit(1);
}
console.log("  All target tenant entity schemas contain required soft-delete definitions.");
'

echo "✅ Soft-delete schema audit passed successfully!"
