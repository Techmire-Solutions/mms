#!/usr/bin/env node
/**
 * Repository path SSOT and fail-closed scan guards.
 *
 * Every ratchet that "scans a directory" must fail when the directory is missing
 * or empty. A gate that reports success because it scanned nothing is worse than
 * no gate: it silently retires an invariant. The migration plan
 * (`docs/monorepo-migration-plan.md` §2.7, U1/U2, R1) moves four roots, so each
 * gate imports its scan roots from here and wraps them in `assertScanDirs`.
 *
 * Transitional and target roots (`apps/api`, `apps/tenant-web`, `apps/platform-web`)
 * live in `PATHS`, so
 * a rename is a one-line change in this file rather than a grep across ~25
 * scripts.
 *
 * Usage:
 *   import { PATHS, assertScanDirs } from "./lib/repo-paths.mjs";
 *   assertScanDirs([FE_SRC, FEATURES_DIR], "frontend structure");
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Absolute repository root, derived from this file (independent of `process.cwd()`). */
export const ROOT = path.resolve(HERE, "..", "..");

const at = (...segments) => path.join(ROOT, ...segments);

/** Absolute roots. Transitional and target roots coexist until P9. */
export const PATHS = Object.freeze({
  apps: at("apps"),
  api: at("apps", "api"),
  backend: at("apps", "backend"),
  tenantWeb: at("apps", "tenant-web"),
  platformWeb: at("apps", "platform-web"),
  packages: at("packages"),
  contracts: at("packages", "contracts"),
  db: at("packages", "db"),
  beCore: at("packages", "be-core"),
  feCore: at("packages", "fe-core"),
  ui: at("packages", "ui"),
  modules: at("packages", "modules"),
  tooling: at("tooling"),
  e2e: at("e2e"),
  scripts: at("scripts"),
  docs: at("docs"),
});

export const SOURCE_EXTENSIONS = Object.freeze([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
/** Directory names never scanned: build output and dependencies. */
export const IGNORED_DIRS = Object.freeze(["node_modules", "dist", ".turbo"]);

/** Thrown when a gate's scan set is empty — always a gate bug, never a pass. */
export class EmptyScanError extends Error {
  /**
   * @param {string} label Gate name, e.g. "frontend structure".
   * @param {{ missing?: string[], empty?: string[] }} detail Repo-relative offenders.
   */
  constructor(label, { missing = [], empty = [] } = {}) {
    const parts = [];
    if (missing.length) parts.push(`missing: ${missing.join(", ")}`);
    if (empty.length) parts.push(`no source files: ${empty.join(", ")}`);
    super(
      `Fail-closed scan for ${label} — ${parts.join("; ")}. ` +
        "A ratchet that scans nothing must fail, not report success. Update the scan roots in " +
        "scripts/lib/repo-paths.mjs when a directory moves (docs/monorepo-migration-plan.md U1/U2).",
    );
    this.name = "EmptyScanError";
    this.label = label;
    this.missing = missing;
    this.empty = empty;
  }
}

/** Absolute path from repository-relative segments. */
export function fromRoot(...segments) {
  return at(...segments);
}

/** Absolute package directory for a module slice (`packages/modules/<slice>`). */
export function moduleDir(slice) {
  return at("packages", "modules", slice);
}

/** POSIX-style repo-relative path (stable in reports and baselines). */
export function toRel(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

const isIgnoredDir = (name, extraIgnored) =>
  IGNORED_DIRS.includes(name) || name.startsWith("coverage") || extraIgnored.includes(name);

/**
 * True when `dir` exists and contains at least one file with an allowed extension.
 * Stops at the first match; ignored directories are skipped.
 */
export function hasAnySourceFile(dir, { extensions = SOURCE_EXTENSIONS, extraIgnored = [] } = {}) {
  let stat;
  try {
    stat = fs.statSync(dir);
  } catch {
    return false;
  }
  if (!stat.isDirectory()) return false;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isIgnoredDir(entry.name, extraIgnored)) continue;
      if (hasAnySourceFile(full, { extensions, extraIgnored })) return true;
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      return true;
    }
  }
  return false;
}

/** Full recursive count of source files under `dir` (reporting only). */
export function countSourceFiles(dir, { extensions = SOURCE_EXTENSIONS, extraIgnored = [] } = {}) {
  let stat;
  try {
    stat = fs.statSync(dir);
  } catch {
    return 0;
  }
  if (!stat.isDirectory()) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isIgnoredDir(entry.name, extraIgnored)) continue;
      count += countSourceFiles(full, { extensions, extraIgnored });
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      count += 1;
    }
  }
  return count;
}

/**
 * Normalize the accepted scan-set shapes into `{ label, dir }` pairs.
 * Accepts an array of absolute dirs, an object map `{ label: dir }`, or an
 * array of `{ label, dir }` objects.
 */
function normalizeScanSet(input) {
  if (Array.isArray(input)) {
    return input.map((item) =>
      typeof item === "string"
        ? { label: toRel(item), dir: item }
        : { label: item.label, dir: item.dir },
    );
  }
  return Object.entries(input).map(([label, dir]) => ({ label, dir }));
}

/**
 * Fail unless every entry exists and contains at least one source file.
 * @param {string[] | Record<string, string> | Array<{label: string, dir: string}>} input
 * @param {string} label Gate name used in the error message.
 * @param {{ extensions?: string[], extraIgnored?: string[] }} [options]
 */
export function assertScanDirs(input, label, options = {}) {
  const missing = [];
  const empty = [];
  for (const { label: name, dir } of normalizeScanSet(input)) {
    if (!fs.existsSync(dir)) {
      missing.push(`${name} (${toRel(dir)})`);
      continue;
    }
    if (!hasAnySourceFile(dir, options)) empty.push(`${name} (${toRel(dir)})`);
  }
  if (missing.length || empty.length) throw new EmptyScanError(label, { missing, empty });
}

/**
 * Fail unless every entry exists (used when the files themselves are the scan
 * set — e.g. a fixed list of config files rather than a directory).
 */
export function assertExistingPaths(input, label) {
  const missing = normalizeScanSet(input)
    .filter(({ dir }) => !fs.existsSync(dir))
    .map(({ label: name, dir }) => `${name} (${toRel(dir)})`);
  if (missing.length) throw new EmptyScanError(label, { missing });
}

/**
 * Fail unless at least one entry contains source files (for gates that scan a
 * family of roots and may legitimately have retired some of them).
 */
export function assertAnyScanDir(input, label, options = {}) {
  const entries = normalizeScanSet(input);
  const missing = [];
  let populated = 0;
  for (const { label: name, dir } of entries) {
    if (!fs.existsSync(dir)) {
      missing.push(`${name} (${toRel(dir)})`);
      continue;
    }
    if (hasAnySourceFile(dir, options)) populated += 1;
  }
  if (populated === 0) {
    throw new EmptyScanError(label, {
      missing,
      empty: entries.map(({ label: n, dir }) => `${n} (${toRel(dir)})`),
    });
  }
}
