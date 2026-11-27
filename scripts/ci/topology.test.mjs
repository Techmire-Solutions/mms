import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  MODULE_SLICES,
  REQUIRED_WORKSPACE_GLOBS,
  TARGET_APPS,
  TRANSITIONAL_APPS,
  evaluateTopology,
} from "../check-topology.mjs";

const WORKSPACE = `packages:\n${REQUIRED_WORKSPACE_GLOBS.map((glob) => `  - "${glob}"`).join("\n")}\n`;
const TOOLING = ["eslint-config", "tailwind-config", "typescript-config"];

const write = (root, rel, content) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
};
const json = (root, rel, value) => write(root, rel, `${JSON.stringify(value, null, 2)}\n`);

/**
 * Materialize a minimal but valid repository. Every option defaults to the
 * smallest legal tree, so a test can override exactly one thing.
 */
function makeRepo({
  apps = [
    ["api", "mms-api"],
    ["frontend", "mms-frontend"],
  ],
  packages = [["contracts", "@mms/contracts"]],
  modules = [["iam", "@mms/mod-iam"]],
  tooling = TOOLING,
  workspace = WORKSPACE,
  appSrc = true,
  moduleSrc = true,
  moduleExports = { "./shared": "./src/shared/index.ts" },
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mms-topology-"));
  write(root, "pnpm-workspace.yaml", workspace);
  for (const [name, pkgName] of apps) {
    json(root, `apps/${name}/package.json`, { name: pkgName });
    if (appSrc) fs.mkdirSync(path.join(root, "apps", name, "src"), { recursive: true });
  }
  for (const [dir, pkgName] of packages) {
    json(root, `packages/${dir}/package.json`, { name: pkgName });
  }
  for (const [slice, pkgName] of modules) {
    json(root, `packages/modules/${slice}/package.json`, { name: pkgName, exports: moduleExports });
    if (moduleSrc) {
      fs.mkdirSync(path.join(root, "packages/modules", slice, "src", "shared"), {
        recursive: true,
      });
    }
  }
  for (const dir of tooling) json(root, `tooling/${dir}/package.json`, { name: `@mms/${dir}` });
  return root;
}

const errorsOf = (root) => evaluateTopology({ root }).errors;

test("accepts the minimal valid topology", () => {
  assert.deepEqual(errorsOf(makeRepo()), []);
});

test("reports transitional and target apps separately", () => {
  const root = makeRepo({
    apps: [
      ["frontend", "mms-frontend"],
      ["api", "mms-api"],
      ["tenant-web", "mms-tenant-web"],
    ],
  });
  const { errors, summary } = evaluateTopology({ root });
  assert.deepEqual(errors, []);
  assert.deepEqual(summary.transitionalApps, ["frontend"]);
  assert.deepEqual(summary.targetApps, ["api", "tenant-web"]);
});

test("fails closed when apps/ or packages/ is missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mms-topology-"));
  write(root, "pnpm-workspace.yaml", WORKSPACE);
  const errors = errorsOf(root);
  assert.ok(errors.some((error) => error.includes("missing directory: apps/")));
  assert.ok(errors.some((error) => error.includes("missing directory: packages/")));
});

test("rejects an undeclared app root", () => {
  const root = makeRepo({ apps: [["mobile", "mms-mobile"]] });
  assert.match(errorsOf(root).join("\n"), /undeclared app root: apps\/mobile/);
});

test("rejects an app whose package name is not mms-<kebab>", () => {
  const root = makeRepo({ apps: [["api", "api-app"]] });
  assert.match(errorsOf(root).join("\n"), /must be named mms-<kebab>/);
});

test("rejects an app without src/", () => {
  const root = makeRepo({ appSrc: false });
  assert.match(errorsOf(root).join("\n"), /apps\/api has no src\//);
});

test("rejects an undeclared flat package and a name mismatch", () => {
  const root = makeRepo({
    packages: [
      ["contracts", "@mms/contracts"],
      ["shared", "@mms/shared"],
      ["ui", "@mms/design-system"],
    ],
  });
  const errors = errorsOf(root).join("\n");
  assert.match(errors, /undeclared package: packages\/shared/);
  assert.match(errors, /packages\/ui must be named @mms\/ui/);
});

test("rejects a half-created module directory", () => {
  const root = makeRepo({ modules: [] });
  fs.mkdirSync(path.join(root, "packages/modules/contacts"), { recursive: true });
  assert.match(errorsOf(root).join("\n"), /packages\/modules\/contacts has no package\.json/);
});

test("rejects an uppercase module package name (npm requires lowercase)", () => {
  const root = makeRepo({ modules: [["question-bank", "@mms/mod-questionBank"]] });
  const errors = errorsOf(root).join("\n");
  assert.match(errors, /@mms\/mod-<kebab>/);
  assert.match(errors, /must be named @mms\/mod-question-bank/);
});

test("rejects an undeclared module slice", () => {
  const root = makeRepo({ modules: [["marketplace", "@mms/mod-marketplace"]] });
  assert.match(
    errorsOf(root).join("\n"),
    /undeclared module slice: packages\/modules\/marketplace/,
  );
});

test("rejects a module that exports its root (D13)", () => {
  const root = makeRepo({
    modules: [["iam", "@mms/mod-iam"]],
    moduleExports: { ".": "./src/index.ts", "./shared": "./src/shared/index.ts" },
  });
  assert.match(errorsOf(root).join("\n"), /must not export "\."/);
});

test("rejects a module without src/ or without an audience folder", () => {
  const noSrc = makeRepo({ moduleSrc: false });
  assert.match(errorsOf(noSrc).join("\n"), /packages\/modules\/iam has no src\//);

  const noAudience = makeRepo({ moduleSrc: false });
  fs.mkdirSync(path.join(noAudience, "packages/modules/iam/src/components"), { recursive: true });
  assert.match(errorsOf(noAudience).join("\n"), /no shared\|backend\|frontend audience/);
});

test("rejects a missing tooling package and an undeclared one", () => {
  const missing = makeRepo({ tooling: ["eslint-config", "tailwind-config"] });
  assert.match(errorsOf(missing).join("\n"), /missing tooling package: tooling\/typescript-config/);

  const extra = makeRepo({ tooling: [...TOOLING, "prettier-config"] });
  assert.match(errorsOf(extra).join("\n"), /undeclared tooling package: tooling\/prettier-config/);
});

test("rejects a dropped workspace glob", () => {
  const root = makeRepo({
    workspace: 'packages:\n  - "apps/*"\n  - "packages/*"\n  - "packages/modules/*"\n  - "e2e"\n',
  });
  assert.match(errorsOf(root).join("\n"), /missing the "tooling\/\*" glob/);
});

test("rejects a missing pnpm-workspace.yaml", () => {
  const root = makeRepo();
  fs.rmSync(path.join(root, "pnpm-workspace.yaml"));
  assert.match(errorsOf(root).join("\n"), /missing pnpm-workspace\.yaml/);
});

test("exposes the declared app and module rosters", () => {
  assert.deepEqual([...TRANSITIONAL_APPS], ["frontend"]);
  assert.deepEqual([...TARGET_APPS], ["api", "tenant-web", "platform-web"]);
  assert.equal(MODULE_SLICES["question-bank"], "question-bank");
  assert.equal(Object.keys(MODULE_SLICES).length, 21);
});
