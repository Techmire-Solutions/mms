import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { findSpecByBasename, resolveRequirement } from "../lib/spec-lookup.mjs";

const tempDirs = [];
function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mms-spec-lookup-"));
  tempDirs.push(dir);
  return dir;
}
after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe("matrix spec lookup", () => {
  it("prefers the pinned path when it still exists", () => {
    const dir = tempDir();
    const pinned = path.join(dir, "spec.test.ts");
    fs.writeFileSync(pinned, "it('stays put')");
    const resolved = resolveRequirement(
      { file: pinned },
      { lookup: () => assert.fail("must not search") },
    );
    assert.equal(resolved.path, pinned);
    assert.equal(resolved.movedFrom, undefined);
  });

  it("falls back to a basename search when the pinned path moved", () => {
    const resolved = resolveRequirement(
      { file: "apps/tenant-web/src/tenant/features/obligations/hooks/gone.test.ts" },
      { lookup: (basename) => `/moved/${basename}` },
    );
    assert.equal(resolved.path, "/moved/gone.test.ts");
    assert.match(resolved.movedFrom, /features\/obligations/);
  });

  it("reports missing when neither the path nor the basename resolves", () => {
    const resolved = resolveRequirement(
      { file: "apps/x/src/nope.test.ts" },
      { lookup: () => null },
    );
    assert.equal(resolved.missing, true);
  });

  it("accepts a basename-only requirement", () => {
    const resolved = resolveRequirement(
      { spec: "EnterMarksTable.test.tsx" },
      { lookup: (b) => `/m/${b}` },
    );
    assert.equal(resolved.path, "/m/EnterMarksTable.test.tsx");
  });

  it("finds a real spec by basename under the repository roots", () => {
    const found = findSpecByBasename("EnterMarksTable.test.tsx");
    assert.ok(found, "expected the examinations spec to be findable");
    assert.match(found, /examinations/);
  });

  it("returns null for a basename that does not exist", () => {
    assert.equal(findSpecByBasename("definitely-not-a-real-spec-xyz.test.ts"), null);
  });
});
