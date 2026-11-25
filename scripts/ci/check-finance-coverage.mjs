#!/usr/bin/env node
/**
 * Finance/Accounting integration coverage ratchet.
 *
 * The DB integration suite is excluded from the unit coverage gate; this script
 * enforces a scoped floor for the finance/accounting storage, use-case and route
 * slice. Floors are the measured baseline minus a two-point margin and may only be
 * raised (re-measure with `pnpm --filter mms-backend run test:db:coverage:finance` and
 * `pnpm --filter @mms/mod-accounting run test:db:coverage:finance`).
 *
 * The slice spans the backend app and `@mms/mod-accounting` (the extraction moved the
 * accounting repository/routes/ledger posting there), so every report passed with
 * `--coverage` is merged before the floors are checked.
 *
 * Usage: node scripts/ci/check-finance-coverage.mjs \
 *   --coverage apps/backend/coverage-finance-db \
 *   --coverage packages/modules/accounting/coverage-finance-db
 */
import fs from "node:fs";
import path from "node:path";

const FLOORS = { statements: 48, functions: 54, branches: 36 };

function argValues(flag) {
  const values = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === flag && process.argv[i + 1]) values.push(process.argv[i + 1]);
  }
  return values;
}

function isFinanceFile(file) {
  return (
    file.includes("src/finance/") ||
    file.includes("src/accounting/") ||
    file.includes("src/db/repositories/finance") ||
    file.includes("src/db/repositories/accounting") ||
    file.includes("src/routes/tenant/finance") ||
    file.includes("src/routes/tenant/accounting") ||
    file.includes("packages/modules/accounting/src/backend/")
  );
}

const coverageDirs = argValues("--coverage");
const dirs = coverageDirs.length > 0 ? coverageDirs : ["apps/backend/coverage-finance-db"];

const data = {};
for (const coverageDir of dirs) {
  const jsonPath = path.join(coverageDir, "coverage-final.json");
  if (!fs.existsSync(jsonPath)) {
    console.error(`✗ Finance coverage report not found: ${jsonPath}`);
    process.exit(1);
  }
  Object.assign(data, JSON.parse(fs.readFileSync(jsonPath, "utf8")));
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
for (const [metric, floor] of Object.entries(FLOORS)) {
  const value = actual[metric];
  console.log(`${metric}: ${value.toFixed(2)}% (floor ${floor}%)`);
  if (value < floor) {
    console.error(`\n✗ Finance ${metric} coverage regressed below the ratchet floor (${floor}%).`);
    process.exit(1);
  }
}
console.log("✅ Finance/accounting integration coverage ratchet held.");
