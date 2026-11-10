#!/usr/bin/env node
/**
 * Attendance integration coverage ratchet.
 *
 * The DB integration suite is excluded from the unit coverage gate, so this script enforces a scoped
 * floor for the attendance use-case/repository/route slice — the same protection Sessions and
 * Enrollments already have. Floors start deliberately low (they catch a collapse, not a two-point
 * drift): run with `--update` after a green DB run to print the measured values and raise them.
 *
 * Usage:
 *   node scripts/ci/check-attendance-coverage.mjs --coverage apps/backend/coverage-attendance-db
 *   node scripts/ci/check-attendance-coverage.mjs --coverage apps/backend/coverage-attendance-db --update
 */
import fs from "node:fs";
import path from "node:path";

const FLOORS = { statements: 10, functions: 10, branches: 5 };

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const coverageDir = argValue("--coverage") ?? "apps/backend/coverage-attendance-db";
const update = process.argv.includes("--update");
const jsonPath = path.join(coverageDir, "coverage-final.json");
if (!fs.existsSync(jsonPath)) {
  console.error(`✗ Attendance coverage report not found: ${jsonPath}`);
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
  if (
    !file.includes("src/attendance/") &&
    !file.includes("src/db/repositories/attendance") &&
    !file.includes("src/routes/tenant/attendance/")
  ) {
    continue;
  }
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

if (files === 0) {
  console.error(
    "✗ Attendance coverage report contains no attendance files — check the include globs.",
  );
  process.exit(1);
}

if (update) {
  console.log(JSON.stringify({ files, ...actual }, null, 2));
  process.exit(0);
}

for (const [metric, floor] of Object.entries(FLOORS)) {
  const value = actual[metric];
  console.log(`${metric}: ${value.toFixed(2)}% (floor ${floor}%)`);
  if (value < floor) {
    console.error(
      `\n✗ Attendance ${metric} coverage regressed below the ratchet floor (${floor}%).`,
    );
    process.exit(1);
  }
}
console.log(`✅ Attendance integration coverage ratchet held (${files} files).`);
