#!/usr/bin/env node
/**
 * Changed-file coverage gate.
 *
 * CI runs the unit suites with `--changed` on pull requests (fast), which
 * *skips* the sharded coverage gates entirely — so a PR could add untested
 * source and merge green. This gate closes that hole without paying for a full
 * suite: it looks only at the files the PR touched.
 *
 * Two independent failures:
 *   1. An ADDED source file with ≥ `--min-file-lines` executable lines that no
 *      executed test imports — the "new module shipped with no test" case.
 *      Modified files are exempt from this rule (a UI edit is not a new module).
 *   2. Aggregate line coverage of all changed files below `--min` (default 60%).
 *
 * Usage:
 *   node scripts/ci/check-changed-coverage.mjs \
 *     --coverage apps/frontend/coverage-changed \
 *     --base "$GITHUB_BASE_SHA" \
 *     --root apps/frontend/src
 *
 * Exits 0 only when there are no changed source files (e.g. a docs-only diff).
 * Changed source with missing coverage data now FAILS — the previous skip made
 * the gate opt-out for modified files.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { evaluateChangedCoverage } from "./changed-coverage-core.mjs";

function parseArgs(argv) {
  const args = {
    coverage: "",
    base: "origin/main",
    root: "",
    min: "60",
    minFileLines: "20",
    ignore: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx", "**/test/**"],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case "--coverage":
        args.coverage = value;
        i += 1;
        break;
      case "--base":
        args.base = value;
        i += 1;
        break;
      case "--root":
        args.root = value;
        i += 1;
        break;
      case "--min":
        args.min = value;
        i += 1;
        break;
      case "--min-file-lines":
        args.minFileLines = value;
        i += 1;
        break;
      case "--ignore":
        args.ignore.push(value);
        i += 1;
        break;
      default:
        break;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (!args.coverage) {
  console.error("check-changed-coverage: --coverage <dir> is required");
  process.exit(2);
}

function git(...command) {
  try {
    return execFileSync("git", command, { encoding: "utf8" });
  } catch {
    return "";
  }
}

function changedFiles() {
  const base = args.base?.trim() || "HEAD^1";
  const diff = git("diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`);
  const worktree = git("diff", "--name-only", "--diff-filter=ACMR", "HEAD");
  const staged = git("diff", "--name-only", "--cached", "--diff-filter=ACMR");
  return new Set(
    `${diff}\n${worktree}\n${staged}`
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
}

/** Files that did not exist on the base ref (the "new code needs a test" set). */
function addedFiles() {
  const base = args.base?.trim() || "HEAD^1";
  const diff = git("diff", "--name-only", "--diff-filter=A", `${base}...HEAD`);
  const staged = git("diff", "--name-only", "--cached", "--diff-filter=A");
  return new Set(
    `${diff}\n${staged}`
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
}

function matchesGlob(file, glob) {
  // Minimal glob support: `**` crosses directories, `*` does not.
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`).test(file);
}

function isIgnored(file) {
  return args.ignore.some((glob) => matchesGlob(file, glob));
}

function isSource(file) {
  if (!/\.(ts|tsx)$/.test(file)) return false;
  if (args.root && !file.startsWith(args.root.replace(/\/+$/, ""))) return false;
  return !isIgnored(file);
}

const coveragePath = path.resolve(args.coverage, "coverage-final.json");
const perFile = new Map();

if (fs.existsSync(coveragePath)) {
  /** Istanbul coverage-final.json → per-file { covered, total }. */
  const coverage = JSON.parse(fs.readFileSync(coveragePath, "utf8"));
  for (const [absolutePath, data] of Object.entries(coverage)) {
    const lineHits = Object.values(data.s ?? {}).filter((hitCount) => Number(hitCount) > 0).length;
    const total = Object.keys(data.s ?? {}).length;
    if (total === 0) continue;
    const relative = path.relative(process.cwd(), absolutePath).replace(/\\/g, "/");
    perFile.set(relative, { covered: lineHits, total });
  }
} else {
  console.log(
    `Changed coverage: no ${path.relative(process.cwd(), coveragePath)} — changed source will fail.`,
  );
}

const added = addedFiles();
const changed = [...changedFiles()].filter(isSource);
if (changed.length === 0) {
  console.log("Changed coverage: no changed source files — nothing to enforce.");
  process.exit(0);
}

const minFileLines = Number.parseInt(args.minFileLines, 10) || 20;
const threshold = Number.parseFloat(args.min) || 0;

const result = evaluateChangedCoverage({
  changed,
  added,
  perFile,
  min: threshold,
  minFileLines,
  lineCountOf: (file) => {
    try {
      return fs.readFileSync(file, "utf8").split("\n").length;
    } catch {
      return 0;
    }
  },
});

console.log("Changed-file coverage:");
for (const [file, percent, detail] of result.rows) {
  console.log(`  ${percent.padStart(7)}  ${detail.padStart(9)}  ${file}`);
}
console.log(
  `Aggregate: ${result.aggregate.toFixed(1)}% of ${result.statementsTotal} statements in changed files (min ${threshold}%)`,
);

if (result.failures.length > 0) {
  console.error("\n✗ Changed-file coverage gate failed:");
  for (const failure of result.failures) console.error(`  - ${failure}`);
  console.error(
    "\nAdd or extend the tests that exercise these files, or reduce the change surface.",
  );
  process.exit(1);
}

console.log("\n✓ Changed-file coverage gate passed.");
