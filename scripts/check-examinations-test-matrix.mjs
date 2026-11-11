#!/usr/bin/env node
/**
 * Examinations test-matrix ratchet.
 *
 * Fails when a required invariant loses its pinning spec (renamed `it()`, deleted suite, or a
 * refactor that silently drops a scenario). The matrix itself lives in
 * docs/examinations-test-matrix.md; this script enforces the rows that exist today.
 */
import { readFileSync } from "node:fs";

const REQUIRED = [
  {
    file: "packages/shared/src/examinations/resultScoring.test.ts",
    names: ["grade bands (boundary sweep)", "rounds percentages to two decimals only for display"],
  },
  {
    file: "apps/backend/src/__tests__/examinations.integration.test.ts",
    names: [
      "asks for published-only marks for a read-only audience",
      "different workspace than the request host",
      "returns the always-on analytics slice",
      "POST /api/examinations/widget-aggregates returns SQL-backed widget results",
      "POST /api/examinations/exams/bulk-delete forwards ids and reports the result",
      "PUT /api/examinations/exams/bulk saves through the contract path",
      "maps a locked (published) write to 409",
    ],
  },
  {
    file: "apps/backend/src/__tests__/db-integration/examinationIntegrityDb.integration.test.ts",
    names: ["serialises two simultaneous writes carrying the same token"],
  },
  {
    file: "apps/backend/src/__tests__/db-integration/examinationSubsystemsDb.integration.test.ts",
    names: [
      "hides unpublished marks from read-only audiences",
      "report analytics (real Postgres)",
      "drops the student from the roster but keeps their marks",
    ],
  },
  {
    file: "apps/backend/src/__tests__/rls/examinationsTenantIsolation.db.integration.test.ts",
    names: ["FORCE row level security", "cross-tenant mark cannot be inserted"],
  },
];

let missing = 0;
for (const { file, names } of REQUIRED) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    console.error(`✗ required examinations spec is missing: ${file}`);
    missing += 1;
    continue;
  }
  for (const name of names) {
    if (!source.includes(name)) {
      console.error(`✗ ${file} is missing the required scenario: "${name}"`);
      missing += 1;
    }
  }
}

if (missing > 0) {
  console.error(`💥 ${missing} examinations test-matrix requirement(s) missing.`);
  process.exit(1);
}
console.log(
  `✓ Examinations test matrix: ${REQUIRED.reduce((total, row) => total + row.names.length, 0)} required scenarios present.`,
);
