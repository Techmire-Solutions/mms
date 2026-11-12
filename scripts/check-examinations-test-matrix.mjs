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
    names: [
      "grade bands (boundary sweep)",
      "rounds percentages to two decimals only for display",
      "passes exactly at the exam's pass mark",
      "clamps malformed and out-of-range inputs instead of producing NaN/Infinity",
      "handles an empty list and a missing tie-break without inventing order",
      "shares ranks for ties inside a class and overall (competition ranking)",
      "groups a null/unknown class under one bucket and handles an empty exam",
    ],
  },
  {
    file: "packages/shared/src/examinations/gradeUtils.test.ts",
    names: [
      "exports the same labels the bands use, highest first",
      "floors NaN and negative percentages to F and tops out at A+",
    ],
  },
  {
    file: "packages/shared/src/examinations/examLifecycle.test.ts",
    names: ["matches the transition table for every ordered status pair"],
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
      "refuses a teacher's exam definition save and allows the controller",
      "refuses a teacher's exams CSV import before any job is queued",
      "refuses a teacher's attendance-gate change and records the controller's reason",
      "refuses a marks import outside the teacher's staffed sections",
      "retries a failed marks import with the same payload instead of returning the dead job",
      "rejects a reused key whose stored rows belong to a different import",
      "rejects a finished key whose rows were discarded (unverifiable body)",
      "refuses a second live import for the same exam",
      "keys the broadsheet export on the marks fingerprint",
      "maps the background-job quota to 429",
      "refuses a teacher's bulk marks save for a section they do not staff",
      "denies a guardian every privileged exam action",
      "serves a reader no draft mark payload (published-only read is real hiding)",
      "rejects a cross-tenant token on exam mutations",
    ],
  },
  {
    file: "apps/backend/src/__tests__/sandboxShutdownAbort.test.ts",
    names: ["aborts the sandbox deadline when the child receives SIGTERM"],
  },
  {
    file: "apps/backend/src/__tests__/typstEngine.test.ts",
    names: [
      "fails loudly when the Typst CLI is unavailable (never a placeholder PDF)",
      "compiles with a private data file (no payload in argv) and bundled fonts",
      "resolves the document language from explicit options and from the payload script",
    ],
  },
  {
    file: "apps/frontend/src/tenant/features/examinations/lib/marksGridNavigation.test.ts",
    names: ["tabs forward/backward but lets Tab leave the grid at an edge"],
  },
  {
    file: "apps/frontend/src/tenant/features/examinations/lib/examFormValidation.test.ts",
    names: ["flags passing above total, non-positive totals and a blank duration immediately"],
  },
  {
    file: "apps/frontend/src/tenant/features/examinations/components/EnterMarksTable.test.tsx",
    names: ["moves focus down/up between student rows with ArrowDown/ArrowUp"],
  },
  {
    file: "apps/frontend/src/tenant/features/examinations/components/EnterMarks.test.tsx",
    names: ["keeps the draft when a background results refetch arrives while dirty"],
  },
  {
    file: "apps/frontend/src/tenant/features/examinations/components/useExaminationForm.test.ts",
    names: [
      "flags an invalid numeric frame live and becomes dirty only after an edit",
      "shows a save failure inline without losing the draft",
    ],
  },
  {
    file: "apps/backend/src/__tests__/examinationRepositoryAnalytics.test.ts",
    names: ["computes all four aggregates in one tenant-scoped statement"],
  },
  {
    file: "packages/shared/src/examinations/examinationsApiSchemas.test.ts",
    names: [
      "normalizes the unpaged and paginated envelopes without casting",
      "never defaults a missing mark to zero on the read/write boundary",
      "rejects an unknown finalization status",
      "rejects a grade bucket outside the shared letter scale",
      "accepts every advertised grading system and rejects unknown ones",
      "keeps the PUT body partial but strict",
    ],
  },
  {
    file: "apps/backend/src/__tests__/db-integration/examinationIntegrityDb.integration.test.ts",
    names: ["accepts every shared exam status at the DB boundary"],
  },
  {
    file: "apps/backend/src/__tests__/examinationsMarksTransfer.test.ts",
    names: [
      "neutralises formula-leading student names and roll numbers in the streamed broadsheet",
      "streams a page at a time until the marks run out",
      "stops a streamed export when the job is aborted",
    ],
  },
  {
    file: "apps/backend/src/__tests__/backgroundJobRetry.test.ts",
    names: ["resets the failed row and re-dispatches with the new payload"],
  },
  {
    file: "apps/backend/src/__tests__/backgroundJobsOwnership.test.ts",
    names: [
      "serves only a job the caller owns",
      "404s another user's job instead of serializing it",
      "refuses to upsert a job the caller does not own",
    ],
  },
  {
    file: "apps/backend/src/__tests__/db-integration/examinationsConcurrencyDb.integration.test.ts",
    names: [
      "saves disjoint batches concurrently without a deadlock",
      "serialises overlapping batches written in opposite orders without 40P01",
      "lets exactly one concurrent publication win the compare-and-set",
      "keeps a moderation racing a marks save coherent (one conflict, no mixed row)",
    ],
  },
  {
    file: "apps/backend/src/__tests__/db-integration/examinationSubsystemsDb.integration.test.ts",
    names: [
      "keeps marks when a student is archived, drops them from the roster, and restores",
      "pins the student hard-purge FK cascade (retention decision pending)",
      "hides an archived exam from analytics but keeps its marks for restore",
      "keeps marks when an enrollment is hard-purged (enrollment is not the mark owner)",
    ],
  },
  {
    file: "apps/backend/src/__tests__/rls/examinationsTenantIsolation.db.integration.test.ts",
    names: ["cross-tenant eligibility overrides cannot be read, updated or granted"],
  },
  {
    file: "e2e/tests/features/examinations-marks-entry.spec.ts",
    names: ["enters, validates and saves marks, then locks published results"],
  },
  {
    file: "apps/backend/src/__tests__/examMarksImportScope.test.ts",
    names: [
      "scopes the submitted rolls by their exact section on the exam date",
      "wraps a scope rejection in the import-specific 403",
      "falls back to the class-level rule for an undated exam",
      "ignores unknown and ambiguous rolls instead of widening scope",
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
      "reason-codes a pure status move as a status override",
      "reason-codes a mark entry and a later correction",
      "audits an attendance-gate change with its reason code and reason",
      "rejects a direct UPDATE or DELETE of an audit event",
      "keeps the audited purge escape for retention jobs",
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
      "rejects a duplicate option slot for one question (23505)",
      "refuses to edit or trash a question that a graded paper references",
      "guards a question that only a paper section references",
      "rejects a stale question save and skips an unchanged re-save (409 stale_write)",
      "stamps restore provenance when a question is brought back",
      "has the question-bank filter, reverse-lookup and citations-book indices",
      "rejects an invalid changed question with coded issues (400)",
      "preserves marks and tags the form does not send",
      "locks content edits on an approved question",
      "blocks a content edit once a paper is published",
      "moves a question through the lifecycle and refuses illegal jumps",
      "refuses to reopen a question a delivered paper references",
      "duplicates a question as a new draft revision",
      "snapshots the question set on publish and freezes composition",
      "refuses to publish an empty paper and to unpublish one with results",
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
    names: [
      "FORCE row level security",
      "cross-tenant mark cannot be inserted",
      "report analytics aggregate only the calling tenant's marks",
    ],
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
