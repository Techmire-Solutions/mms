#!/usr/bin/env node
/**
 * Sessions integration coverage ratchet.
 *
 * The DB integration suite is intentionally excluded from the unit coverage gate, so this script
 * enforces a scoped floor for the Sessions storage/use-case/route slice. Floors are the measured
 * baseline minus a two-point margin and may only be raised (see run --ratchet to print values).
 *
 * Usage: node scripts/ci/check-session-coverage.mjs --coverage apps/api/coverage-sessions-db
 */
import fs from "node:fs";
import path from "node:path";

const FLOORS = { statements: 45, functions: 50, branches: 35 };

function argValues(flag) {
  const values = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === flag && process.argv[i + 1]) values.push(process.argv[i + 1]);
  }
  return values;
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
const dirs = coverageDirs.length > 0 ? coverageDirs : ["apps/api/coverage-sessions-db"];
const data = {};
for (const coverageDir of dirs) {
  const jsonPath = path.join(coverageDir, "coverage-final.json");
  if (!fs.existsSync(jsonPath)) {
    console.error(`✗ Sessions coverage report not found: ${jsonPath}`);
    process.exit(1);
  }
  const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  for (const [file, entry] of Object.entries(parsed)) {
    data[file] = mergeCoverageEntry(data[file], entry);
  }
}

let statements = 0;
let statementsHit = 0;
let functions = 0;
let functionsHit = 0;
let branches = 0;
let branchesHit = 0;

for (const [file, entry] of Object.entries(data)) {
  const normalized = file.replaceAll("\\", "/");
  if (normalized.includes("__tests__")) continue;
  if (
    !normalized.includes("src/sessions/") &&
    !normalized.includes("src/db/repositories/session") &&
    !normalized.includes("src/routes/tenant/sessions/") &&
    !normalized.includes("sessionLifecycleScheduler") &&
    !normalized.includes("packages/modules/sessions/src/backend/")
  )
    continue;
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
for (const [metric, floor] of Object.entries(FLOORS)) {
  const value = actual[metric];
  console.log(`${metric}: ${value.toFixed(2)}% (floor ${floor}%)`);
  if (value < floor) {
    console.error(`\n✗ Sessions ${metric} coverage regressed below the ratchet floor (${floor}%).`);
    process.exit(1);
  }
}
console.log("✅ Sessions integration coverage ratchet held.");
