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
      "rejects a marks body without marksObtained",
      "rejects moderation fields on a plain marks save",
      "rejects unknown query keys, invalid page sizes and unknown statuses",
      "rejects an overlong student id before the handler runs",
      "forwards the gate's structured details on a blocked marks save",
      "rejects an invalid exam date, passing marks above the total and a blank name",
      "forbids a guardian token on the marks list and the broadsheet export",
      "asks a reader's report aggregates to include only published marks",
      "serializes a publication rejection with its structured details",
      "GET .../eligibility returns the per-student view",
      "POST results-finalization publishes and serializes the stamp",
    ],
  },
  {
    file: "packages/shared/src/examinations/examinationsApiSchemas.test.ts",
    names: [
      "rejects an out-of-range page size, an unknown status and an unknown query key",
      "rejects an invalid calendar date",
      "rejects a blank name, non-positive totals and passing marks above the total",
    ],
  },
  {
    file: "apps/backend/src/__tests__/examEligibilityGate.test.ts",
    names: ["carries the blocked students and their decision evidence"],
  },
  {
    file: "apps/backend/src/__tests__/contractError.test.ts",
    names: [
      "preserves the structured details and violations a domain error carries",
      "maps a unique-violation constraint to 409 instead of a server fault",
    ],
  },
  {
    file: "apps/backend/src/__tests__/errorHandler.test.ts",
    names: ["keeps a domain error's type and structured details"],
  },
  {
    file: "apps/backend/src/__tests__/examWriteGuards.test.ts",
    names: [
      "rejects an illegal move with 409 illegal_exam_transition",
      "refuses to edit a trashed exam until it is restored",
      "rejects a published class-membership change but ignores its order",
      "allows a description-only note on a published exam",
      "requires an unlock before trashing published results",
    ],
  },
  {
    file: "apps/backend/src/__tests__/examLifecycleUseCases.test.ts",
    names: [
      "refuses to publish an exam that has not been sat yet",
      "refuses to unlock an archived exam",
      "turns a lost publication race into a conflict",
      "turns a lost unlock race into a conflict",
    ],
  },
  {
    file: "apps/backend/src/__tests__/examinationModerationDomain.test.ts",
    names: [
      "requires at least three characters",
      "rejects negative, non-finite and above-column values",
      "allows a score exactly at the total and rejects one above it",
    ],
  },
  {
    file: "apps/backend/src/__tests__/examinationsMarksTransfer.test.ts",
    names: [
      "runs the eligibility gate for the chunk and again for every fallback row",
      "exports only published marks and omits the moderation column for a non-grader",
      "refuses a non-grader export of an unpublished exam",
    ],
  },
  {
    file: "apps/backend/src/__tests__/db-integration/examinationIntegrityDb.integration.test.ts",
    names: [
      "serialises two simultaneous writes carrying the same token",
      "stamps restore provenance when an exam is brought back",
      "round-trips publication, the attendance gate and restore evidence",
      "round-trips grace marks and their attribution",
      "writes a publish once and refuses a second write",
      "rejects trashing or re-weighting a published exam",
      "returns the per-exam attendance gate",
      "keeps exams and marks when the session is archived",
      "refuses a bulk save on an archived exam",
      "audits exam creation and scoring-frame changes through the bulk save path",
      "refuses to publish once a cancel has moved the status",
      "refuses to unlock once an owning session is completed",
      "below a moderated effective score",
    ],
  },
  {
    file: "apps/backend/src/__tests__/db-integration/questionBankPersistenceDb.integration.test.ts",
    names: [
      "rejects a non-positive paper total and duration",
      "rejects negative question marks and a negative answer score",
      "cascades question links when a section is deleted",
      "refuses a question link whose section does not exist",
      "rejects a duplicate active result",
      "has the submitted-at index, the paper child indices and the tests class FK",
    ],
  },
  {
    file: "apps/backend/src/__tests__/db-integration/examinationSubsystemsDb.integration.test.ts",
    names: [
      "hides unpublished marks from read-only audiences",
      "report analytics (real Postgres)",
      "drops the student from the roster but keeps their marks",
      "returns one view per exam from a single seat-holding roster",
      "strictest non-zero session threshold",
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
