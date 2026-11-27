import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { ciFlagsFrom } from "../verify-all.mjs";

const tempDirs = [];
function workflow(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mms-verify-all-"));
  tempDirs.push(dir);
  const file = path.join(dir, "ci.yml");
  fs.writeFileSync(file, text);
  return file;
}
after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe("verify:all derives CI flags", () => {
  it("reads the flags a workflow passes to a gate script", () => {
    const file = workflow(`
      - run: node scripts/check-code-norms.mjs --ratchet
      - run: node scripts/check-secrets.mjs --tracked
      - run: pnpm run check:forms
    `);
    const flags = ciFlagsFrom(file);
    assert.deepEqual(flags.get("scripts/check-code-norms.mjs"), ["--ratchet"]);
    assert.deepEqual(flags.get("scripts/check-secrets.mjs"), ["--tracked"]);
    assert.equal(flags.has("scripts/check-forms.mjs"), false);
  });

  it("merges repeated invocations of the same script", () => {
    const file = workflow(`
      run: node scripts/check-thing.mjs --ratchet
      run: node scripts/check-thing.mjs --verbose
    `);
    assert.deepEqual(ciFlagsFrom(file).get("scripts/check-thing.mjs"), ["--ratchet", "--verbose"]);
  });

  it("returns an empty map when the workflow is missing", () => {
    assert.equal(ciFlagsFrom("/nonexistent/ci.yml").size, 0);
  });

  it("finds the four flagged gates in the real workflow", () => {
    const flags = ciFlagsFrom(path.join(process.cwd(), ".github", "workflows", "ci.yml"));
    assert.deepEqual(flags.get("scripts/check-code-norms.mjs"), ["--ratchet"]);
    assert.deepEqual(flags.get("scripts/check-frontend-structure.mjs"), ["--ratchet"]);
    assert.deepEqual(flags.get("scripts/check-form-architecture.mjs"), ["--ratchet"]);
    assert.deepEqual(flags.get("scripts/check-staged-secrets.mjs"), ["--tracked"]);
  });
});
