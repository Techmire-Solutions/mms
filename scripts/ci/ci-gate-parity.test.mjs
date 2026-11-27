import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { findUnwired, readGates, readInvocations } from "../check-ci-gate-parity.mjs";

const tempDirs = [];
function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mms-gate-parity-"));
  tempDirs.push(dir);
  return dir;
}
after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function writeManifest(dir, scripts) {
  const file = path.join(dir, "package.json");
  fs.writeFileSync(file, JSON.stringify({ scripts }, null, 2));
  return file;
}

describe("CI gate parity", () => {
  it("reads only check/verify scripts and extracts the node path", () => {
    const dir = tempDir();
    const manifest = writeManifest(dir, {
      "check:alpha": "node scripts/check-alpha.mjs --ratchet",
      "verify:beta": "node scripts/verify-beta.mjs",
      build: "turbo run build",
      test: "vitest",
    });
    const gates = readGates(manifest);
    assert.deepEqual(
      gates.map((gate) => gate.name),
      ["check:alpha", "verify:beta"],
    );
    assert.equal(gates[0].scriptPath, "scripts/check-alpha.mjs");
  });

  it("flags a gate that neither a workflow nor local-ci invokes", () => {
    const { unwired } = findUnwired(
      [
        {
          name: "check:ghost",
          command: "node scripts/check-ghost.mjs",
          scriptPath: "scripts/check-ghost.mjs",
        },
      ],
      "      - run: pnpm run check:other\n",
      new Map(),
    );
    assert.deepEqual(unwired, ["check:ghost"]);
  });

  it("accepts a gate invoked by name or by its script path", () => {
    const gates = [
      {
        name: "check:by-name",
        command: "node scripts/check-by-name.mjs",
        scriptPath: "scripts/check-by-name.mjs",
      },
      {
        name: "check:by-path",
        command: "node scripts/check-by-path.mjs",
        scriptPath: "scripts/check-by-path.mjs",
      },
    ];
    const haystack = "run: pnpm -s check:by-name\nrun: node scripts/check-by-path.mjs --ratchet\n";
    assert.deepEqual(findUnwired(gates, haystack, new Map()).unwired, []);
  });

  it("exempts an advisory gate but reports a stale advisory entry", () => {
    const gates = [{ name: "check:advised", command: "x", scriptPath: null }];
    const advisory = new Map([
      ["check:advised", "policy"],
      ["check:removed", "policy"],
    ]);
    const { unwired, stale } = findUnwired(gates, "nothing here", advisory);
    assert.deepEqual(unwired, []);
    assert.deepEqual(stale, ["check:removed"]);
  });

  it("fails closed when there is nothing to read", () => {
    const dir = tempDir();
    assert.throws(
      () => readInvocations(path.join(dir, "missing"), path.join(dir, "also-missing")),
      /scan/i,
    );
  });

  it("sees the real repository workflows", () => {
    const haystack = readInvocations();
    assert.match(haystack, /jobs:/);
  });
});
