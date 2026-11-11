#!/usr/bin/env node
/**
 * Examinations route-security matrix ratchet.
 *
 * Every `/api/examinations` contract route must be classified here with at least one allowed and
 * one denied role, and the matrix must not silently omit a newly added endpoint. The inject suite
 * pins the actual statuses for the representative denials; this gate keeps the classification
 * complete so a new privileged route cannot ship with only a URL-presence check.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONTRACT_DIR = path.join(ROOT, "packages/shared/src/contracts");
const MATRIX_FILE = path.join(ROOT, "scripts/ci/examinations-route-security.json");

const routes = new Set();
for (const name of fs.readdirSync(CONTRACT_DIR).filter((f) => /^examinations.*\.ts$/.test(f))) {
  const source = fs.readFileSync(path.join(CONTRACT_DIR, name), "utf8");
  const re =
    /method:\s*"(GET|POST|PUT|DELETE|PATCH)"[\s\S]{0,200}?path:\s*"(\/api\/examinations[^"]+)"/g;
  let match;
  while ((match = re.exec(source))) routes.add(`${match[1]} ${match[2]}`);
}

const matrix = JSON.parse(fs.readFileSync(MATRIX_FILE, "utf8"));
const errors = [];
const knownRoles = new Set(["admin", "teacher", "auditor", "guardian"]);

for (const route of routes) {
  const entry = matrix[route];
  if (!entry) {
    errors.push(`missing classification: ${route}`);
    continue;
  }
  const allowed = entry.allowedRoles ?? [];
  const denied = entry.deniedRoles ?? [];
  if (allowed.length === 0) errors.push(`${route}: no allowed role`);
  if (denied.length === 0) errors.push(`${route}: no denied role`);
  for (const role of [...allowed, ...denied]) {
    if (!knownRoles.has(role)) errors.push(`${route}: unknown role ${role}`);
  }
  if (allowed.some((role) => denied.includes(role))) {
    errors.push(`${route}: a role is both allowed and denied`);
  }
  // Privileged writes must not be open to every role by accident.
  if (route.startsWith("PUT ") || route.startsWith("POST ") || route.startsWith("DELETE ")) {
    if (!allowed.includes("admin")) errors.push(`${route}: write route without an admin path`);
    if (denied.length === 0) errors.push(`${route}: write route without a denial`);
  }
}
for (const route of Object.keys(matrix)) {
  if (!routes.has(route)) errors.push(`stale classification (route removed): ${route}`);
}

if (errors.length) {
  console.error("✗ Examinations route-security matrix gaps:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(
  `✅ Examinations route-security matrix covers ${routes.size}/${routes.size} contract routes.`,
);
