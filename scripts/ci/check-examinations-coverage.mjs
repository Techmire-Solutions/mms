#!/usr/bin/env node
/**
 * Examinations backend coverage ratchet.
 *
 * Reads the json-summary produced by `test:db:coverage:examinations` and enforces the exam
 * module/repository/route floor. Floors may only be raised (baseline policy).
 *
 *   node scripts/ci/check-examinations-coverage.mjs --coverage apps/backend/coverage-examinations-db
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const coverageIndex = args.indexOf("--coverage");
const coverageDir =
  coverageIndex >= 0 ? args[coverageIndex + 1] : "apps/backend/coverage-examinations-db";
const summaryPath = path.join(process.cwd(), coverageDir, "coverage-summary.json");

if (!fs.existsSync(summaryPath)) {
  console.error(`✗ coverage summary not found: ${summaryPath}`);
  process.exit(1);
}
const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8")).total;
const floors = { lines: 60, statements: 58, functions: 60, branches: 45 };
const failures = [];
for (const [metric, floor] of Object.entries(floors)) {
  const pct = summary?.[metric]?.pct;
  if (typeof pct !== "number") {
    failures.push(`${metric}: missing`);
  } else if (pct < floor) {
    failures.push(`${metric}: ${pct}% < ${floor}%`);
  }
}
if (failures.length) {
  console.error("✗ Examinations coverage floors not met:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  `✅ Examinations coverage floors met (lines ${summary.lines.pct}%, functions ${summary.functions.pct}%, branches ${summary.branches.pct}%).`,
);
