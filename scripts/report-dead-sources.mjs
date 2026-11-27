#!/usr/bin/env node
/**
 * Dead-source report for an app: which files can the entry graph actually reach?
 *
 * The migration leaves superseded trees behind (a copied console, a feature that moved
 * into `@mms/mod-*`, providers nobody mounts). Those files still cost builds, tests and
 * ratchet coverage, but nothing tells you they are unreachable — `tsc` only sees what the
 * graph imports and ESLint scans whatever the config globs.
 *
 * This walks the real import graph from `src/main.tsx` and reports the unreachable files.
 * It is a REPORT, not a gate: the counts are large while a tree is mid-deprecation, so
 * failing on them would block every PR. Promote the numbers to a ratchet only after a
 * prune, when the remainder is genuinely zero.
 *
 * Resolution: `@/x` → `src/x`, `./x` → relative, with `.ts/.tsx/index.*` candidates.
 * Edges counted: `import … from`, bare `import "…"`, `import(…)`, `export * from`,
 * `export {…} from`.
 * Bare package specifiers are out of scope (their sources live in other packages).
 *
 * Usage:
 *   node scripts/report-dead-sources.mjs                 # every app under apps/
 *   node scripts/report-dead-sources.mjs --app platform-web
 *   node scripts/report-dead-sources.mjs --json
 *   node scripts/report-dead-sources.mjs --quiet-window 10   # warn when the tree is being edited
 *   node scripts/report-dead-sources.mjs --quiet-window 10 --require-quiet  # exit 2 if active
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];
const SOURCE = /\.(ts|tsx)$/;
const TEST = /\.(test|spec)\.(ts|tsx)$/;
// `import "./side-effect"` has no `from` clause and is easy to miss — it must count too.
const IMPORT_EDGE =
  /(?:from\s+|import\s*\(\s*|import\s+|export\s+(?:\*|\{[^}]*\})\s+from\s+)["']([^"']+)["']/g;

function walkTests(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") walkTests(target, out);
    } else if (TEST.test(entry.name)) {
      out.push(target);
    }
  }
  return out;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") walk(target, out);
    } else if (SOURCE.test(entry.name) && !TEST.test(entry.name)) {
      out.push(target);
    }
  }
  return out;
}

function resolveSpecifier(fromFile, specifier, srcRoot) {
  let base;
  if (specifier.startsWith("@/")) base = path.join(srcRoot, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(fromFile), specifier);
  else return null; // bare package — another workspace package owns it
  for (const extension of EXTENSIONS) {
    const candidate = base + extension;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function reachableFrom(roots, srcRoot) {
  const seen = new Set();
  const queue = [...roots];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(IMPORT_EDGE)) {
      const resolved = resolveSpecifier(file, match[1], srcRoot);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return seen;
}

/** Content hash of every source file outside `excludeDir`, used to prove a copy is redundant. */
function contentIndex(repoRoot, excludeDir) {
  const index = new Map();
  const skip = new Set([
    "node_modules",
    "dist",
    "coverage",
    ".turbo",
    ".git",
    ".worktrees",
    "archive",
  ]);
  const walkAll = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skip.has(entry.name) && !target.startsWith(excludeDir)) walkAll(target);
        continue;
      }
      if (!SOURCE.test(entry.name) || TEST.test(entry.name)) continue;
      const key = crypto.createHash("sha1").update(fs.readFileSync(target)).digest("hex");
      if (!index.has(key)) index.set(key, target);
    }
  };
  walkAll(repoRoot);
  return index;
}

/**
 * Counts source files modified within `minutes` under the given roots. A dead-file sweep is only
 * meaningful against a quiescent tree: while a module extraction is rewriting imports, files look
 * dead for a moment and a cascade can make a whole cluster look unreachable (see P12c).
 */
export function recentlyModified(roots, { repoRoot = ROOT, minutes = 0, now = Date.now() } = {}) {
  if (!minutes) return 0;
  const cutoff = now - minutes * 60_000;
  let count = 0;
  const skip = new Set(["node_modules", "dist", "coverage", ".turbo", ".git", ".worktrees"]);
  const walkAll = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) walkAll(target);
        continue;
      }
      if (!SOURCE.test(entry.name)) continue;
      if (fs.statSync(target).mtimeMs >= cutoff) count++;
    }
  };
  for (const root of roots) walkAll(path.join(repoRoot, root));
  return count;
}

