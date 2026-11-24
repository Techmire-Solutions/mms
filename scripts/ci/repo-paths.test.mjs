import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EmptyScanError,
  PATHS,
  ROOT,
  assertAnyScanDir,
  assertExistingPaths,
  assertScanDirs,
  countSourceFiles,
  fromRoot,
  hasAnySourceFile,
  moduleDir,
  toRel,
} from "../lib/repo-paths.mjs";

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "mms-repo-paths-"));
const write = (dir, rel, content = "export const x = 1;\n") => {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
};

test("ROOT resolves to the repository that owns pnpm-workspace.yaml", () => {
  assert.ok(fs.existsSync(path.join(ROOT, "pnpm-workspace.yaml")));
  assert.equal(ROOT, path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
});

test("PATHS exposes transitional and target roots under ROOT", () => {
  for (const [key, value] of Object.entries(PATHS)) {
    assert.ok(path.isAbsolute(value), `${key} must be absolute`);
    assert.ok(value.startsWith(ROOT), `${key} must live under ROOT`);
  }
  assert.equal(PATHS.backend, fromRoot("apps", "backend"));
  assert.equal(moduleDir("contacts"), fromRoot("packages", "modules", "contacts"));
});

test("toRel renders POSIX paths relative to ROOT", () => {
  assert.equal(toRel(fromRoot("apps", "backend", "src")), "apps/backend/src");
});

test("hasAnySourceFile is false for a missing or empty directory", () => {
  const dir = tempDir();
  assert.equal(hasAnySourceFile(path.join(dir, "missing")), false);
  assert.equal(hasAnySourceFile(dir), false);
});

test("hasAnySourceFile finds sources recursively and skips generated dirs", () => {
  const dir = tempDir();
  write(dir, "node_modules/pkg/index.ts");
  assert.equal(hasAnySourceFile(dir), false, "node_modules must be ignored");
  write(dir, "src/nested/deep.tsx");
  assert.equal(hasAnySourceFile(dir), true);
  assert.equal(countSourceFiles(dir), 1);
});

test("hasAnySourceFile honours a narrower extension filter", () => {
  const dir = tempDir();
  write(dir, "src/index.mjs");
  assert.equal(hasAnySourceFile(dir, { extensions: [".ts"] }), false);
  assert.equal(hasAnySourceFile(dir, { extensions: [".mjs"] }), true);
});

test("assertScanDirs throws EmptyScanError for a missing directory", () => {
  const dir = tempDir();
  assert.throws(
    () => assertScanDirs([path.join(dir, "gone")], "unit"),
    (error) => error instanceof EmptyScanError && error.missing.length === 1,
  );
});

test("assertScanDirs throws EmptyScanError for a directory with no sources", () => {
  const dir = tempDir();
  fs.mkdirSync(path.join(dir, "src"));
  assert.throws(
    () => assertScanDirs({ "unit root": path.join(dir, "src") }, "unit"),
    (error) => error instanceof EmptyScanError && error.empty.length === 1,
  );
});

test("assertScanDirs passes when every directory has sources", () => {
  const dir = tempDir();
  write(dir, "a/index.ts");
  write(dir, "b/index.tsx");
  assert.doesNotThrow(() =>
    assertScanDirs({ a: path.join(dir, "a"), b: path.join(dir, "b") }, "unit"),
  );
});

test("assertExistingPaths reports every missing path at once", () => {
  const dir = tempDir();
  assert.throws(
    () => assertExistingPaths([path.join(dir, "one"), path.join(dir, "two")], "unit"),
    (error) => error instanceof EmptyScanError && error.missing.length === 2,
  );
});

test("assertAnyScanDir passes when a single root is populated", () => {
  const dir = tempDir();
  fs.mkdirSync(path.join(dir, "empty"));
  write(dir, "live/index.ts");
  assert.doesNotThrow(() =>
    assertAnyScanDir([path.join(dir, "empty"), path.join(dir, "live")], "unit"),
  );
});

test("assertAnyScanDir fails when no root is populated", () => {
  const dir = tempDir();
  fs.mkdirSync(path.join(dir, "empty"));
  assert.throws(
    () => assertAnyScanDir([path.join(dir, "empty"), path.join(dir, "gone")], "unit"),
    (error) => error instanceof EmptyScanError,
  );
});

test("EmptyScanError message names the gate and the fix", () => {
  const error = new EmptyScanError("frontend structure", { empty: ["apps/frontend/src"] });
  assert.match(error.message, /Fail-closed scan for frontend structure/);
  assert.match(error.message, /no source files: apps\/frontend\/src/);
  assert.match(error.message, /repo-paths\.mjs/);
});
