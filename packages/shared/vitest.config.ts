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
      // Raise these as coverage improves. Measured: lines ~72.1 / stmts ~67.8 /
      // funcs ~60.4 / branches ~51.2.
      thresholds: {
        lines: 68,
        statements: 65,
        functions: 58,
        branches: 48,
      },
    },
  },
});
