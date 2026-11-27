#!/usr/bin/env node
// Gate: every frontend "@mms/mod-<slice>/<subpath>" specifier an app imports resolves through that
// module's package.json exports map, with Node's semantics.
//
// Why this exists: a module's exports wildcard such as
//   "./frontend/tenant/lib/*": ["./src/frontend/tenant/lib/*.ts", "./src/frontend/tenant/lib/*.tsx"]
// does NOT fall through from the first pattern to the second when the file is missing: Node tries the
// first array entry and fails if that file is absent. So a .tsx file under a .ts-first wildcard is
// unreachable unless the package declares an explicit export for it. That bug shipped twice in the
// IAM module (lib/usersDescriptor, frontend/tenant/UsersPage) and surfaced as "Failed to resolve
// import" collection errors in whichever app imported it.
//
// Scope: the Vite apps and the modules' frontend trees. Backend imports are resolved by tsc through
// other mechanisms and are intentionally out of scope.
//
// Usage: node scripts/check-module-exports.mjs [--json] [--fix]
//   --fix writes the missing explicit exports entries into the offending package.json (additive only).

import fs from "node:fs";
import path from "node:path";

import { ROOT, EmptyScanError, IGNORED_DIRS, SOURCE_EXTENSIONS, toRel } from "./lib/repo-paths.mjs";

const SCAN_DIRS = ["apps/tenant-web/src", "apps/platform-web/src", "packages/modules"];
const SPECIFIER = /@mms\/mod-[a-z0-9-]+(?:\/[A-Za-z0-9._-]+)*/g;

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.includes(entry.name)) continue;
      walk(full, out);
      continue;
    }
    if (!SOURCE_EXTENSIONS.includes(path.extname(entry.name))) continue;
    if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

/** Every module import found under the scan roots, as <absolute file> -> Set<specifier>. */
export function collectModuleSpecifiers(roots = SCAN_DIRS) {
  const files = [];
  for (const rel of roots) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    walk(abs, files);
  }
  if (files.length === 0) throw new EmptyScanError("check-module-exports", roots.join(", "));

  const byFile = new Map();
  for (const file of files) {
    const rel = toRel(file);
    // Backend-side imports are out of scope (tsc resolves them, not the exports map).
    if (rel.includes("/backend/")) continue;
    const content = fs.readFileSync(file, "utf8");
    const found = new Set();
    for (const match of content.matchAll(SPECIFIER)) {
      const lineStart = content.lastIndexOf("\n", match.index) + 1;
      if (/^\s*(\*|\/\/)/.test(content.slice(lineStart, match.index))) continue;
      found.add(match[0]);
    }
    if (found.size > 0) byFile.set(file, found);
  }
  return byFile;
}

function readExports(slice) {
  const manifestPath = path.join(ROOT, "packages", "modules", slice, "package.json");
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return { dir: path.dirname(manifestPath), exports: manifest.exports ?? {} };
}

/**
 * Resolve one specifier against a module's exports map with Node's semantics: an array target is
 * tried in order, and a missing file at the first entry does not fall through.
 */
export function resolveSpecifier(specifier, moduleInfo) {
  if (!moduleInfo) return { ok: false, reason: "unknown module package" };
  const { dir, exports } = moduleInfo;
  const subpath = `.${specifier.slice(specifier.indexOf("/", 5))}`.replace(/^\.\/?\.?/, "./");
  const normalized = subpath.startsWith("./") ? subpath : `./${subpath}`;

  const keys = Object.keys(exports).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const star = key.indexOf("*");
    if (star === -1) {
      if (key !== normalized) continue;
      return targetMatches(dir, exports[key], null);
    }
    const prefix = key.slice(0, star);
    const suffix = key.slice(star + 1);
    if (!normalized.startsWith(prefix) || !normalized.endsWith(suffix)) continue;
    const captured = normalized.slice(prefix.length, normalized.length - suffix.length);
    return targetMatches(dir, exports[key], captured);
  }
  return { ok: false, reason: "subpath not exported" };
}

