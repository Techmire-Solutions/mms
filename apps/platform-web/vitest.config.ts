import path from "node:path";
import os from "node:os";
import { defineConfig } from "vitest/config";
import { DurationShardSequencer } from "./src/test/shardSequencer.ts";

/**
 * Platform console test harness.
 *
 * Mirrors `apps/tenant-web/vitest.config.ts` (same aliases, DOM environment, setup file and
 * shard sequencer) so the two consoles behave identically under Vitest. Without this file the
 * app ran with Vitest defaults — `node` environment, no `@` alias, no setup — which failed
 * every DOM test in the suite.
 *
 * Coverage: no thresholds yet. Tenant-web's floors describe its much larger tree; this app's
 * baseline must be measured before floors are set, otherwise CI fails on an invented number.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@mms/ui": path.resolve(import.meta.dirname, "../../packages/ui/src"),
      react: path.resolve(import.meta.dirname, "./node_modules/react"),
      "react-dom": path.resolve(import.meta.dirname, "./node_modules/react-dom"),
      clsx: path.resolve(import.meta.dirname, "./node_modules/clsx"),
      "tailwind-merge": path.resolve(import.meta.dirname, "./node_modules/tailwind-merge"),
      "class-variance-authority": path.resolve(
        import.meta.dirname,
        "./node_modules/class-variance-authority",
      ),
      "lucide-react": path.resolve(import.meta.dirname, "./node_modules/lucide-react"),
      "@radix-ui/react-slot": path.resolve(
        import.meta.dirname,
        "./node_modules/@radix-ui/react-slot",
      ),
      "@radix-ui/react-alert-dialog": path.resolve(
        import.meta.dirname,
        "./node_modules/@radix-ui/react-alert-dialog",
      ),
      "@radix-ui/react-checkbox": path.resolve(
        import.meta.dirname,
        "./node_modules/@radix-ui/react-checkbox",
      ),
      "@radix-ui/react-select": path.resolve(
        import.meta.dirname,
        "./node_modules/@radix-ui/react-select",
      ),
      "@radix-ui/react-switch": path.resolve(
        import.meta.dirname,
        "./node_modules/@radix-ui/react-switch",
      ),
      "@radix-ui/react-tooltip": path.resolve(
        import.meta.dirname,
        "./node_modules/@radix-ui/react-tooltip",
      ),
      "@radix-ui/react-popover": path.resolve(
        import.meta.dirname,
        "./node_modules/@radix-ui/react-popover",
      ),
      "@radix-ui/react-dropdown-menu": path.resolve(
        import.meta.dirname,
        "./node_modules/@radix-ui/react-dropdown-menu",
      ),
      "@radix-ui/react-avatar": path.resolve(
        import.meta.dirname,
        "./node_modules/@radix-ui/react-avatar",
      ),
      "@radix-ui/react-slider": path.resolve(
        import.meta.dirname,
        "./node_modules/@radix-ui/react-slider",
      ),
      "@radix-ui/react-label": path.resolve(
        import.meta.dirname,
        "./node_modules/@radix-ui/react-label",
      ),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    // Node 26 ships an experimental global `localStorage` getter that shadows
    // happy-dom's storage and resolves to `undefined` without --localstorage-file.
    execArgv: ["--no-experimental-webstorage"],
    include: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
    deps: {
      optimizer: {
        client: {
          enabled: true,
          include: ["@mms/contracts", "framer-motion", "lucide-react", "react-day-picker"],
          force: false,
        },
      },
    },
    // CI `--shard` splits by recorded per-file time (src/test/shard-timings.json).
    sequence: { sequencer: DurationShardSequencer },
    pool:
      (process.env.VITEST_POOL as "threads" | "forks") ??
      (process.platform === "darwin" && !process.env.CI ? "forks" : "threads"),
    maxWorkers: process.env.CI ? 4 : Math.min(4, os.availableParallelism?.() ?? 4),
    fileParallelism: true,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 15_000,
    hookTimeout: 30_000,
    css: false,
    env: {
      NODE_ENV: "test",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}", "src/test/**", "**/*.d.ts"],
    },
  },
});
