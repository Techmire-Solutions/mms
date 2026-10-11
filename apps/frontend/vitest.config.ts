import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { DurationShardSequencer } from './src/test/shardSequencer.ts';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    // Node 26 ships an experimental global `localStorage` getter that shadows
    // happy-dom's storage and resolves to `undefined` without --localstorage-file.
    // Disable it so happy-dom's window.localStorage is installed.
    execArgv: ['--no-experimental-webstorage'],
    include: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
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
          include: [
            '@mms/shared',
            'framer-motion',
            'lucide-react',
            'react-day-picker',
          ],
          force: true,
        },
      },
    },
    // CI `--shard` splits by recorded per-file time (src/test/shard-timings.json).
    sequence: { sequencer: DurationShardSequencer },
    pool: 'threads',
    maxWorkers: process.env.CI ? 4 : undefined,
    fileParallelism: true,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 15_000,
    hookTimeout: 30_000,
    css: false,
    env: {
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test/**',
        '**/*.d.ts',
      ],
      // Coverage gate: lock in the current baseline so regressions fail CI.
      // Raise these as coverage improves. Measured (whole src, incl. the
      // tenant/hooks/collections facades): statements ~55.2 / branches ~51.9 /
      // functions ~47.2 / lines ~56.7.
      thresholds: {
        lines: 55,
        statements: 54,
        functions: 45,
        branches: 50,
      },
    },
  },
});
