import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateChangedCoverage } from "./changed-coverage-core.mjs";

function evaluate({ changed, added = new Set(), perFile = new Map(), lines = {} }) {
  return evaluateChangedCoverage({
    changed,
    added,
    perFile,
    min: 60,
    minFileLines: 20,
    lineCountOf: (file) => lines[file] ?? 0,
  });
}

test("passes when changed files are well covered", () => {
  const result = evaluate({
    changed: ["src/a.ts"],
    perFile: new Map([["src/a.ts", { covered: 90, total: 100 }]]),
  });
  assert.deepEqual(result.failures, []);
  assert.equal(result.aggregate, 90);
});

test("fails when changed source has no coverage data at all", () => {
  const result = evaluate({ changed: ["src/a.ts"], lines: { "src/a.ts": 100 } });
  assert.ok(result.failures.some((failure) => failure.includes("no coverage data")));
  assert.ok(result.failures.some((failure) => failure.includes("< 60%")));
});

test("counts a modified untested file as 0% instead of exempting it", () => {
  const result = evaluate({
    changed: ["src/tested.ts", "src/untested.ts"],
    perFile: new Map([["src/tested.ts", { covered: 100, total: 100 }]]),
    lines: { "src/untested.ts": 100 },
  });
  assert.equal(result.aggregate, 50);
  assert.ok(result.failures.some((failure) => failure.includes("< 60%")));
});

test("fails a substantive new file that no test imports", () => {
  const result = evaluate({
    changed: ["src/new.ts"],
    added: new Set(["src/new.ts"]),
    lines: { "src/new.ts": 40 },
  });
  assert.ok(result.failures.some((failure) => failure.includes("new file not imported")));
});

test("keeps the small-shim exemption", () => {
  const result = evaluate({
    changed: ["src/shim.ts"],
    added: new Set(["src/shim.ts"]),
    lines: { "src/shim.ts": 5 },
  });
  assert.deepEqual(
    result.failures.filter((failure) => failure.includes("new file not imported")),
    [],
  );
});

test("does nothing when no source files changed", () => {
  const result = evaluate({ changed: [] });
  assert.deepEqual(result.failures, []);
  assert.equal(result.aggregate, 100);
});
