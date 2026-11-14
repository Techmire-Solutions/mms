#!/usr/bin/env node
/**
 * Obligations route-injection ratchet (sibling of the accounting and examinations ones).
 *
 * Every obligations contract path must appear in a backend test that can inject it over HTTP. The
 * matcher scans **any** `/api/obligations…` literal in the test sources rather than `url:`-only
 * properties, because several suites pass the URL to a helper.
 *
 * Unlike accounting this ships **no baseline**: the module had nine uncovered paths when the ratchet
 * was introduced and all of them are now covered, so a new route without a test should fail
 * immediately rather than join a tolerated list.
 *
 *   node scripts/ci/check-obligations-route-injection.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONTRACT_DIR = path.join(ROOT, "packages/shared/src/contracts");
const TEST_ROOT = path.join(ROOT, "apps/backend/src/__tests__");

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
for (const name of fs
  .readdirSync(CONTRACT_DIR)
  .filter((file) => /^obligations.*\.ts$/.test(file))) {
  const source = fs.readFileSync(path.join(CONTRACT_DIR, name), "utf8");
  for (const match of source.matchAll(/path:\s*"(\/api\/obligations[^"]*)"/g)) {
    if (match[1]) paths.add(match[1]);
  }
}

const literals = [];
for (const file of walk(TEST_ROOT)) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/(?:`|"|')(\/api\/obligations[^`"'\s]*)/g)) {
    literals.push(match[1]);
  }
}

/** `/collections/:id` matches `/collections/oc-1`; every other segment must match literally. */
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

if (uncovered.length > 0) {
  console.error("✗ Obligations route-injection coverage regressed:");
  for (const routePath of uncovered) console.error(`  - no inject test: ${routePath}`);
  console.error("Add the missing fire-and-assert case to an obligations integration suite.");
  process.exit(1);
}

console.log(
  `✅ Obligations route injection held (${paths.size}/${paths.size} contract paths covered).`,
);
