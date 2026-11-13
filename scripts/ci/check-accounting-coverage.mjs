#!/usr/bin/env node
/**
 * Accounting-only integration coverage ratchet.
 *
 * `check-finance-coverage.mjs` guards the combined finance+accounting slice, so a
 * large finance test set can mask an accounting regression. This runner measures
 * the accounting files only from the same coverage report
 * (`test:db:coverage:finance` already instruments `src/accounting/**`,
 * `src/db/repositories/accounting*` and the accounting routes), with floors set to
 * the measured baseline minus a two-point margin. Floors may only be raised.
 *
 * Usage:
 *   node scripts/ci/check-accounting-coverage.mjs --coverage apps/backend/coverage-finance-db
 *   node scripts/ci/check-accounting-coverage.mjs --coverage apps/backend/coverage-finance-db --update
 */
import fs from "node:fs";
import path from "node:path";

const FLOORS = { statements: 56, functions: 63, branches: 44 };

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function isAccountingFile(file) {
  const normalized = file.replaceAll("\\", "/");
  return (
    normalized.includes("src/accounting/") ||
    normalized.includes("src/db/repositories/accounting") ||
    normalized.includes("src/routes/tenant/accounting")
  );
}

const coverageDir = argValue("--coverage") ?? "apps/backend/coverage-finance-db";
const update = process.argv.includes("--update");
const jsonPath = path.join(coverageDir, "coverage-final.json");
if (!fs.existsSync(jsonPath)) {
  console.error(`✗ Accounting coverage report not found: ${jsonPath}`);
  console.error("Run: pnpm --filter mms-backend run test:db:coverage:finance");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
let statements = 0;
let statementsHit = 0;
let functions = 0;
let functionsHit = 0;
let branches = 0;
let branchesHit = 0;
let files = 0;

for (const [file, entry] of Object.entries(data)) {
  if (!isAccountingFile(file)) continue;
  files += 1;
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

const pct = (hit, total) => (total === 0 ? 100 : (100 * hit) / total);
const actual = {
  statements: pct(statementsHit, statements),
  functions: pct(functionsHit, functions),
  branches: pct(branchesHit, branches),
};

if (update) {
  console.log(JSON.stringify(actual, null, 2));
  process.exit(0);
}

if (files === 0) {
  console.error("✗ No accounting files in the coverage report — the include globs drifted.");
  process.exit(1);
}

let failed = false;
for (const [metric, floor] of Object.entries(FLOORS)) {
  const value = actual[metric];
  console.log(`${metric}: ${value.toFixed(2)}% (floor ${floor}%)`);
  if (value < floor) {
    console.error(`✗ Accounting ${metric} coverage regressed below the floor (${floor}%).`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log(`✅ Accounting integration coverage ratchet held (${files} files).`);
