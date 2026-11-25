#!/usr/bin/env node
/**
 * Repeats the concurrency DB suites to make races (or flaky locks) fail CI instead of passing on a
 * lucky schedule. Requires DATABASE_URL like `test:db`.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const RUNS = Number(process.env.CONCURRENCY_RUNS ?? 5);

/** Suites executed under apps/api/vitest.db.config.ts (app + composition-root module suites). */
const APP_FILES = [
  "../../packages/modules/enrollments/src/backend/__tests__/db-integration/enrollmentConcurrencyDb.integration.test.ts",
  // Two staff marking one roster in different orders used to deadlock on the ON CONFLICT locks.
  "src/__tests__/db-integration/attendanceConcurrencyDb.integration.test.ts",
  // Double redeem/void, idempotent issue, OCC, stock and quota races behind the Hasanat cards.
  "../../packages/modules/hasanat/src/backend/__tests__/db-integration/hasanatConcurrencyDb.integration.test.ts",
  // Exam OCC batches/moderation/publication: repeated so a lucky single run cannot hide a race.
  "src/__tests__/db-integration/examinationsConcurrencyDb.integration.test.ts",
  // Workshop seat capacity: concurrent registration, duplicate submission, cap lowering, trash race.
  "src/__tests__/db-integration/workshopsCapacityConcurrencyDb.integration.test.ts",
  // Workshop waitlist: concurrent fills, promotions on withdrawal, capacity-raise promotion order.
  "src/__tests__/db-integration/workshopsWaitlistDb.integration.test.ts",
  // Completion/certificate races: evaluate, issue, transition vs issue, attendance, cancel.
  "src/__tests__/db-integration/workshopsCompletionConcurrencyDb.integration.test.ts",
  // One-winner collection (late fee + reminder claim) and payment/invoice balance races.
  "../../packages/modules/billing/src/backend/__tests__/db-integration/financeCollectConcurrencyDb.integration.test.ts",
  "../../packages/modules/billing/src/backend/__tests__/db-integration/financePaymentConcurrencyDb.integration.test.ts",
];

/**
 * Accounting moved into `@mms/mod-accounting`; its concurrency suites run there with the module's
 * own db config. Keeping them in this repeat harness preserves the race coverage the extraction
 * would otherwise silently drop (the old app-relative paths matched no files).
 */
const ACCOUNTING_FILES = [
  // Concurrent postings, stale-save rejection, double reversal and transactional voucher
  // numbering (gap/duplicate refs are a financial defect).
  "src/backend/__tests__/db-integration/accountingConcurrencyDb.integration.test.ts",
  "src/backend/__tests__/db-integration/accountingVoucherCountersDb.integration.test.ts",
  // Parallel fiscal-year close: exactly one closing entry, one closed year, one audit row.
  "src/backend/__tests__/db-integration/accountingCloseConcurrencyDb.integration.test.ts",
  // Posting-period reopen racing a fiscal-year close: a reopen that loses must
  // never leave an open period inside a closed year.
  "src/backend/__tests__/db-integration/accountingPeriodReopenRaceDb.integration.test.ts",
  // Serialised FX revaluation and IAS 29 restatement runs (one per date).
  "src/backend/__tests__/db-integration/accountingFxRevaluationDb.integration.test.ts",
  "src/backend/__tests__/db-integration/accountingIas29Db.integration.test.ts",
];

const SUITES = [
  { dir: path.join(REPO_ROOT, "apps/api"), files: APP_FILES },
  { dir: path.join(REPO_ROOT, "packages/modules/accounting"), files: ACCOUNTING_FILES },
];

for (const suite of SUITES) {
  for (const file of suite.files) {
    for (let run = 1; run <= RUNS; run += 1) {
      const result = spawnSync(
        "pnpm",
        ["exec", "vitest", "run", "--config", "vitest.db.config.ts", file],
        { stdio: "inherit", cwd: suite.dir, env: process.env },
      );
      if (result.status !== 0) {
        console.error(`✗ Concurrency suite failed on run ${run}/${RUNS}: ${suite.dir}/${file}`);
        process.exit(result.status ?? 1);
      }
    }
  }
}
console.log(
  `✅ Concurrency suites passed ${RUNS}/${RUNS} runs each across ${SUITES.reduce((n, s) => n + s.files.length, 0)} files.`,
);
