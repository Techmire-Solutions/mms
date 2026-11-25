import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyseApp, recentlyModified } from "../../scripts/report-dead-sources.mjs";

/**
 * The dead-source report is how we decide what a prune may delete, so its reachability rules are
 * pinned here: every edge form counts, tests keep their fixtures alive, and the duplicate proof
 * compares content rather than paths.
 */
function makeRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dead-sources-"));
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

test("counts files reachable from the entry and reports the rest", () => {
  const root = makeRepo({
    "apps/demo/src/main.tsx": 'import { a } from "./a";\n',
    "apps/demo/src/a.ts": 'import { b } from "@/lib/b";\n',
    "apps/demo/src/lib/b.ts": "export const b = 1;\n",
    "apps/demo/src/lib/orphan.ts": "export const orphan = 1;\n",
  });
  const report = analyseApp(path.join(root, "apps/demo"), { repoRoot: root });
  assert.equal(report.total, 4);
  assert.equal(report.unreachableFromAppOnly, 1);
  assert.equal(report.unreachable, 1);
  assert.deepEqual(report.unreachableByDir, [["lib", 1]]);
});

test("bare side-effect imports and re-export edges are edges", () => {
  const root = makeRepo({
    "apps/demo/src/main.tsx": 'import "./bootstrap";\n',
    "apps/demo/src/bootstrap.ts": 'export * from "./lib/registry";\n',
    "apps/demo/src/lib/registry.ts": "export const registry = 1;\n",
    "apps/demo/src/lib/unused.ts": "export const unused = 1;\n",
  });
  const report = analyseApp(path.join(root, "apps/demo"), { repoRoot: root });
  assert.equal(report.unreachable, 1);
  assert.equal(report.unreachableByDir[0][0], "lib");
});

test("a file only a test imports is not reported as dead", () => {
  const root = makeRepo({
    "apps/demo/src/main.tsx": "export const main = 1;\n",
    "apps/demo/src/fixtureOnly.ts": "export const fixture = 1;\n",
    "apps/demo/src/fixtureOnly.test.ts": 'import { fixture } from "./fixtureOnly";\n',
  });
  const report = analyseApp(path.join(root, "apps/demo"), { repoRoot: root });
  assert.equal(report.unreachable, 0, "test graphs keep their imported sources alive");
});

test("duplicates mode separates exact copies from files with no twin", () => {
  const root = makeRepo({
    "apps/demo/src/main.tsx": "export const main = 1;\n",
    "apps/demo/src/copied.ts": "export const shared = 1;\n",
    "apps/other/src/copied.ts": "export const shared = 1;\n",
    "apps/demo/src/unique.ts": "export const onlyHere = 1;\n",
  });
  const report = analyseApp(path.join(root, "apps/demo"), { repoRoot: root, duplicates: true });
  assert.equal(report.unreachable, 2);
  assert.equal(report.duplicates.copied.length, 1);
  assert.equal(report.duplicates.unique.length, 1);
  assert.match(report.duplicates.copied[0].twin, /apps\/other\/src\/copied\.ts$/);
  assert.match(report.duplicates.unique[0], /unique\.ts$/);
});

test("an app without src/main.tsx reports an error instead of a fake zero", () => {
  const root = makeRepo({ "apps/api/src/server.ts": "export const server = 1;\n" });
  const report = analyseApp(path.join(root, "apps/api"), { repoRoot: root });
  assert.equal(report.error, "no src/main.tsx");
  assert.equal(report.total, undefined);
});

test("recentlyModified counts only files inside the window", () => {
  const root = makeRepo({
    "apps/demo/src/old.ts": "export const old = 1;\n",
    "packages/x/src/new.ts": "export const fresh = 1;\n",
  });
  const now = Date.now();
  const old = new Date(now - 60 * 60_000);
  fs.utimesSync(path.join(root, "apps/demo/src/old.ts"), old, old);

  assert.equal(
    recentlyModified(["apps/demo/src", "packages"], { repoRoot: root, minutes: 10, now }),
    1,
  );
  assert.equal(
    recentlyModified(["apps/demo/src", "packages"], { repoRoot: root, minutes: 0, now }),
    0,
  );
  assert.equal(
    recentlyModified(["apps/demo/src", "packages"], { repoRoot: root, minutes: 120, now }),
    2,
  );
});
