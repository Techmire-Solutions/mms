#!/usr/bin/env node
/**
 * Enrollments integration coverage ratchet.
 *
 * The DB suite is excluded from the unit coverage gate, so this enforces a scoped floor for the
 * enrollments storage/use-case/registration/routes slice. Floors are the measured baseline
 * (2026-11: statements 65.9 / functions 74.9 / branches 53.9) minus a two-point margin and may
 * only be raised.
 *
 * Usage: node scripts/ci/check-enrollment-coverage.mjs --coverage apps/backend/coverage-enrollments-db
 */
import fs from "node:fs";
import path from "node:path";

const FLOORS = { statements: 63, functions: 72, branches: 51 };

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const coverageDir = argValue("--coverage") ?? "apps/backend/coverage-enrollments-db";
const jsonPath = path.join(coverageDir, "coverage-final.json");
if (!fs.existsSync(jsonPath)) {
  console.error(`✗ Enrollments coverage report not found: ${jsonPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
let statements = 0;
let statementsHit = 0;
let functions = 0;
let functionsHit = 0;
let branches = 0;
let branchesHit = 0;

const inScope = (file) =>
  file.includes("src/enrollments/") ||
  file.includes("src/db/repositories/enrollment") ||
  file.includes("src/db/repositories/registration") ||
  file.includes("src/routes/tenant/enrollments/");

for (const [file, entry] of Object.entries(data)) {
  if (!inScope(file)) continue;
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
      if (count > 0) branchesHit += 1;
    }
  }
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
    console.error(
      `\n✗ Enrollments ${metric} coverage regressed below the ratchet floor (${floor}%).`,
    );
    process.exit(1);
  }
}
console.log("✅ Enrollments integration coverage ratchet held.");
