#!/usr/bin/env node
/**
 * Accounting route-security matrix ratchet.
 *
 * Every accounting contract route must be classified in
 * `scripts/ci/accounting-route-security.json` with the module action the route
 * enforces and the roles it must deny. The classification is reproducible from the
 * method default (`GET` → read, other methods → write) plus the explicit overrides
 * in `apps/backend/src/lib/moduleRouteActionRulesFinance.ts` and the setup-write
 * routes; `--write-matrix` regenerates the file after a reviewed route change.
 *
 * The inject suite `accountingRouteSecurityMatrix.test.ts` pins the denials, so a
 * new privileged route cannot ship with only a URL-presence check.
 *
 *   node scripts/ci/check-accounting-route-security.mjs
 *   node scripts/ci/check-accounting-route-security.mjs --write-matrix
 */
import fs from "node:fs";
import path from "node:path";
import {
  DENIED_ROLES_BY_ACTION as LABELS,
  classifyAccountingRoute,
} from "../lib/accountingRouteClassification.mjs";

const ROOT = process.cwd();
const CONTRACT_DIR = path.join(ROOT, "packages/shared/src/contracts");
const MATRIX_FILE = path.join(ROOT, "scripts/ci/accounting-route-security.json");
const writeMatrix = process.argv.includes("--write-matrix");

const KNOWN_ROLES = ["admin", "accountant", "auditor", "guardian"];

const routes = [];
for (const name of fs.readdirSync(CONTRACT_DIR).filter((f) => /^accounting.*\.ts$/.test(f))) {
  const source = fs.readFileSync(path.join(CONTRACT_DIR, name), "utf8");
  const re =
    /method:\s*"(GET|POST|PUT|DELETE|PATCH)"(?:[\s\S]{0,200}?)path:\s*"(\/api\/accounting[^"]+)"/g;
  let match;
  while ((match = re.exec(source))) routes.push({ method: match[1], path: match[2] });
}

const expected = Object.fromEntries(
  routes
    .map((route) => [`${route.method} ${route.path}`, { action: classifyAccountingRoute(route) }])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => [key, entry]),
);

if (writeMatrix) {
  const matrix = Object.fromEntries(
    Object.entries(expected).map(([key, entry]) => [
      key,
      { action: entry.action, deniedRoles: LABELS[entry.action] },
    ]),
  );
  fs.writeFileSync(MATRIX_FILE, `${JSON.stringify(matrix, null, 2)}\n`);
  console.log(`✅ Wrote ${Object.keys(matrix).length} accounting route classifications.`);
  process.exit(0);
}

const matrix = JSON.parse(fs.readFileSync(MATRIX_FILE, "utf8"));
const errors = [];

for (const [key, entry] of Object.entries(expected)) {
  const classified = matrix[key];
  if (!classified) {
    errors.push(`missing classification: ${key}`);
    continue;
  }
  if (classified.action !== entry.action) {
    errors.push(`${key}: classified as ${classified.action}, expected ${entry.action}`);
  }
  const denied = classified.deniedRoles ?? [];
  if (denied.length === 0) errors.push(`${key}: no denied role`);
  for (const role of denied) {
    if (!KNOWN_ROLES.includes(role)) errors.push(`${key}: unknown role ${role}`);
  }
  for (const required of LABELS[entry.action]) {
    if (!denied.includes(required)) errors.push(`${key}: must deny ${required}`);
  }
  // Privileged writes must never be reachable by a read-only role.
  if (entry.action !== "read" && denied.includes("admin")) {
    errors.push(`${key}: the admin role must be able to reach a ${entry.action} route`);
  }
}

for (const key of Object.keys(matrix)) {
  if (!expected[key]) errors.push(`stale classification (route removed): ${key}`);
}

if (errors.length) {
  console.error("✗ Accounting route-security matrix gaps:");
  for (const error of errors) console.error(`  - ${error}`);
  console.error("Run with --write-matrix after reviewing the route guards.");
  process.exit(1);
}

console.log(`✅ Accounting route-security matrix held (${routes.length} routes).`);
