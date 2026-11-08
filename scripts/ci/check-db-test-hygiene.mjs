#!/usr/bin/env node
/**
 * Enrollments DB-test hygiene ratchet.
 *
 * Conditional database skips report green while asserting nothing. The repository rule bans
 * them (`dbTestSupport.ts`), and this gate keeps the enrollments/registration DB suites honest:
 * no `dbAvailable`, `ctx.skip(`, `it.skip(` or `describe.skip(` in those files.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "apps/backend/src/__tests__/db-integration");
const BANNED = [/\bdbAvailable\b/, /\bctx\.skip\s*\(/, /\bit\.skip\s*\(/, /\bdescribe\.skip\s*\(/];
const files = fs
  .readdirSync(ROOT)
  .filter((name) => /^(enrollment|enrollments|registration).*\.test\.ts$/.test(name));

const failures = [];
for (const name of files) {
  const source = fs.readFileSync(path.join(ROOT, name), "utf8");
  for (const pattern of BANNED) {
    const match = source.match(pattern);
    if (match) failures.push(`${name}: banned conditional skip pattern ${pattern}`);
  }
  if (!source.includes("requireDatabaseConnection")) {
    failures.push(`${name}: must connect through requireDatabaseConnection (fail loudly)`);
  }
}

if (failures.length > 0) {
  console.error("✗ Enrollments DB test hygiene regressed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✅ Enrollments DB test hygiene held (${files.length} files, no conditional skips).`);
