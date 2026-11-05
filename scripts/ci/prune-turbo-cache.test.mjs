import { test } from "node:test";
import assert from "node:assert/strict";
import { groupCacheEntries, selectPrunable } from "./prune-turbo-cache.mjs";

const MB = 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 4, 12, 0, 0);

function entry(hash, mb, ageDays) {
  return { hash, bytes: mb * MB, mtimeMs: NOW - ageDays * DAY };
}

test("groups turbo triplets into one entry and ignores unrelated files", () => {
  const entries = groupCacheEntries([
    { name: "aaaa00000000bbbb.tar.zst", bytes: 100, mtimeMs: NOW - 1000 },
    { name: "aaaa00000000bbbb-meta.json", bytes: 10, mtimeMs: NOW },
    { name: "aaaa00000000bbbb-manifest.json", bytes: 1, mtimeMs: NOW - 2000 },
    { name: "README", bytes: 999, mtimeMs: NOW },
  ]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].hash, "aaaa00000000bbbb");
  assert.equal(entries[0].bytes, 111);
  assert.equal(entries[0].mtimeMs, NOW);
  assert.deepEqual(entries[0].names.sort(), [
    "aaaa00000000bbbb-manifest.json",
    "aaaa00000000bbbb-meta.json",
    "aaaa00000000bbbb.tar.zst",
  ]);
});

test("keeps everything when under the cap and within the age limit", () => {
  const { delete: removed, keptBytes } = selectPrunable(
    [entry("aaaabbbbccccdddd", 100, 1), entry("1111222233334444", 100, 2)],
    { maxBytes: 350 * MB, nowMs: NOW, maxAgeMs: 14 * DAY },
  );
  assert.deepEqual(removed, []);
  assert.equal(keptBytes, 200 * MB);
});

test("drops the oldest entries until the cache fits the cap", () => {
  const newest = entry("ffff0000ffff0000", 200, 1);
  const middle = entry("aaaa0000aaaa0000", 200, 2);
  const oldest = entry("1111000011110000", 200, 3);
  const { delete: removed, keptBytes } = selectPrunable([middle, oldest, newest], {
    maxBytes: 250 * MB,
    nowMs: NOW,
    maxAgeMs: 14 * DAY,
  });
  assert.deepEqual(removed.sort(), [middle.hash, oldest.hash].sort());
  assert.equal(keptBytes, 200 * MB);
});

test("drops entries older than the age limit even when under the cap", () => {
  const stale = entry("9999000099990000", 10, 30);
  const { delete: removed } = selectPrunable([stale, entry("8888000088880000", 10, 1)], {
    maxBytes: 350 * MB,
    nowMs: NOW,
    maxAgeMs: 14 * DAY,
  });
  assert.deepEqual(removed, [stale.hash]);
});

test("never empties the cache when the newest entry alone exceeds the cap", () => {
  const huge = entry("deadbeefdeadbeef", 900, 0);
  const { delete: removed, keptBytes } = selectPrunable([huge, entry("cafebabecafebabe", 10, 2)], {
    maxBytes: 350 * MB,
    nowMs: NOW,
    maxAgeMs: 14 * DAY,
  });
  assert.deepEqual(removed, ["cafebabecafebabe"]);
  assert.equal(keptBytes, 900 * MB);
});

test("handles an empty cache", () => {
  assert.deepEqual(groupCacheEntries([]), []);
  assert.deepEqual(selectPrunable([], { maxBytes: MB, nowMs: NOW, maxAgeMs: DAY }), {
    keep: [],
    delete: [],
    keptBytes: 0,
  });
});
