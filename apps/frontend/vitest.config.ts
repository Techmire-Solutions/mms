import path from "node:path";
import { defineConfig } from "vitest/config";
import { DurationShardSequencer } from "./src/test/shardSequencer.ts";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@shared/ui": path.resolve(import.meta.dirname, "../../packages/ui/src"),
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
    // Disable it so happy-dom's window.localStorage is installed.
    execArgv: ["--no-experimental-webstorage"],
    include: [
      "src/**/*.test.{ts,tsx}",
      "src/**/*.spec.{ts,tsx}",
      "../../packages/ui/src/**/*.test.{ts,tsx}",
    ],
    // Pre-bundle the heaviest imports into single files. Isolated test files each
    // re-evaluate their whole module graph; @mms/shared alone is ~500 dist modules
    // (~5–7s per test file on Windows) and drops to ~1s once bundled. `force`
    // re-bundles once per run: Vite's cache key ignores linked workspace builds,
    // so a cached bundle would serve a stale @mms/shared after a rebuild.
    // recharts stays out: tests replace it with factory `vi.mock('recharts')`
    // stubs, and the pre-bundled interop reads a `default` export they lack.
    deps: {
      optimizer: {
        client: {
          enabled: true,
          include: ["@mms/shared", "framer-motion", "lucide-react", "react-day-picker"],
          force: true,
        },
      },
    },
    // CI `--shard` splits by recorded per-file time (src/test/shard-timings.json).
    sequence: { sequencer: DurationShardSequencer },
    pool: "threads",
    maxWorkers: process.env.CI ? 4 : undefined,
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
      // Without `include`, Vitest only instruments files a test loaded, so ~25% of
      // `src` never entered the denominator (2,104 of 2,820 files) and the old
      // floors described that subset, not the app. Include the whole tree; test
      // files and `src/test/**` stay excluded.
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}", "src/test/**", "**/*.d.ts"],
      // Re-baselined 2026-10-30 over the whole source tree (2,823 files):
      // lines 42.41 / statements 41.48 / functions 34.58 / branches 40.95.
      // The previous 56/55/46/51 floors covered only the 2,104 files a test had
      // loaded; these are the same gate with the missing ~25% counted.
      thresholds: {
        lines: 42,
        statements: 41,
        functions: 34,
        branches: 40,
      },
    },
  },
});
