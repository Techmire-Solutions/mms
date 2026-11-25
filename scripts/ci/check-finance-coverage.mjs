#!/usr/bin/env node
/**
 * Finance/Accounting integration coverage ratchet.
 *
 * The DB integration suite is excluded from the unit coverage gate; this script
 * enforces a scoped floor for the finance/accounting storage, use-case and route
 * slice. Floors are the measured baseline minus a two-point margin and may only be
 * raised (re-measure with `pnpm --filter mms-api run test:db:coverage:finance`).
 *
 * Usage: node scripts/ci/check-finance-coverage.mjs --coverage apps/api/coverage-finance-db
 */
import fs from "node:fs";
import path from "node:path";

const FLOORS = { statements: 40, functions: 46, branches: 36 };
// Re-baseline (2026-11): measured app-only 48/54/36; the accounting extraction moved
// repository/routes/ledger posting into @mms/mod-accounting, and the merged app+module
// scope measures 42.84/48.92/36.41. Statements and functions were re-baselined to the
// measured value minus the two-point margin; branches still clear their floor.

function argValues(flag) {
  const values = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === flag && process.argv[i + 1]) values.push(process.argv[i + 1]);
  }
  return values;
}

function isFinanceFile(file) {
  const normalized = file.replaceAll("\\", "/");
  if (normalized.includes("__tests__")) return false;
  return (
    normalized.includes("src/finance/") ||
    normalized.includes("src/accounting/") ||
    normalized.includes("src/db/repositories/finance") ||
    normalized.includes("src/db/repositories/accounting") ||
    normalized.includes("src/routes/tenant/finance") ||
    normalized.includes("src/routes/tenant/accounting") ||
    normalized.includes("packages/modules/billing/src/backend/") ||
    normalized.includes("packages/modules/accounting/src/backend/")
  );
}

function mergeCoverageEntry(target, next) {
  if (!target) return next;
  for (const [k, count] of Object.entries(next.s ?? {})) {
    target.s[k] = Number(target.s[k] ?? 0) + Number(count);
  }
  for (const [k, count] of Object.entries(next.f ?? {})) {
    target.f[k] = Number(target.f[k] ?? 0) + Number(count);
  }
  for (const [k, counts] of Object.entries(next.b ?? {})) {
    target.b[k] = (target.b[k] ?? []).map((prev, idx) => Number(prev) + Number(counts[idx] ?? 0));
  }
  return target;
}

const coverageDirs = argValues("--coverage");
const dirs = coverageDirs.length > 0 ? coverageDirs : ["apps/api/coverage-finance-db"];

const data = {};
for (const coverageDir of dirs) {
  const jsonPath = path.join(coverageDir, "coverage-final.json");
  if (!fs.existsSync(jsonPath)) {
    console.error(`✗ Finance coverage report not found: ${jsonPath}`);
    process.exit(1);
  }
  const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  for (const [file, entry] of Object.entries(parsed)) {
    data[file] = mergeCoverageEntry(data[file], entry);
  }
  console.log(`merged coverage report: ${jsonPath}`);
}
let statements = 0;
let statementsHit = 0;
let functions = 0;
let functionsHit = 0;
let branches = 0;
let branchesHit = 0;

for (const [file, entry] of Object.entries(data)) {
  if (!isFinanceFile(file)) continue;
  for (const count of Object.values(entry.s ?? {})) {
    statements += 1;
    if (Number(count) > 0) statementsHit += 1;
  }
  for (const count of Object.values(entry.f ?? {})) {
    functions += 1;
    if (Number(count) > 0) functionsHit += 1;
  }
  for (const counts of Object.values(entry.b ?? {})) {
    for (const count of counts) {
      branches += 1;
      if (Number(count) > 0) branchesHit += 1;
    }
  }
}

if (statements === 0 && functions === 0 && branches === 0) {
  console.error("✗ No finance/accounting files matched any coverage report.");
  process.exit(1);
}

const pct = (hit, total) => (total === 0 ? 100 : (100 * hit) / total);
const actual = {
  statements: pct(statementsHit, statements),
  functions: pct(functionsHit, functions),
  branches: pct(branchesHit, branches),
};
const below = [];
for (const [metric, floor] of Object.entries(FLOORS)) {
  const value = actual[metric];
  console.log(`${metric}: ${value.toFixed(2)}% (floor ${floor}%)`);
  if (value < floor) below.push(`${metric} ${value.toFixed(2)}% < ${floor}%`);
}
if (below.length > 0) {
  console.error(
    `\n✗ Finance coverage regressed below the ratchet floors:\n  ${below.join("\n  ")}`,
  );
  process.exit(1);
}
console.log("✅ Finance/accounting integration coverage ratchet held.");
