import path from "node:path";
import { defineConfig } from "vitest/config";

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
      // Date-sensitive attendance/exam logic must not depend on the runner's timezone (a midnight
      // run in another zone used to change "today" mid-suite). Zone-specific behaviour is tested with
      // an explicit IANA zone instead.
      TZ: "UTC",
      LOG_LEVEL: "silent",
      JWT_SECRET: "test-secret-at-least-32-chars-long!!",
      PORT: "0",
      // Tests assert local-dev OTP/reset-code flows; opt in explicitly rather
      // than relying on the removed `NODE_ENV !== 'production'` check.
      MMS_LOG_DEV_CREDENTIALS: "true",
    },
    include: ["src/__tests__/**/*.{test,spec}.ts"],
    // Real-Postgres integration tests live in db-integration/ and rls/ and are
    // opt-in (run via test:db / test:rls when a database is available). They are
    // excluded from the default suite so the mocked unit suite stays green
    // without a database and their global pool lifecycle cannot interfere.
    exclude: ["src/__tests__/db-integration/**", "src/__tests__/rls/**"],
    // Pre-bundle @mms/contracts (~500 dist modules) and inline workspace packages so
    // `vi.mock()` intercepts imports into `@mms/mod-*`, `@mms/be-core`, and `@mms/db`
    // (including relative imports inside those workspace packages that resolve to the same file).
    server: {
      deps: {
        inline: [/^@mms\/mod-/, /^@mms\/be-core/, /^@mms\/db/],
      },
    },
    deps: {
      optimizer: {
        ssr: { enabled: true, include: ["@mms/contracts"], force: true },
      },
    },
    pool:
      (process.env.VITEST_POOL as "threads" | "forks") ??
      (process.platform === "darwin" && !process.env.CI ? "forks" : "threads"),
    isolate: true,
    maxWorkers: process.env.CI ? 4 : undefined,
    fileParallelism: true,
    clearMocks: true,
    restoreMocks: true,
    execArgv: ["--no-experimental-webstorage"],
    testTimeout: 15_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Whole-tree basis (the correction the frontend received on 2026-10-30): without
      // `include`, Vitest only instruments files a test happened to load, so untested
      // modules never entered the denominator.
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/db/migrations/**",
        "src/db/migrations_drizzle/**",
        "src/__tests__/**",
        "**/*.d.ts",
      ],
      // Coverage gate: lock in the current baseline so regressions fail CI.
      // Raise these as coverage improves — never lower one to unblock a change.
      // Measured 2026-10-30 over the whole tree (CI-equivalent: 4 shards + merged
      // report): stmts 43.06 / branches 33.96 / funcs 41.41 / lines 45.19. The floors
      // are the same gate re-based onto the whole tree, not a tolerance change.
      thresholds: {
        lines: 44,
        statements: 42,
        functions: 40,
        branches: 32,
      },
    },
  },
});
