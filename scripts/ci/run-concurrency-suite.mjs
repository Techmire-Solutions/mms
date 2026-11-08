#!/usr/bin/env node
/**
 * Repeats the concurrency DB suites to make races (or flaky locks) fail CI instead of passing on a
 * lucky schedule. Requires DATABASE_URL like `test:db`.
 */
import { spawnSync } from "node:child_process";

const RUNS = Number(process.env.CONCURRENCY_RUNS ?? 5);
const FILES = [
  "src/__tests__/db-integration/enrollmentConcurrencyDb.integration.test.ts",
  // Two staff marking one roster in different orders used to deadlock on the ON CONFLICT locks.
  "src/__tests__/db-integration/attendanceConcurrencyDb.integration.test.ts",
];

for (const file of FILES) {
  for (let run = 1; run <= RUNS; run += 1) {
    const result = spawnSync(
      "pnpm",
      ["exec", "vitest", "run", "--config", "vitest.db.config.ts", file],
      { stdio: "inherit", cwd: process.cwd(), env: process.env },
    );
    if (result.status !== 0) {
      console.error(`✗ Concurrency suite failed on run ${run}/${RUNS}: ${file}`);
      process.exit(result.status ?? 1);
    }
  }
}
console.log(`✅ Concurrency suites passed ${RUNS}/${RUNS} runs each (${FILES.length} files).`);
