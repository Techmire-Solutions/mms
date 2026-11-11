#!/usr/bin/env node
/**
 * Examinations route-injection ratchet (sibling of the attendance check).
 *
 * Every examinations contract path must appear in an `app.inject({ url })` call. Paths that are not
 * covered yet live in a checked-in baseline, so a **new** endpoint cannot ship with only unit-tested
 * handlers, while the legacy backlog is explicit and can only shrink.
 *
 *   node scripts/ci/check-examinations-route-injection.mjs               # fail on new gaps
 *   node scripts/ci/check-examinations-route-injection.mjs --write-baseline
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONTRACT_DIR = path.join(ROOT, "packages/shared/src/contracts");
const TEST_ROOTS = [path.join(ROOT, "apps/backend/src/__tests__")];
const BASELINE_FILE = path.join(ROOT, "scripts/ci/examinations-route-injection-baseline.txt");
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

const contractSources = fs
  .readdirSync(CONTRACT_DIR)
  .filter((name) => /^examinations.*\.ts$/.test(name))
  .map((name) => fs.readFileSync(path.join(CONTRACT_DIR, name), "utf8"));

const paths = new Set();
for (const source of contractSources) {
  for (const match of source.matchAll(/path:\s*"(\/api\/examinations[^"]*)"/g)) {
    if (match[1]) paths.add(match[1]);
  }
}

const urls = [];
for (const root of TEST_ROOTS) {
  for (const file of walk(root)) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/url:\s*`([^`]+)`/g)) urls.push(match[1] ?? "");
    for (const match of source.matchAll(/url:\s*"([^"]+)"/g)) urls.push(match[1] ?? "");
    for (const match of source.matchAll(/url:\s*'([^']+)'/g)) urls.push(match[1] ?? "");
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

const uncovered = [...paths].sort().filter((routePath) => {
  const matcher = routeMatcher(routePath);
  return !urls.some((url) => matcher.test(url.replace(/\$\{[^}]+\}/g, "x")));
});

if (writeBaseline) {
  fs.writeFileSync(BASELINE_FILE, `${uncovered.join("\n")}${uncovered.length ? "\n" : ""}`);
  console.log(
    `📝 Examinations route-injection baseline written (${uncovered.length}/${paths.size} uncovered).`,
  );
  process.exit(0);
}

const baseline = new Set(
  fs.existsSync(BASELINE_FILE)
    ? fs
        .readFileSync(BASELINE_FILE, "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : [],
);

const newGaps = uncovered.filter((routePath) => !baseline.has(routePath));
const stale = [...baseline].filter((routePath) => !uncovered.includes(routePath));

if (stale.length > 0) {
  console.warn(`⚠️  ${stale.length} baseline path(s) are now covered — shrink the baseline:`);
  for (const routePath of stale) console.warn(`   - ${routePath}`);
}
if (newGaps.length > 0) {
  console.error(
    `✗ ${newGaps.length} examinations contract path(s) have no app.inject test and are not baselined:`,
  );
  for (const routePath of newGaps) console.error(`   - ${routePath}`);
  console.error("   Add an inject test, or baseline the path with --write-baseline.");
  process.exit(1);
}
console.log(
  `✅ Examinations route injection held (${paths.size} paths, ${baseline.size} baselined).`,
);
