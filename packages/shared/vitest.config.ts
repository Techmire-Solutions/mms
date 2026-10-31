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
      // Whole-tree basis (the correction the frontend received on 2026-10-30): without
      // `include`, Vitest only instruments files a test happened to load, so untested
      // modules never entered the denominator.
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.{test,spec}.ts", "dist/**", "**/*.d.ts"],
      // Coverage gate: lock in the current baseline so regressions fail CI.
      // Raise these as coverage improves — never lower one to unblock a change.
      // Measured 2026-10-30 over the whole tree: stmts 74.96 / branches 56.17 /
      // funcs 71.89 / lines 78.24. The floors are the same gate re-based onto the
      // whole tree, not a tolerance change.
      thresholds: {
        lines: 77,
        statements: 74,
        functions: 71,
        branches: 55,
      },
    },
  },
});
