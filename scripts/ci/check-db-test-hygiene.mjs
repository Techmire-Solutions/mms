#!/usr/bin/env node
/**
 * DB-test hygiene ratchet (enrollments, attendance, hasanat, finance, accounting).
 *
 * Conditional database skips report green while asserting nothing. The repository rule bans
 * them (`dbTestSupport.ts`), and this gate keeps the enrollments/registration DB suites honest:
 * no `dbAvailable`, `ctx.skip(`, `it.skip(` or `describe.skip(` in those files.
 *
 * It also keeps every real-Postgres suite on the data-layer entry points: the migration runner
 * must be imported from `@mms/db/migrations`, never through the app-local `db/dbInit` facade.
 */
import fs from "node:fs";
import path from "node:path";
import { assertScanDirs } from "../lib/repo-paths.mjs";

const ROOTS = [
  path.resolve(process.cwd(), "apps/api/src/__tests__/db-integration"),
  path.resolve(process.cwd(), "packages/modules/accounting/src/backend/__tests__/db-integration"),
];

/** Every root whose suites must import package entry points, not app db facades. */
const PACKAGE_ENTRYPOINT_ROOTS = [
  path.resolve(process.cwd(), "apps/api/src/__tests__/db-integration"),
  path.resolve(process.cwd(), "apps/api/src/__tests__/rls"),
  path.resolve(process.cwd(), "packages/modules/accounting/src/backend/__tests__/db-integration"),
];
// Fail closed: an empty suite root must fail rather than report "no skips".
assertScanDirs(ROOTS, "db test hygiene");

const APP_DB_FACADE_IMPORT = /from\s+["'][^"']*dbInit\.js["']/;
const BANNED = [/\bdbAvailable\b/, /\bctx\.skip\s*\(/, /\bit\.skip\s*\(/, /\bdescribe\.skip\s*\(/];
const files = ROOTS.flatMap((root) => (fs.existsSync(root) ? fs.readdirSync(root) : [])).filter(
  (name) =>
    /^(enrollment|enrollments|registration|attendance|hasanat|finance|accounting|fiscalYearOverlap).*\.test\.ts$/.test(
      name,
    ),
);

const failures = [];
for (const name of files) {
  const root = ROOTS.find((candidate) => fs.existsSync(path.join(candidate, name))) ?? ROOTS[0];
  const source = fs.readFileSync(path.join(root, name), "utf8");
  for (const pattern of BANNED) {
    const match = source.match(pattern);
    if (match) failures.push(`${name}: banned conditional skip pattern ${pattern}`);
  }
  if (!source.includes("requireDatabaseConnection")) {
    failures.push(`${name}: must connect through requireDatabaseConnection (fail loudly)`);
  }
}

// Package-entry rule: the DDL runner and migrations folder live in `@mms/db`. Importing them
// through `apps/api/src/db/dbInit.ts` re-couples DB suites to the app and defeats the split.
const packageEntrypointFiles = PACKAGE_ENTRYPOINT_ROOTS.flatMap((root) =>
  fs.existsSync(root)
    ? fs
        .readdirSync(root)
        .filter((name) => /\.(test|spec)\.ts$/.test(name))
        .map((name) => ({ name, file: path.join(root, name) }))
    : [],
);
for (const { name, file } of packageEntrypointFiles) {
  if (APP_DB_FACADE_IMPORT.test(fs.readFileSync(file, "utf8"))) {
    failures.push(
      `${name}: imports db/dbInit.js — import the migration runner from @mms/db/migrations`,
    );
  }
}

if (failures.length > 0) {
  console.error("✗ DB test hygiene regressed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  `✅ DB test hygiene held (${files.length} skip-checked files, ` +
    `${packageEntrypointFiles.length} package-entry files).`,
);
