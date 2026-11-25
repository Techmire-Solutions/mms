import path from "node:path";
import { defineConfig } from "vitest/config";
import { buildModuleSourceAliases } from "./src/__tests__/moduleSourceAliases.js";

const repoRoot = path.resolve(import.meta.dirname, "../..");

/**
 * Opt-in real-Postgres integration suite (src/__tests__/db-integration).
 * Run explicitly when a database is available:
 *   pnpm test:db
 * These tests are excluded from the default `vitest run` so the mocked unit suite
 * stays green without a database and their global pool lifecycle cannot interfere
 * with other tests.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(import.meta.dirname, "./src") },
      ...buildModuleSourceAliases(repoRoot),
    ],
  },
  test: {
    environment: "node",
    env: {
      NODE_ENV: "test",
      // Date-sensitive attendance/exam logic must not depend on the runner's timezone (a midnight
      // run in another zone used to change "today" mid-suite). Zone-specific behaviour is tested with
      // an explicit IANA zone instead.
      TZ: "UTC",
      LOG_LEVEL: "silent",
      JWT_SECRET: "test-secret-at-least-32-chars-long!!",
      PORT: "0",
      MMS_LOG_DEV_CREDENTIALS: "true",
    },
    setupFiles: ["./src/__tests__/dbIntegrationSetup.ts"],
    include: [
      "src/__tests__/db-integration/**/*.{test,spec}.ts",
      "../../packages/modules/sessions/src/backend/__tests__/db-integration/**/*.integration.test.ts",
      "../../packages/modules/enrollments/src/backend/__tests__/db-integration/**/*Db.integration.test.ts",
      "../../packages/modules/billing/src/backend/__tests__/db-integration/**/*.integration.test.ts",
      "../../packages/modules/contacts/src/backend/__tests__/db-integration/**/*.integration.test.ts",
      "../../packages/modules/faculty/src/backend/__tests__/db-integration/**/*.integration.test.ts",
      "../../packages/modules/hasanat/src/backend/__tests__/db-integration/**/*Db.integration.test.ts",
      "../../packages/modules/messaging/src/backend/__tests__/db-integration/**/*.integration.test.ts",
      "../../packages/modules/students/src/backend/__tests__/db-integration/**/*.integration.test.ts",
    ],
    pool: "threads",
    isolate: false,
    maxWorkers: 1,
    fileParallelism: false,
    clearMocks: true,
    restoreMocks: true,
    execArgv: ["--no-experimental-webstorage"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
