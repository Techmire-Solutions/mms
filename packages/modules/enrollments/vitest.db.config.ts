import path from "node:path";
import { defineConfig } from "vitest/config";
import { buildModuleSourceAliases } from "../../../apps/api/src/__tests__/moduleSourceAliases.js";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

/**
 * Real-Postgres integration suites for the enrollments module.
 *
 * Run explicitly when a database is available:
 *   pnpm --filter @mms/mod-enrollments run test:db
 *
 * These suites share one database and open long-lived transactions, so they run
 * serially — a leaked trigger or an uncommitted `FOR UPDATE` from one file must not
 * deadlock the next (the same single-worker posture as apps/api/vitest.db.config.ts).
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(repoRoot, "apps/api/src") },
      ...buildModuleSourceAliases(repoRoot),
    ],
  },
  test: {
    environment: "node",
    env: {
      NODE_ENV: "test",
      TZ: "UTC",
      LOG_LEVEL: "silent",
      JWT_SECRET: "test-secret-at-least-32-chars-long!!",
    },
    setupFiles: [path.resolve(repoRoot, "apps/api/src/__tests__/dbIntegrationSetup.ts")],
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
