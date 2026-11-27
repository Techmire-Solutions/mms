#!/usr/bin/env node
// Gate: the release artifact ships every build output the monorepo produces.
//
// Acceptance criterion 7 says `mms-dist.tar.gz` contains `apps/api/dist`, both web dists and every package
// `dist`. `scripts/ci/package-dist.sh` assembles it and already fails on a missing module dist and on a
// shipped `.map`, but nothing verified the *set*: a new dist-emitting package, or an edit that drops a path,
// would only surface in a deploy.
//
// Two levels, both fail-closed:
//   1. static — every workspace package whose build writes `dist` must be covered by the packaging script
//      (listed in DIST_PATHS, or a `packages/modules/*` path covered by the script's module loop);
//   2. deep — when `mms-dist.tar.gz` exists, its member list must contain each of those paths and no `*.map`.
//
// Usage: node scripts/check-deploy-artifact.mjs [--json]

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { ROOT } from "./lib/repo-paths.mjs";

const PACKAGER = path.join(ROOT, "scripts", "ci", "package-dist.sh");
const TARBALL = path.join(ROOT, "mms-dist.tar.gz");

/**
 * A build that writes files. `tsc --noEmit -p tsconfig.build.json` (as `@mms/ui` and `@mms/fe-core`
 * use) type-checks only: those packages are bundled into the SPAs at build time, so their dist is not
 * part of the runtime artifact.
 */
const EMITS_DIST = /tsconfig\.build\.json|vite build|tsup|rolldown/;
const TYPE_CHECK_ONLY = /--noEmit/;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** name -> package dir for every workspace manifest. */
function workspaceIndex(root = ROOT) {
  const index = new Map();
  const groups = ["apps", "packages", path.join("packages", "modules"), "tooling"];
  for (const group of groups) {
    const base = path.join(root, group);
    if (!fs.existsSync(base)) continue;
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "node_modules") continue;
      const manifest = path.join(base, entry.name, "package.json");
      if (!fs.existsSync(manifest)) continue;
      index.set(readJson(manifest).name, path.relative(root, path.join(base, entry.name)));
    }
  }
  return index;
}

function emitsDist(root, dir) {
  const manifest = path.join(root, dir, "package.json");
  if (!fs.existsSync(manifest)) return false;
  const build = readJson(manifest).scripts?.build ?? "";
  // A module's build is `tsc -p tsconfig.build.json && tsc --noEmit -p tsconfig.frontend.json`: the
  // first half emits, the second only type-checks. Judge each `&&` segment on its own.
  const emitting = build
    .split("&&")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && !TYPE_CHECK_ONLY.test(segment))
    .join(" && ");
  return EMITS_DIST.test(emitting);
}

/**
 * What the runtime artifact must contain: the API (which serves both SPA dists) and every workspace
 * package reachable from the API's runtime dependencies that emits a dist. Deriving it from the
 * dependency graph — rather than "everything that builds" — is what keeps bundled-only packages
 * (`@mms/ui`, `@mms/fe-core`) out of the tarball while still catching a new module that is imported at
 * runtime but never packaged.
 */
export function requiredRuntimeDists(root = ROOT) {
  const index = workspaceIndex(root);
  const required = new Set(
    ["apps/api", "apps/tenant-web", "apps/platform-web"].map((dir) => `${dir}/dist`),
  );

  const seen = new Set();
  const queue = ["apps/api"];
  while (queue.length > 0) {
    const dir = queue.pop();
    if (seen.has(dir)) continue;
    seen.add(dir);
    const manifest = path.join(root, dir, "package.json");
    if (!fs.existsSync(manifest)) continue;
    for (const name of Object.keys(readJson(manifest).dependencies ?? {})) {
      const dependencyDir = index.get(name);
      if (!dependencyDir || seen.has(dependencyDir)) continue;
      queue.push(dependencyDir);
      if (emitsDist(root, dependencyDir)) required.add(`${dependencyDir}/dist`);
    }
  }
  return [...required].sort();
}

/** Paths the packaging script archives, read from the script so the gate follows edits to it. */
export function packagedPaths(scriptText) {
  const paths = new Set();
  const listBlock = scriptText.match(/DIST_PATHS=\(([\s\S]*?)\)/);
  if (listBlock) {
    for (const line of listBlock[1].split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      paths.add(trimmed.replace(/^["']|["']$/g, ""));
    }
  }
  const moduleLoop = /for\s+mod_dir\s+in\s+packages\/modules\/\*/.test(scriptText);
  return { paths, moduleLoop };
}

function tarballMembers() {
  if (!fs.existsSync(TARBALL)) return null;
  return execFileSync("tar", ["tzf", TARBALL], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\n")
    .filter(Boolean);
}

export function findUncovered(distPaths, packaged) {
  const missing = [];
  for (const distPath of distPaths) {
    const owner = distPath.replace(/\/dist$/, "");
    const coveredByLoop =
      packaged.moduleLoop && owner.startsWith(path.join("packages", "modules") + path.sep);
    if (packaged.paths.has(distPath) || coveredByLoop) continue;
    missing.push(distPath);
  }
  return missing;
}

function main() {
  const json = process.argv.includes("--json");
  if (!fs.existsSync(PACKAGER)) {
    console.error(
      "✗ scripts/ci/package-dist.sh is missing — the release artifact has no assembler",
    );
    process.exitCode = 1;
    return;
  }

  const packaged = packagedPaths(fs.readFileSync(PACKAGER, "utf8"));
  const requiredDists = requiredRuntimeDists();
  const uncovered = findUncovered(requiredDists, packaged);

  const members = tarballMembers();
  const absentFromTarball = [];
  const mapsInTarball = [];
  if (members) {
    for (const distPath of requiredDists) {
      const normalized = distPath.replaceAll(path.sep, "/");
      const present = members.some(
        (member) => member === normalized || member.startsWith(`${normalized}/`),
      );
      if (!present) absentFromTarball.push(normalized);
    }
    for (const member of members) if (member.endsWith(".map")) mapsInTarball.push(member);
  }

  const failures = [
    ...uncovered.map((p) => `not packaged by scripts/ci/package-dist.sh: ${p}`),
    ...absentFromTarball.map((p) => `missing from mms-dist.tar.gz: ${p}`),
    ...mapsInTarball.slice(0, 5).map((p) => `source map shipped in the artifact: ${p}`),
  ];

  if (json) {
    process.stdout.write(
      `${JSON.stringify({ requiredDists: requiredDists.length, tarballChecked: members !== null, failures }, null, 2)}\n`,
    );
    process.exitCode = failures.length === 0 ? 0 : 1;
    return;
  }

  if (failures.length === 0) {
    const suffix = members
      ? ` and the ${members.length}-member tarball matches`
      : " (no tarball to inspect)";
    console.log(`✓ ${requiredDists.length} runtime dist(s) required and packaged${suffix}`);
  } else {
    console.error(`✗ release artifact is incomplete (${failures.length}):`);
    for (const failure of failures) console.error(`    ${failure}`);
    console.error(
      "\nFix: add the path to DIST_PATHS in scripts/ci/package-dist.sh (or keep the module loop covering it),\n" +
        "then rebuild and re-run `bash scripts/ci/package-dist.sh`.",
    );
  }
  process.exitCode = failures.length === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
