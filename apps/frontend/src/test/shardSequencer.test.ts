import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHARD_TIMINGS_FILE, pickShard, timingKey, type WeightedFile } from './shardSequencer';

const recorded = JSON.parse(readFileSync(SHARD_TIMINGS_FILE, 'utf8')) as Record<string, number>;
const recordedFiles = (): WeightedFile<string>[] =>
  Object.entries(recorded).map(([key, ms]) => ({ item: key, key, ms }));

describe('pickShard', () => {
  it('given the recorded timings, should place every file in exactly one of 4 shards', () => {
    // Arrange
    const files = recordedFiles();

    // Act
    const shards = [1, 2, 3, 4].map((index) => pickShard(files, 4, index));

    // Assert
    const assigned = shards.flat();
    expect(assigned).toHaveLength(files.length);
    expect(new Set(assigned).size).toBe(files.length);
  });

  it('given the recorded timings, should balance shard totals within one largest file', () => {
    // Arrange
    const files = recordedFiles();
    const largest = Math.max(...files.map((f) => f.ms));

    // Act
    const totals = [1, 2, 3, 4].map((index) =>
      pickShard(files, 4, index).reduce((sum, key) => sum + (recorded[key] ?? 0), 0),
    );

    // Assert
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(largest);
  });

  it('given the same files in a different order, should return the same shard', () => {
    // Arrange
    const files = recordedFiles();

    // Act
    const forward = pickShard(files, 4, 2);
    const reversed = pickShard(files.toReversed(), 4, 2);

    // Assert
    expect(reversed).toEqual(forward);
  });
});

describe('timingKey', () => {
  it('given an absolute test path, should return a POSIX path relative to the root', () => {
    // Arrange
    const root = path.join(path.sep, 'repo', 'apps', 'frontend');
    const moduleId = path.join(root, 'src', 'lib', 'a.test.ts');

    // Act
    const key = timingKey(root, moduleId);

    // Assert
    expect(key).toBe('src/lib/a.test.ts');
  });
});
