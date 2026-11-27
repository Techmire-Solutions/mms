import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { findUnresolved, resolveSpecifier } from "../check-module-exports.mjs";

/** Build a throwaway module package: <tmp>/packages/modules/<slice>/… */
function makeModule(slice, files, exportsMap) {
  const dir = tempDirs[tempDirs.length - 1];
  const pkgDir = path.join(dir, "packages", "modules", slice);
  fs.mkdirSync(pkgDir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const target = path.join(pkgDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  fs.writeFileSync(
    path.join(pkgDir, "package.json"),
    JSON.stringify({ name: `@mms/mod-${slice}`, exports: exportsMap }),
  );
  return { dir: pkgDir, exports: exportsMap };
}

const tempDirs = [];
const readModule = (slice) => {
  const dir = path.join(tempDirs[tempDirs.length - 1], "packages", "modules", slice);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  return { dir, exports: manifest.exports };
};

after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe("module exports gate", () => {
  it("flags a .tsx file that a .ts-first export array makes unreachable", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mms-mod-exports-root-"));
    tempDirs.push(root);
    makeModule(
      "iam",
      { "src/frontend/tenant/UsersPage.tsx": "export default 1;" },
      {
        "./frontend/tenant/*": ["./src/frontend/tenant/*.ts", "./src/frontend/tenant/*.tsx"],
      },
    );

    const verdict = resolveSpecifier("@mms/mod-iam/frontend/tenant/UsersPage", readModule("iam"));
    assert.equal(verdict.ok, false);
    assert.match(verdict.reason, /later array entry is unreachable/);
  });

  it("accepts the same file once the package declares an explicit entry", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mms-mod-exports-root-"));
    tempDirs.push(root);
    makeModule(
      "iam",
      { "src/frontend/tenant/UsersPage.tsx": "export default 1;" },
      {
        "./frontend/tenant/*": ["./src/frontend/tenant/*.ts", "./src/frontend/tenant/*.tsx"],
        "./frontend/tenant/UsersPage": "./src/frontend/tenant/UsersPage.tsx",
      },
    );

    assert.equal(
      resolveSpecifier("@mms/mod-iam/frontend/tenant/UsersPage", readModule("iam")).ok,
      true,
    );
  });

  it("resolves a .ts file through the first array entry", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mms-mod-exports-root-"));
    tempDirs.push(root);
    makeModule(
      "students",
      { "src/frontend/tenant/lib/helpers.ts": "export const a = 1;" },
      {
        "./frontend/tenant/lib/*": [
          "./src/frontend/tenant/lib/*.ts",
          "./src/frontend/tenant/lib/*.tsx",
        ],
      },
    );

    assert.equal(
      resolveSpecifier("@mms/mod-students/frontend/tenant/lib/helpers", readModule("students")).ok,
      true,
    );
  });

  it("reports a subpath the map does not export", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mms-mod-exports-root-"));
    tempDirs.push(root);
    makeModule("iam", {}, { "./frontend/tenant/lib/*": "./src/frontend/tenant/lib/*.ts" });

    const verdict = resolveSpecifier("@mms/mod-iam/frontend/tenant/nope", readModule("iam"));
    assert.equal(verdict.ok, false);
    assert.match(verdict.reason, /not exported/);
  });

  it("findUnresolved names the importing file and the specifier", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mms-mod-exports-root-"));
    tempDirs.push(root);
    makeModule(
      "iam",
      { "src/frontend/tenant/UsersPage.tsx": "export default 1;" },
      {
        "./frontend/tenant/*": ["./src/frontend/tenant/*.ts", "./src/frontend/tenant/*.tsx"],
      },
    );

    const failures = findUnresolved(
      new Map([
        [
          path.join(root, "apps", "platform-web", "src", "routing.ts"),
          new Set(["@mms/mod-iam/frontend/tenant/UsersPage"]),
        ],
      ]),
      readModule,
    );
    assert.equal(failures.length, 1);
    assert.match(failures[0].specifier, /UsersPage/);
    assert.match(failures[0].file, /routing\.ts$/);
  });
});
