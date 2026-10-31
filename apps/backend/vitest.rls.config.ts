import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * RLS enforcement suite. Runs only against a database whose role is NOT a
 * superuser / BYPASSRLS role — the test itself fails loudly otherwise, because a
 * green run under `postgres` would prove nothing about tenant isolation.
 *
 * CI: `test-backend-rls` provisions `mms_app`, migrates as it, then runs this
 * config with `MMS_DB_ROLE_ENFORCEMENT=strict`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      JWT_SECRET: "test-secret-at-least-32-chars-long!!",
    },
    include: ["src/__tests__/rls/**/*.{test,spec}.ts"],
    pool: "threads",
    isolate: false,
    maxWorkers: 1,
    fileParallelism: false,
    clearMocks: true,
    restoreMocks: true,
    execArgv: ["--no-experimental-webstorage"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
