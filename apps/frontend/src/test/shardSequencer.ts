import { readFileSync } from 'node:fs';
import path from 'node:path';
import { BaseSequencer, type TestSpecification } from 'vitest/node';

/** Per-file cost in ms, keyed by `timingKey`; regenerate with `pnpm test:shard-timings`. */
export const SHARD_TIMINGS_FILE = path.join(import.meta.dirname, 'shard-timings.json');

/** POSIX path of a test file relative to the Vitest root (stable across OSes). */
export function timingKey(root: string, moduleId: string): string {
  return path.relative(root, moduleId).split(path.sep).join('/');
}

function loadTimings(): Record<string, number> {
  try {
    return JSON.parse(readFileSync(SHARD_TIMINGS_FILE, 'utf8')) as Record<string, number>;
  } catch {
    return {};
  }
}

const byKey = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export interface WeightedFile<T> {
  item: T;
  key: string;
  ms: number;
}

/**
 * Longest-processing-time split: heaviest files first (ties by key), each to
 * the currently lightest shard. Pure and deterministic, so every shard
 * computes the same partition. Returns the files of shard `index` (1-based).
 */
export function pickShard<T>(files: WeightedFile<T>[], count: number, index: number): T[] {
  const loads = Array.from({ length: count }, () => 0);
  const mine: T[] = [];
  for (const file of files.toSorted((a, b) => b.ms - a.ms || byKey(a.key, b.key))) {
    let target = 0;
    for (let i = 1; i < count; i += 1) {
      if ((loads[i] ?? 0) < (loads[target] ?? 0)) target = i;
    }
    loads[target] = (loads[target] ?? 0) + file.ms;
    if (target === index - 1) mine.push(file.item);
  }
  return mine;
}

/**
 * Shards by recorded per-file cost instead of Vitest's path hash, which splits
 * by file count and left shards 76–125s apart. Files without a recorded time
 * count as the median.
 */
export class DurationShardSequencer extends BaseSequencer {
  override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { shard, root } = this.ctx.config;
    if (!shard) return files;

    const timings = loadTimings();
    const known = Object.values(timings).toSorted((a, b) => a - b);
    const fallback = known[Math.floor(known.length / 2)] ?? 1;
    const weighted = files.map((spec) => {
      const key = timingKey(root, spec.moduleId);
      return { item: spec, key, ms: timings[key] ?? fallback };
    });
    return pickShard(weighted, shard.count, shard.index);
  }
}
