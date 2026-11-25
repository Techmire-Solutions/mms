#!/usr/bin/env node
/**
 * Topology ratchet (migration plan P0/P9, acceptance criterion 1).
 *
 * The move ledger (`scripts/check-move-manifest.mjs`) tracks *declared* moves.
 * This gate catches *undeclared* topology drift — the half-created directory that
 * no ledger entry mentions and no import breaks on yet:
 *
 *   - an app root that is not one of the declared transitional/target apps;
 *   - a package that is not `@mms/<dir>`, or a module that is not
 *     `@mms/mod-<slice>` (lowercase — npm rejects uppercase package names, so a
 *     camelCase module id such as `questionBank` must not leak into the name);
 *   - a module directory without `package.json`, `src/`, or an audience folder;
 *   - a module package with a root export (`"."`) — D13 bans it, because a root
 *     barrel lets a frontend app pull backend code;
 *   - a missing/renamed `pnpm-workspace.yaml` glob (a dropped glob silently removes
 *     a package from `turbo run`, the build and every ratchet);
 *   - a missing `apps/`, `packages/` or `tooling/` tree (fail closed).
 *
 *   node scripts/check-topology.mjs
 *   node scripts/check-topology.mjs --json
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/repo-paths.mjs";

/** Transitional app roots and the target roots that replace them (D6/D11). */
export const TRANSITIONAL_APPS = Object.freeze(["backend", "frontend"]);
export const TARGET_APPS = Object.freeze(["api", "tenant-web", "platform-web"]);

/** Flat package directories under `packages/`. */
export const FLAT_PACKAGES = Object.freeze(["contracts", "db", "be-core", "fe-core", "ui"]);

/**
 * Declared module slices: directory name → npm leaf (`@mms/mod-<leaf>`).
 * `moduleId` (persisted identity) may differ in casing — `question-bank` ships the
 * `questionBank` module id — but the *package name* must stay lowercase.
 */
export const MODULE_SLICES = Object.freeze({
  iam: "iam",
  billing: "billing",
  analytics: "analytics",
  contacts: "contacts",
  students: "students",
  faculty: "faculty",
  sessions: "sessions",
  attendance: "attendance",
  enrollments: "enrollments",
  examinations: "examinations",
  "question-bank": "question-bank",
  hasanat: "hasanat",
  workshops: "workshops",
  accounting: "accounting",
  obligations: "obligations",
  messaging: "messaging",
  tasks: "tasks",
  notifications: "notifications",
  documents: "documents",
  audit: "audit",
  workspace: "workspace",
  platform: "platform",
});

export const TOOLING_PACKAGES = Object.freeze([
  "eslint-config",
  "typescript-config",
  "tailwind-config",
]);

/** Workspace globs that must stay present in `pnpm-workspace.yaml`. */
export const REQUIRED_WORKSPACE_GLOBS = Object.freeze([
  "apps/*",
  "packages/*",
  "packages/modules/*",
  "tooling/*",
  "e2e",
]);

const APP_PACKAGE_RE = /^mms-[a-z][a-z0-9-]*$/;
const MODULE_PACKAGE_RE = /^@mms\/mod-[a-z][a-z0-9-]*$/;
const PACKAGE_JSON = "package.json";

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const isDir = (dir) => {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
};
const listDirs = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();

/**
 * Evaluate the topology under `root`. Exported for `scripts/ci/topology.test.mjs`.
 * @param {{ root?: string }} [options]
 * @returns {{ errors: string[], summary: Record<string, unknown> }}
 */
