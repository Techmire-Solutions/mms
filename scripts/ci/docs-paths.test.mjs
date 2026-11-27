import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { applyFixes, staleMentions } from "../check-docs-paths.mjs";

const tempDirs = [];
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mms-docs-paths-"));
  tempDirs.push(root);
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.mkdirSync(path.join(root, "packages", "db", "scripts", "sql"), { recursive: true });
  fs.writeFileSync(path.join(root, "packages", "db", "scripts", "sql", "001_x.sql"), "-- x\n");
  fs.writeFileSync(path.join(root, "apps-placeholder"), "");
  return root;
}
after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe("living-docs path gate", () => {
  it("passes when every mentioned path exists at the root", () => {
    const root = fixture();
    fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(root, "scripts", "real.mjs"), "");
    fs.writeFileSync(path.join(root, "README.md"), "run `node scripts/real.mjs`\n");
    assert.deepEqual(staleMentions(["README.md"], root), []);
  });

  it("accepts a mention that resolves from a workspace package (pnpm --filter)", () => {
    const root = fixture();
    fs.writeFileSync(
      path.join(root, "README.md"),
      "pnpm --filter @mms/db index:concurrent -- --file scripts/sql/001_x.sql\n",
    );
    assert.deepEqual(staleMentions(["README.md"], root), []);
  });

  it("reports a genuinely stale mention", () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, "README.md"), "see `apps/gone/src/legacy.ts`\n");
    const findings = staleMentions(["README.md"], root);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].path, "apps/gone/src/legacy.ts");
  });

  it("skips docs that do not exist and fails closed when none do", () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, "README.md"), "ok\n");
    assert.deepEqual(staleMentions(["missing.md", "README.md"], root), []);
    assert.throws(() => staleMentions(["missing-only.md"], root), /scan/i);
  });
});

describe("living-docs fixer", () => {
  it("repoints a mention whose basename exists exactly once", () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, "README.md"), "run `apps/gone/build-index.mjs`\n");
    const findings = staleMentions(["README.md"], root);
    const { fixed, ambiguous } = applyFixes(
      findings,
      root,
      new Map([["build-index.mjs", ["scripts/build-index.mjs"]]]),
    );
    assert.equal(fixed.length, 1);
    assert.equal(ambiguous.length, 0);
    assert.match(
      fs.readFileSync(path.join(root, "README.md"), "utf8"),
      /scripts\/build-index\.mjs/,
    );
  });

  it("refuses to guess when the basename is ambiguous", () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, "README.md"), "see `apps/gone/main.tsx`\n");
    const findings = staleMentions(["README.md"], root);
    const { fixed, ambiguous } = applyFixes(
      findings,
      root,
      new Map([["main.tsx", ["apps/a/src/main.tsx", "apps/b/src/main.tsx"]]]),
    );
    assert.equal(fixed.length, 0);
    assert.equal(ambiguous.length, 1);
    assert.equal(ambiguous[0].candidates.length, 2);
    // untouched on disk
    assert.match(fs.readFileSync(path.join(root, "README.md"), "utf8"), /apps\/gone\/main\.tsx/);
  });
});

describe("retired pre-monorepo apps", () => {
  it("flags a living doc that names apps/frontend or apps/backend", () => {
    const root = fixture();
    fs.writeFileSync(
      path.join(root, "README.md"),
      "UI primitives live in `apps/frontend/src/components/ui/` and the API in `apps/backend/`.\n",
    );
    const findings = staleMentions(["README.md"], root);
    const retired = findings.filter((f) => /retired pre-monorepo app/.test(f.reason ?? ""));
    assert.equal(retired.length, 2, JSON.stringify(findings));
    assert.ok(retired.some((f) => f.path === "apps/frontend/"));
    assert.ok(retired.some((f) => f.path === "apps/backend/"));
  });

  it("does not flag the current packages/modules layout", () => {
    const root = fixture();
    fs.mkdirSync(path.join(root, "packages", "ui", "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "packages", "ui", "src", "index.ts"), "export {};\n");
    fs.writeFileSync(path.join(root, "README.md"), "UI lives in `packages/ui/src/index.ts`.\n");
    assert.deepEqual(staleMentions(["README.md"], root), []);
  });
});
