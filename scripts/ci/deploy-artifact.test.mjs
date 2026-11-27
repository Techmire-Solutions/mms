import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { findUncovered, packagedPaths, requiredRuntimeDists } from "../check-deploy-artifact.mjs";

const tempDirs = [];
function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mms-deploy-artifact-"));
  tempDirs.push(root);
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content));
  }
  return root;
}
after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

const EMITTING = "tsc -p tsconfig.build.json && tsc --noEmit -p tsconfig.frontend.json";
const CHECK_ONLY = "tsc --noEmit -p tsconfig.build.json";

describe("deploy artifact gate", () => {
  it("requires the API, both consoles and every dist-emitting runtime dependency", () => {
    const root = fixture({
      "apps/api/package.json": {
        name: "api",
        dependencies: { "@mms/db": "workspace:*", "@mms/ui": "workspace:*" },
        scripts: { build: "tsc" },
      },
      "apps/tenant-web/package.json": { name: "tenant", scripts: { build: "vite build" } },
      "apps/platform-web/package.json": { name: "platform", scripts: { build: "vite build" } },
      "packages/db/package.json": { name: "@mms/db", scripts: { build: EMITTING } },
      "packages/ui/package.json": { name: "@mms/ui", scripts: { build: CHECK_ONLY } },
    });
    const required = requiredRuntimeDists(root);
    assert.deepEqual(required, [
      "apps/api/dist",
      "apps/platform-web/dist",
      "apps/tenant-web/dist",
      "packages/db/dist",
    ]);
  });

  it("follows transitive runtime dependencies", () => {
    const root = fixture({
      "apps/api/package.json": { name: "api", dependencies: { "@mms/be-core": "workspace:*" } },
      "packages/be-core/package.json": {
        name: "@mms/be-core",
        dependencies: { "@mms/contracts": "workspace:*" },
        scripts: { build: EMITTING },
      },
      "packages/contracts/package.json": { name: "@mms/contracts", scripts: { build: EMITTING } },
    });
    const required = requiredRuntimeDists(root);
    assert.ok(required.includes("packages/be-core/dist"), JSON.stringify(required));
    assert.ok(required.includes("packages/contracts/dist"), JSON.stringify(required));
  });

  it("reads the packaging script's DIST_PATHS and module loop", () => {
    const script = `DIST_PATHS=(\n  apps/api/dist\n  "packages/db/dist"\n)\nfor mod_dir in packages/modules/*/; do :; done\n`;
    const { paths, moduleLoop } = packagedPaths(script);
    assert.deepEqual([...paths].sort(), ["apps/api/dist", "packages/db/dist"]);
    assert.equal(moduleLoop, true);
  });

  it("flags an uncovered dist and accepts a module covered by the loop", () => {
    const packaged = { paths: new Set(["apps/api/dist"]), moduleLoop: true };
    const uncovered = findUncovered(
      ["apps/api/dist", "packages/modules/iam/dist", "packages/ui/dist"],
      packaged,
    );
    assert.deepEqual(uncovered, ["packages/ui/dist"]);
  });
});
