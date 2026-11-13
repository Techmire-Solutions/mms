#!/usr/bin/env node
/**
 * Accounting route-injection ratchet (sibling of the examinations one).
 *
 * Every accounting contract path must appear in a backend test that can inject it
 * over HTTP. Unlike the examinations matcher this scans **any** `/api/accounting…`
 * literal or template in the test sources, because several accounting suites pass
 * the URL to a helper (`call("accountant", "/api/accounting/hedges", …)`) instead
 * of writing an `inject({ url })` property; a `url:`-only scan would report false
 * gaps. Uncovered paths live in a checked-in baseline that may only shrink.
 *
 *   node scripts/ci/check-accounting-route-injection.mjs
 *   node scripts/ci/check-accounting-route-injection.mjs --write-baseline
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONTRACT_DIR = path.join(ROOT, "packages/shared/src/contracts");
const TEST_ROOT = path.join(ROOT, "apps/backend/src/__tests__");
const BASELINE_FILE = path.join(ROOT, "scripts/ci/accounting-route-injection-baseline.txt");
const writeBaseline = process.argv.includes("--write-baseline");

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.test\.tsx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

const paths = new Set();
for (const name of fs.readdirSync(CONTRACT_DIR).filter((f) => /^accounting.*\.ts$/.test(f))) {
  const source = fs.readFileSync(path.join(CONTRACT_DIR, name), "utf8");
  for (const match of source.matchAll(/path:\s*"(\/api\/accounting[^"]*)"/g)) {
    if (match[1]) paths.add(match[1]);
  }
}

const literals = [];
for (const file of walk(TEST_ROOT)) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/(?:`|"|')(\/api\/accounting[^`"'\s]*)/g)) {
    literals.push(match[1]);
  }
}

function routeMatcher(routePath) {
  const pattern = routePath
    .split("/")
    .map((segment) =>
      segment.startsWith(":") ? "[^/?`\"']+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("/");
  return new RegExp(`^${pattern}(?:[?#]|$)`);
}

const covered = (routePath) => {
  const matcher = routeMatcher(routePath);
  return literals.some((url) => matcher.test(url.replace(/\$\{[^}]+\}/g, "x")));
};

const uncovered = [...paths].sort().filter((routePath) => !covered(routePath));

if (writeBaseline) {
  fs.writeFileSync(BASELINE_FILE, `${uncovered.join("\n")}${uncovered.length ? "\n" : ""}`);
  console.log(`✅ Wrote ${uncovered.length} accounting route-injection gaps to the baseline.`);
  process.exit(0);
}

const baseline = fs.existsSync(BASELINE_FILE)
  ? fs
      .readFileSync(BASELINE_FILE, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  : [];
const newlyUncovered = uncovered.filter((routePath) => !baseline.includes(routePath));
const stale = baseline.filter((routePath) => !uncovered.includes(routePath));

if (newlyUncovered.length > 0 || stale.length > 0) {
  console.error("✗ Accounting route-injection coverage regressed:");
  for (const routePath of newlyUncovered) console.error(`  - no inject test: ${routePath}`);
  for (const routePath of stale) console.error(`  - baseline entry now covered: ${routePath}`);
  console.error("Run with --write-baseline after adding the missing inject test.");
  process.exit(1);
}

console.log(
  `✅ Accounting route injection held (${paths.size} contract paths, ${baseline.length} baselined gaps).`,
);