/** Files named by the app's build/test/tool configs (they are loaded by path, not by import). */
function collectConfigReferenced(srcRoot, appDir) {
  const referenced = new Set();
  let entries = [];
  try {
    entries = fs.readdirSync(appDir).filter((name) => /\.config\.[cm]?[jt]s$/.test(name));
  } catch {
    return referenced;
  }
  for (const name of entries) {
    const text = fs.readFileSync(path.join(appDir, name), "utf8");
    for (const match of text.matchAll(/["'`](\.{1,2}\/[^"'`]+\.(?:ts|tsx|mjs|cjs))["'`]/g)) {
      referenced.add(path.resolve(appDir, match[1]));
    }
  }
  return referenced;
}

function groupByTopDir(files, srcRoot) {
  const groups = {};
  for (const file of files) {
    const key = path.relative(srcRoot, file).split(path.sep)[0] ?? ".";
    groups[key] = (groups[key] ?? 0) + 1;
  }
  return Object.entries(groups).sort((a, b) => b[1] - a[1]);
}

export function analyseApp(appDir, options = {}) {
  const srcRoot = path.join(appDir, "src");
  const entry = path.join(srcRoot, "main.tsx");
  const all = walk(srcRoot);
  if (!fs.existsSync(entry)) return { app: path.basename(appDir), error: "no src/main.tsx" };
  const reachable = reachableFrom([entry], srcRoot);
  // A file the app never routes may still be imported by a test (or only by tests). Counting the
  // test graphs separately keeps the "safe to delete" set honest instead of flagging test fixtures.
  const testRoots = walkTests(srcRoot);
  const reachableFromTests = reachableFrom(testRoots, srcRoot);
  // Config-referenced files are invisible to an import graph: `vitest.config.ts` names
  // `src/test/setup.ts` by path, and a Vite config imports `src/lib/vendorChunks.ts`. Round 46 deleted
  // `src/test/setup.ts` as "dead" and took the whole platform suite down, so the dead set excludes
  // anything a config names or any file under a test-support directory.
  const configReferenced = collectConfigReferenced(srcRoot, appDir);
  const isConfigOrSupport = (file) =>
    configReferenced.has(file) ||
    file.includes(`${path.sep}src${path.sep}test${path.sep}`) ||
    file.endsWith(".d.ts");
  const dead = all.filter(
    (file) => !reachable.has(file) && !reachableFromTests.has(file) && !isConfigOrSupport(file),
  );
  const unrouted = all.filter((file) => !reachable.has(file));
  let duplicates = null;
  if (options.duplicates) {
    const index = contentIndex(options.repoRoot ?? ROOT, srcRoot);
    const deadSet = new Set(dead);
    duplicates = { copied: [], unique: [] };
    for (const file of unrouted) {
      const key = crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex");
      const twin = index.get(key);
      // `dead` says whether the file is unreachable from the app *and* every test. Only a dead AND
      // byte-identical copy is safe to delete; an unrouted file that a test still imports is not
      // (round 46 deleted ten such files and had to restore them).
      if (twin) duplicates.copied.push({ file, twin, dead: deadSet.has(file) });
      else duplicates.unique.push(file); // stays a string: existing callers expect paths
    }
  }
  return {
    app: path.basename(appDir),
    total: all.length,
    reachable: all.length - dead.length,
    unreachable: dead.length,
    unreachableFromAppOnly: unrouted.length,
    // The deletable set: unreachable from the app *and* from every test. Callers that prune must use
    // this, not `unreachableFromAppOnly` — a test-only import is still a live reference.
    dead: dead.map((file) => path.relative(options.repoRoot ?? ROOT, file)),
    duplicates,
    unreachableByDir: groupByTopDir(dead, srcRoot),
    reachableByDir: groupByTopDir(
      all.filter((file) => reachable.has(file)),
      srcRoot,
    ),
  };
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const windowIndex = args.indexOf("--quiet-window");
  const quietWindow = windowIndex >= 0 ? Number.parseInt(args[windowIndex + 1] ?? "0", 10) : 0;
  const appIndex = args.indexOf("--app");
  const appsDir = path.join(ROOT, "apps");
  const apps =
    appIndex >= 0
      ? [path.join(appsDir, args[appIndex + 1] ?? "")]
      : fs
          .readdirSync(appsDir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => path.join(appsDir, entry.name));

  const duplicates = args.includes("--duplicates");
  const reports = apps
    .filter((dir) => fs.existsSync(path.join(dir, "src")))
    .map((dir) => analyseApp(dir, { duplicates }));
  const recent = quietWindow ? recentlyModified(["apps", "packages"], { minutes: quietWindow }) : 0;
  const requireQuiet = args.includes("--require-quiet");
  const verdict = quietWindow
    ? `
Quiescence check: ${recent} source files changed in the last ${quietWindow} min ` +
      (recent === 0
        ? "(tree is quiet — a prune can rely on this report)"
        : "(tree is ACTIVE — wait before pruning; a concurrent move makes files look dead)")
    : "";

  if (json) {
    // Apps without a `src/main.tsx` (e.g. the backend) have no client entry graph to walk.
    console.log(
      JSON.stringify(
        {
          quietWindowMinutes: quietWindow,
          recentlyModified: recent,
          apps: reports.filter((r) => !r.error),
        },
        null,
        2,
      ),
    );
    return 0;
  }

  for (const report of reports) {
    if (report.error) {
      console.log(`${report.app}: skipped (${report.error})`);
      continue;
    }
    const pct = report.total === 0 ? 0 : Math.round((report.unreachable / report.total) * 100);
    console.log(
      `\n${report.app}: ${report.total} source files · unreachable from app entry ` +
        `${report.unreachableFromAppOnly} · unreachable from app *and* every test ` +
        `${report.unreachable} (${pct}% dead)`,
    );
    for (const [dir, count] of report.unreachableByDir.slice(0, 10)) {
      console.log(`  ${String(count).padStart(5)}  ${dir}/`);
    }
    if (report.duplicates) {
      const { copied, unique } = report.duplicates;
      console.log(
        `  content check: ${copied.length} unrouted files are byte-identical to a file elsewhere ` +
          `(safe to delete), ${unique.length} have no twin (review before deleting)`,
      );
    }
  }
  if (verdict) console.log(verdict);
  if (requireQuiet && recent > 0) {
    console.error(
      `\n✗ --require-quiet: ${recent} source files changed in the last ${quietWindow} min; ` +
        "a prune against an active tree can delete files whose imports are being rewritten.",
    );
    return 2;
  }
  console.log(
    "\nReport only — this is not a gate. Prune an app's dead tree, then re-run to confirm zero.",
  );
  return 0;
}

const isEntrypoint =
  typeof process.argv[1] === "string" && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntrypoint) process.exitCode = main();
