import { writeFileSync } from "node:fs";
import type { Reporter, TestModule } from "vitest/node";
import { SHARD_TIMINGS_FILE } from "./shardSequencer";

/**
 * Writes each test file's wall cost (environment setup, import, collect and
 * run) to `shard-timings.json` for `DurationShardSequencer`. Feed it CI blob
 * reports so timings reflect CI runners, not a dev machine:
 *
 *   gh run download <main CI run id> -p 'vitest-blob-report-*' -D /tmp/vitest-blobs
 *   mkdir -p apps/frontend/.vitest-reports
 *   find /tmp/vitest-blobs -name 'blob-*.json' -exec mv {} apps/frontend/.vitest-reports/ \;
 *   pnpm --filter mms-frontend test:shard-timings
 */
export default class ShardTimingsReporter implements Reporter {
  onTestRunEnd(testModules: ReadonlyArray<TestModule>): void {
    const entries = testModules.map((module) => {
      const d = module.diagnostic();
      const ms =
        d.environmentSetupDuration +
        d.prepareDuration +
        d.collectDuration +
        d.setupDuration +
        d.duration;
      // relativeModuleId is computed where the test ran, so CI blobs merged on
      // another machine still produce root-relative keys.
      return [module.relativeModuleId.replaceAll("\\", "/"), Math.round(ms)] as const;
    });
    if (entries.length === 0) return;
    const sorted = Object.fromEntries(entries.toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    writeFileSync(SHARD_TIMINGS_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
  }
}
