#!/usr/bin/env node
/**
 * Attendance route-injection ratchet.
 *
 * Every attendance contract path must appear in at least one `app.inject({ url })` call, so a new
 * endpoint cannot ship with only unit-tested handlers. Text-level check by design (dependency-free):
 * it compares contract paths with the `url:` literals used in the backend test files.
 *
 * Usage: node scripts/ci/check-attendance-route-injection.mjs [--strict]
 *   default: report gaps, exit 0 (advisory while the suite catches up)
 *   --strict: fail on any gap
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONTRACT_DIR = path.join(ROOT, "packages/shared/src/contracts");
const TEST_DIRS = [
  path.join(ROOT, "apps/backend/src/__tests__"),
  path.join(ROOT, "apps/backend/src/__tests__/db-integration"),
];
const strict = process.argv.includes("--strict");

const contractSources = fs
  .readdirSync(CONTRACT_DIR)
  .filter((name) => /^attendance.*\.ts$/.test(name))
  .map((name) => fs.readFileSync(path.join(CONTRACT_DIR, name), "utf8"));

const paths = new Set();
for (const source of contractSources) {
  for (const match of source.matchAll(/path:\s*"(\/api\/attendance[^"]*)"/g)) {
    if (match[1]) paths.add(match[1]);
  }
}

const testSources = [];
for (const dir of TEST_DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".test.ts") && !name.endsWith(".test.tsx")) continue;
    testSources.push(fs.readFileSync(path.join(dir, name), "utf8"));
  }
}

const urls = [];
for (const source of testSources) {
  for (const match of source.matchAll(/url:\s*`([^`]+)`/g)) urls.push(match[1] ?? "");
  for (const match of source.matchAll(/url:\s*"([^"]+)"/g)) urls.push(match[1] ?? "");
  for (const match of source.matchAll(/url:\s*'([^']+)'/g)) urls.push(match[1] ?? "");
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

const missing = [];
for (const routePath of [...paths].sort()) {
  const matcher = routeMatcher(routePath);
  const covered = urls.some((url) => matcher.test(url.replace(/\$\{[^}]+\}/g, "x")));
  if (!covered) missing.push(routePath);
}

if (missing.length === 0) {
  console.log(`✅ Attendance route injection held (${paths.size} contract paths covered).`);
  process.exit(0);
}

console.warn(
  `⚠️  ${missing.length}/${paths.size} attendance contract paths have no app.inject test:`,
);
for (const routePath of missing) console.warn(`   - ${routePath}`);
if (strict) {
  console.error("✗ Attendance route-injection ratchet failed (--strict).");
  process.exit(1);
}
console.log("   (advisory — run with --strict once the routes are covered)");
