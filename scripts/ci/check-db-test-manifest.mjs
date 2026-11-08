#!/usr/bin/env node
/**
 * Enrollment DB test manifest ratchet.
 *
 * Counting cases from source keeps this dependency-free and makes an accidental deletion or
 * skip-as-comment visible. Counts may grow freely; they may only drop with a reviewed baseline
 * update (`--update`) in the same change.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "apps/backend/src/__tests__/db-integration");
const BASELINE = {
  "enrollmentConcurrencyDb.integration.test.ts": 6,
  "enrollmentIntegrityDb.integration.test.ts": 7,
  "enrollmentLifecycleDb.integration.test.ts": 3,
  "enrollmentLifecycleJourneyDb.integration.test.ts": 2,
  "enrollmentLifecycleRulesDb.integration.test.ts": 6,
  "enrollmentOperationsDb.integration.test.ts": 4,
  "enrollmentSsotDb.integration.test.ts": 2,
  "enrollmentsSubsystemsDb.integration.test.ts": 14,
  "registrationDb.integration.test.ts": 4,
};

const update = process.argv.includes("--update");
const counts = {};
for (const name of Object.keys(BASELINE)) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) {
    console.error(`✗ Missing required DB suite: ${name}`);
    process.exit(1);
  }
  const source = fs.readFileSync(file, "utf8");
  counts[name] = (source.match(/^\s{2}it\(/gm) ?? []).length;
}

if (update) {
  console.log(JSON.stringify(counts, null, 2));
  process.exit(0);
}

let failed = false;
for (const [name, floor] of Object.entries(BASELINE)) {
  const actual = counts[name];
  if (actual < floor) {
    console.error(
      `✗ ${name}: ${actual} cases (baseline ${floor}). A required enrollment test disappeared.`,
    );
    failed = true;
  }
}
if (failed) process.exit(1);
console.log(
  `✅ Enrollment DB test manifest held (${Object.values(counts).reduce((a, b) => a + b, 0)} cases).`,
);
