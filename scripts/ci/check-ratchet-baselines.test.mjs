import { test } from "node:test";
import assert from "node:assert/strict";
import { findIncreasedBaselines, parseBaselines } from "./check-ratchet-baselines.mjs";

test("parses object and scalar baselines", () => {
  assert.deepEqual(
    [...parseBaselines("const BASELINE = { missingLockTimeout: 0, bareTimestamps: 311 };")],
    [
      ["missingLockTimeout", 0],
      ["bareTimestamps", 311],
    ],
  );
  assert.deepEqual([...parseBaselines("const BASELINE = 174;")], [["__scalar__", 174]]);
});

test("fails on an increased object baseline", () => {
  const base = "const BASELINE = { filesOverHardLimit: 4 };";
  const head = "const BASELINE = { filesOverHardLimit: 9 };";
  assert.deepEqual(findIncreasedBaselines(base, head), [
    { key: "filesOverHardLimit", from: 4, to: 9 },
  ]);
});

test("fails on an increased scalar baseline", () => {
  assert.deepEqual(findIncreasedBaselines("const BASELINE = 174;", "const BASELINE = 180;"), [
    { key: "__scalar__", from: 174, to: 180 },
  ]);
});

test("allows a lowered baseline", () => {
  assert.deepEqual(
    findIncreasedBaselines(
      "const BASELINE = { missingSnapshots: 63 };",
      "const BASELINE = { missingSnapshots: 0 };",
    ),
    [],
  );
});
