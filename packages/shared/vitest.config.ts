import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    pool: "threads",
    maxWorkers: 4,
    fileParallelism: true,
    clearMocks: true,
    restoreMocks: true,
    execArgv: ["--no-experimental-webstorage"],
    testTimeout: 10_000,
    env: {
      NODE_ENV: "test",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["src/**/*.{test,spec}.ts", "dist/**", "**/*.d.ts"],
      // Coverage gate: lock in the current baseline so regressions fail CI.
      // Raise these as coverage improves — never lower one to unblock a change.
      // Measured 2026-10-29 (after the money/fx edge-case pass):
      // stmts 76.86 / branches 58.63 / funcs 73.23 / lines 80.25.
      thresholds: {
        lines: 79,
        statements: 75,
        functions: 72,
        branches: 57,
      },
    },
  },
});