export function evaluateTopology({ root = ROOT } = {}) {
  const errors = [];
  const summary = {};

  for (const required of ["apps", "packages", "packages/modules", "tooling"]) {
    if (!isDir(path.join(root, required))) errors.push(`missing directory: ${required}/`);
  }
  const workspaceFile = path.join(root, "pnpm-workspace.yaml");
  if (!fs.existsSync(workspaceFile)) {
    errors.push("missing pnpm-workspace.yaml (workspace membership is authoritative)");
  } else {
    const workspace = fs.readFileSync(workspaceFile, "utf8");
    for (const glob of REQUIRED_WORKSPACE_GLOBS) {
      // The glob is matched as literal YAML text, so escape every regex metacharacter.
      const literal = glob.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`^\\s*-\\s*["']?${literal}["']?\\s*$`, "m").test(workspace)) {
        errors.push(`pnpm-workspace.yaml is missing the "${glob}" glob`);
      }
    }
  }

  // ── apps ────────────────────────────────────────────────────────────────────
  const allowedApps = new Set([...TRANSITIONAL_APPS, ...TARGET_APPS]);
  if (isDir(path.join(root, "apps"))) {
    summary.apps = listDirs(path.join(root, "apps"));
    for (const app of summary.apps) {
      if (!allowedApps.has(app)) errors.push(`undeclared app root: apps/${app}`);
      const manifest = path.join(root, "apps", app, PACKAGE_JSON);
      if (!fs.existsSync(manifest)) {
        errors.push(`apps/${app} has no ${PACKAGE_JSON}`);
        continue;
      }
      let pkg;
      try {
        pkg = readJson(manifest);
      } catch (error) {
        errors.push(`apps/${app}/${PACKAGE_JSON} is invalid JSON: ${error.message}`);
        continue;
      }
      if (!APP_PACKAGE_RE.test(pkg.name ?? "")) {
        errors.push(`apps/${app} must be named mms-<kebab> (got "${pkg.name}")`);
      }
      if (!isDir(path.join(root, "apps", app, "src"))) errors.push(`apps/${app} has no src/`);
    }
  }

  // ── flat packages ───────────────────────────────────────────────────────────
  if (isDir(path.join(root, "packages"))) {
    const packageDirs = listDirs(path.join(root, "packages"));
    summary.packages = packageDirs.filter((dir) => dir !== "modules");
    for (const dir of packageDirs) {
      if (dir === "modules") continue;
      if (!FLAT_PACKAGES.includes(dir)) errors.push(`undeclared package: packages/${dir}`);
      const manifest = path.join(root, "packages", dir, PACKAGE_JSON);
      if (!fs.existsSync(manifest)) {
        errors.push(`packages/${dir} has no ${PACKAGE_JSON}`);
        continue;
      }
      let pkg;
      try {
        pkg = readJson(manifest);
      } catch (error) {
        errors.push(`packages/${dir}/${PACKAGE_JSON} is invalid JSON: ${error.message}`);
        continue;
      }
      if (pkg.name !== `@mms/${dir}`) {
        errors.push(`packages/${dir} must be named @mms/${dir} (got "${pkg.name}")`);
      }
    }
  }

  // ── module packages ─────────────────────────────────────────────────────────
  const modulesRoot = path.join(root, "packages", "modules");
  if (isDir(modulesRoot)) {
    const slices = listDirs(modulesRoot);
    summary.modules = slices;
    for (const slice of slices) {
      const moduleDir = path.join(modulesRoot, slice);
      if (!(slice in MODULE_SLICES)) {
        errors.push(`undeclared module slice: packages/modules/${slice}`);
      }
      const manifest = path.join(moduleDir, PACKAGE_JSON);
      if (!fs.existsSync(manifest)) {
        errors.push(`packages/modules/${slice} has no ${PACKAGE_JSON} (half-created module?)`);
        continue;
      }
      let pkg;
      try {
        pkg = readJson(manifest);
      } catch (error) {
        errors.push(`packages/modules/${slice}/${PACKAGE_JSON} is invalid JSON: ${error.message}`);
        continue;
      }
      if (!MODULE_PACKAGE_RE.test(pkg.name ?? "")) {
        errors.push(
          `packages/modules/${slice} must be named @mms/mod-<kebab> — lowercase only (got "${pkg.name}")`,
        );
      }
      if (slice in MODULE_SLICES && pkg.name !== `@mms/mod-${MODULE_SLICES[slice]}`) {
        errors.push(
          `packages/modules/${slice} must be named @mms/mod-${MODULE_SLICES[slice]} (got "${pkg.name}")`,
        );
      }
      const exportsMap = pkg.exports ?? {};
      if (Object.prototype.hasOwnProperty.call(exportsMap, ".")) {
        errors.push(`packages/modules/${slice} must not export "." — audiences are explicit (D13)`);
      }
      if (!isDir(path.join(moduleDir, "src"))) {
        errors.push(`packages/modules/${slice} has no src/`);
        continue;
      }
      const audiences = ["shared", "backend", "frontend"].filter((audience) =>
        isDir(path.join(moduleDir, "src", audience)),
      );
      if (audiences.length === 0) {
        errors.push(`packages/modules/${slice}/src has no shared|backend|frontend audience`);
      }
    }
  }

  // ── tooling ─────────────────────────────────────────────────────────────────
  if (isDir(path.join(root, "tooling"))) {
    const tooling = listDirs(path.join(root, "tooling"));
    summary.tooling = tooling;
    for (const dir of tooling) {
      if (!TOOLING_PACKAGES.includes(dir))
        errors.push(`undeclared tooling package: tooling/${dir}`);
      const manifest = path.join(root, "tooling", dir, PACKAGE_JSON);
      if (!fs.existsSync(manifest)) {
        errors.push(`tooling/${dir} has no ${PACKAGE_JSON}`);
        continue;
      }
      let pkg;
      try {
        pkg = readJson(manifest);
      } catch (error) {
        errors.push(`tooling/${dir}/${PACKAGE_JSON} is invalid JSON: ${error.message}`);
        continue;
      }
      if (pkg.name !== `@mms/${dir}`) {
        errors.push(`tooling/${dir} must be named @mms/${dir} (got "${pkg.name}")`);
      }
    }
    for (const required of TOOLING_PACKAGES) {
      if (!tooling.includes(required)) errors.push(`missing tooling package: tooling/${required}`);
    }
  }

  summary.transitionalApps = (summary.apps ?? []).filter((app) => TRANSITIONAL_APPS.includes(app));
  summary.targetApps = (summary.apps ?? []).filter((app) => TARGET_APPS.includes(app));
  return { errors, summary };
}

function main() {
  const { errors, summary } = evaluateTopology();
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ summary, errors }, null, 2)}\n`);
  } else {
    console.log("Topology ratchet");
    console.log(
      `  apps: ${summary.apps?.length ?? 0} (transitional: ${summary.transitionalApps?.join(", ") || "none"}; ` +
        `target: ${summary.targetApps?.join(", ") || "none"})`,
    );
    console.log(`  packages: ${summary.packages?.join(", ") ?? "none"}`);
    console.log(`  modules: ${summary.modules?.join(", ") ?? "none"}`);
    console.log(`  tooling: ${summary.tooling?.join(", ") ?? "none"}`);
  }
  if (errors.length > 0) {
    for (const error of errors) console.error(`::error::${error}`);
    console.error(`\n✗ Topology drift (${errors.length} issue(s)).`);
    process.exit(1);
  }
  console.log(`\n✓ Topology matches the declared transitional + target layout.`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