function firstTarget(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : null;
  if (value && typeof value === "object") {
    for (const key of ["import", "browser", "default", "types"]) {
      if (typeof value[key] === "string") return value[key];
    }
  }
  return null;
}

function targetMatches(dir, value, captured) {
  const target = firstTarget(value);
  if (!target) return { ok: true }; // nothing file-shaped to check
  const candidate = captured === null ? target : target.replace(/\*/g, captured);
  if (!candidate.startsWith(".")) return { ok: true };
  return fs.existsSync(path.join(dir, candidate))
    ? { ok: true }
    : {
        ok: false,
        reason: `first target ${candidate} does not exist (a later array entry is unreachable)`,
      };
}

export function findUnresolved(byFile, readModule = readExports) {
  const failures = [];
  for (const [file, specifiers] of byFile) {
    for (const specifier of specifiers) {
      const slice = specifier.slice("@mms/mod-".length).split("/")[0];
      const verdict = resolveSpecifier(specifier, readModule(slice));
      if (!verdict.ok) failures.push({ file: toRel(file), specifier, reason: verdict.reason });
    }
  }
  return failures.sort(
    (a, b) => a.file.localeCompare(b.file) || a.specifier.localeCompare(b.specifier),
  );
}

/**
 * Additive fixer: for a failing specifier whose real file is a `.tsx`, write
 *   "./<subpath>": "./src/<subpath>.tsx"
 * into that module's exports. Never rewrites existing keys, so it is safe to re-run after the
 * extraction regenerates a package.json.
 */
export function applyExplicitExports(failures, readModule = readExports) {
  const bySlice = new Map();
  for (const failure of failures) {
    const slice = failure.specifier.slice("@mms/mod-".length).split("/")[0];
    const subpath = failure.specifier.slice(`@mms/mod-${slice}/`.length);
    const info = readModule(slice);
    if (!info) continue;
    const tsxFile = path.join(info.dir, "src", `${subpath}.tsx`);
    if (!fs.existsSync(tsxFile)) continue;
    if (!bySlice.has(slice)) bySlice.set(slice, new Set());
    bySlice.get(slice).add(subpath);
  }

  const written = [];
  for (const [slice, subpaths] of bySlice) {
    const manifestPath = path.join(ROOT, "packages", "modules", slice, "package.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.exports ??= {};
    let changed = false;
    for (const subpath of subpaths) {
      const key = `./${subpath}`;
      if (manifest.exports[key]) continue;
      manifest.exports[key] = `./src/${subpath}.tsx`;
      changed = true;
      written.push(`packages/modules/${slice}/package.json  +=  "${key}": "./src/${subpath}.tsx"`);
    }
    if (changed) fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return written;
}

function main() {
  const json = process.argv.includes("--json");
  const fix = process.argv.includes("--fix");
  const byFile = collectModuleSpecifiers();
  let failures = findUnresolved(byFile);

  if (fix && failures.length > 0) {
    const written = applyExplicitExports(failures);
    for (const line of written) console.log(`fixed: ${line}`);
    if (written.length > 0) failures = findUnresolved(byFile);
  }

  if (json) {
    process.stdout.write(`${JSON.stringify({ files: byFile.size, failures }, null, 2)}\n`);
  } else if (failures.length === 0) {
    const count = [...byFile.values()].reduce((total, set) => total + set.size, 0);
    console.log(
      `✓ every @mms/mod-* frontend specifier resolves (${count} imports in ${byFile.size} files)`,
    );
  } else {
    console.error(`✗ ${failures.length} unresolvable @mms/mod-* frontend specifier(s):`);
    for (const { file, specifier, reason } of failures)
      console.error(`    ${file}\n      ${specifier}\n      ${reason}`);
    console.error(
      "\nFix: add an explicit exports entry in the module package.json for that subpath, or import\n" +
        "the path the map already exports.",
    );
  }
  process.exitCode = failures.length === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    if (error instanceof EmptyScanError) {
      console.error(`✗ ${error.message}`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
