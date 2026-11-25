import { defineConfig } from "vitest/config";

/**
 * Real-Postgres integration suites for the sessions module.
 *
 * Run explicitly when a database is available:
 *   pnpm --filter @mms/mod-sessions run test:db
 *
 * These suites share one database and open long-lived transactions, so they run
 * serially — a leaked trigger or an uncommitted `FOR UPDATE` from one file must not
 * deadlock the next (the same single-worker posture as apps/api/vitest.db.config.ts).
 */
export default defineConfig({
  test: {
    environment: "node",
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
    },
    include: ["src/backend/__tests__/db-integration/**/*.integration.test.ts"],
    pool: "threads",
    isolate: false,
    maxWorkers: 1,
    fileParallelism: false,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
