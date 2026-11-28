import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { chooseQuietApps, selectPrunable } from "../prune-dead-copies.mjs";

const tempDirs = [];
function fixtureRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mms-prune-"));
  tempDirs.push(root);
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}
after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

const HEADER = "export const shared = 1;\n";

describe("dead-copy pruner selection", () => {
  it("selects a dead copy that is byte-identical to a twin", () => {
    const root = fixtureRepo({
      "apps/demo/src/main.tsx": "export const main = 1;\n",
      "apps/demo/src/orphan.ts": HEADER,
      "packages/thing/src/orphan.ts": HEADER,
    });
    const { prunable, skipped } = selectPrunable({ apps: ["demo"], repoRoot: root });
    assert.equal(prunable.length, 1);
    assert.match(prunable[0].file, /apps[\\/]demo[\\/]src[\\/]orphan\.ts$/);
    assert.match(prunable[0].twin, /packages[\\/]thing[\\/]src[\\/]orphan\.ts$/);
    assert.equal(skipped.length, 0);
  });

  it("refuses a copy a test still imports", () => {
    const root = fixtureRepo({
      "apps/demo/src/main.tsx": "export const main = 1;\n",
      "apps/demo/src/used.ts": HEADER,
      "apps/demo/src/used.test.ts": 'import { shared } from "./used";\n',
      "packages/thing/src/used.ts": HEADER,
    });
    const { prunable, skipped } = selectPrunable({ apps: ["demo"], repoRoot: root });
    assert.equal(prunable.length, 0);
    assert.equal(skipped.length, 1);
    assert.match(skipped[0].reason, /reachable from a test/);
  });

  it("refuses config-referenced test support even when dead and identical", () => {
    const root = fixtureRepo({
      "apps/demo/src/main.tsx": "export const main = 1;\n",
      "apps/demo/src/test/setup.ts": HEADER,
      "apps/demo/vitest.config.ts":
        'export default { test: { setupFiles: ["./src/test/setup.ts"] } };\n',
      "packages/thing/src/setup.ts": HEADER,
    });
    const { prunable, skipped } = selectPrunable({ apps: ["demo"], repoRoot: root });
    assert.equal(prunable.length, 0);
    assert.ok(
      skipped.some((entry) => /config-referenced|reachable from a test/.test(entry.reason)),
    );
  });

  it("ignores an app without src/main.tsx", () => {
    const root = fixtureRepo({ "apps/empty/package.json": "{}\n" });
    const { prunable } = selectPrunable({ apps: ["empty"], repoRoot: root });
    assert.equal(prunable.length, 0);
  });
});

describe("per-app quiescence", () => {
  it("marks an app busy from its own src churn only", () => {
    const { quiet, busy } = chooseQuietApps(["calm", "moving"], {
      measure: (roots) => (roots[0].includes("moving") ? 7 : 0),
    });
    assert.deepEqual(
      quiet.map((entry) => entry.app),
      ["calm"],
    );
    assert.deepEqual(
      busy.map((entry) => entry.app),
      ["moving"],
    );
    assert.equal(busy[0].recent, 7);
  });

  it("measures only the app's own src root", () => {
    const seen = [];
    chooseQuietApps(["demo"], {
      measure: (roots) => {
        seen.push(...roots);
        return 0;
      },
    });
    assert.deepEqual(seen, ["apps/demo/src"]);
  });
});
