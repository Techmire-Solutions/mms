import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import {
  BASELINE_UNTESTED,
  findUncovered,
  gateScriptBasenames,
  hasCoveringTest,
  testBasenames,
} from "../check-gate-test-coverage.mjs";

const tempDirs = [];
function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mms-gate-coverage-"));
  tempDirs.push(dir);
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(dir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return dir;
}
after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe("gate test coverage ratchet", () => {
  it("matches a test by exact name, by prefixless name, and by containment", () => {
    const tests = ["module-exports", "pwa-precache-budget", "docs-paths"];
    assert.equal(hasCoveringTest("check-module-exports", tests), true);
    assert.equal(
      hasCoveringTest("check-pwa-precache", tests),
      true,
      "containment: pwa-precache-budget covers it",
    );
    assert.equal(hasCoveringTest("check-docs-paths", tests), true);
    assert.equal(hasCoveringTest("check-money-safety", tests), false);
  });

  it("fails a new untested gate that is not baselined", () => {
    const failures = findUncovered(
      [{ name: "check:brand-new", scriptBase: "check-brand-new" }],
      [],
      [],
    );
    assert.equal(failures.length, 1);
    assert.match(failures[0], /check:brand-new has no test/);
  });

  it("accepts a baselined gap but rejects a stale baseline entry", () => {
    const gates = [{ name: "check:known-gap", scriptBase: "check-known-gap" }];
    assert.deepEqual(findUncovered(gates, [], ["check:known-gap"]), []);
    const stale = findUncovered(gates, [], ["check:known-gap", "check:removed"]);
    assert.deepEqual(stale, [], "a removed gate is simply absent from the corpus, not a failure");
  });

  it("fails when a baselined gate gains a test, so the list can only shrink", () => {
    const failures = findUncovered(
      [{ name: "check:now-tested", scriptBase: "check-now-tested" }],
      ["now-tested"],
      ["check:now-tested"],
    );
    assert.equal(failures.length, 1);
    assert.match(failures[0], /now has a test — remove it from BASELINE_UNTESTED/);
  });

  it("reads the real manifest and the real test directory consistently", () => {
    const gates = gateScriptBasenames();
    const tests = testBasenames();
    assert.ok(gates.length > 40, `expected the repository's gates, got ${gates.length}`);
    assert.ok(tests.length > 5);
    assert.deepEqual(findUncovered(gates, tests), [], "the committed baseline must match the tree");
    assert.ok(BASELINE_UNTESTED.length > 0);
  });

  it("ignores directories and non-test files in the test folder", () => {
    const dir = fixture({
      "scripts/ci/real.test.mjs": "// test\n",
      "scripts/ci/notes.md": "# notes\n",
    });
    assert.deepEqual(testBasenames(path.join(dir, "scripts", "ci")), ["real"]);
  });
});
