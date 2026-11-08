#!/usr/bin/env node
/**
 * Repeats the enrollment concurrency DB suite to make races (or flaky locks) fail CI instead of
 * passing on a lucky schedule. Requires DATABASE_URL like `test:db`.
 */
import { spawnSync } from "node:child_process";

const RUNS = Number(process.env.CONCURRENCY_RUNS ?? 5);
const file = "src/__tests__/db-integration/enrollmentConcurrencyDb.integration.test.ts";

for (let run = 1; run <= RUNS; run += 1) {
  const result = spawnSync(
    "pnpm",
    ["exec", "vitest", "run", "--config", "vitest.db.config.ts", file],
    { stdio: "inherit", cwd: process.cwd(), env: process.env },
  );
  if (result.status !== 0) {
    console.error(`✗ Concurrency suite failed on run ${run}/${RUNS}`);
    process.exit(result.status ?? 1);
  }
}
console.log(`✅ Concurrency suite passed ${RUNS}/${RUNS} runs.`);
