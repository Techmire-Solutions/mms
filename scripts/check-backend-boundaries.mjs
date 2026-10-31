#!/usr/bin/env node
/**
 * Ratchet: backend route handlers must not reach into storage directly.
 *
 * The documented chain is routes → use-cases → repository interface → Drizzle adapter
 * (`SYSTEM_ARCHITECTURE.md` §5). A route file that imports `db/repositories/**`, the
 * raw `db/dbClient`, `getDb()`/`getRootDb()`, or the `drizzle-orm` query builder
 * short-circuits that seam: the handler owns SQL, bypasses the module's repository
 * interface, and can't be exercised with a fake repository.
 *
 * `db/dbConnection` is deliberately not flagged as an import: `dbSyncRoutes` uses its
 * long-lived transaction primitives directly. A route that reaches for `getDb` /
 * `getRootDb` is caught by the separate call check.
 *
 * Why a ratchet rather than a fix-everything pass
 * ----------------------------------------------
 * 0 route files do this today — every domain (tasks, savedReports, faculty catalog, audit,
 * platform, users, workspace) reads storage through its own use-cases/repository seam.
 * BASELINE is therefore zero: any new direct-import route fails immediately. The detector
 * catches static `from "…"` / `import "…"` lines AND dynamic `import("…")` calls.
 *
 * Usage:
 *   node scripts/check-backend-boundaries.mjs [--json] [--changed]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { changedFiles } from "./lib/changed-files.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routesDir = path.join(rootDir, "apps", "backend", "src", "routes");

/** Measured 2026-10-12: all route→storage imports migrated away. Zero tolerated. */
const BASELINE = 0;

const isRouteSource = (rel) =>
  rel.endsWith(".ts") && !/\.(test|spec)\.ts$/.test(rel) && !rel.includes("/__tests__/");

/** Recursively collects non-test TypeScript sources. */
function collectSourceFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      found.push(...collectSourceFiles(full));
      continue;
    }
    if (!entry.name.endsWith(".ts")) continue;
    if (/\.(test|spec)\.ts$/.test(entry.name)) continue;
    found.push(full);
  }
  return found;
}

/** Import specifiers in a source file that bypass the repository seam. */
function findDirectStorageImports(source) {
  const hits = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const m =
      lines[i].match(/\bfrom\s+["']([^"']+)["']/) ??
      lines[i].match(/^\s*import\s+["']([^"']+)["']/) ??
      lines[i].match(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/);
    if (!m) continue;
    const specifier = m[1];
    // Module adapters (`<module>/repository/<x>Adapter.js`) are the SAME seam as
    // `db/repositories/*`: a route that imports one has reached into storage.
    // Matching only "db/repositories/" reported a false zero while
    // `routes/common/auth/authSessionRoutes.ts` imported
    // `users/repository/usersRepositoryAdapter.js`.
    const isRepoImport = specifier.includes("db/repositories/") || /\/repository\//.test(specifier);
    const isRawClient = specifier.includes("db/dbClient");
    const isQueryBuilder = specifier === "drizzle-orm" || specifier.startsWith("drizzle-orm/");
    if (isRepoImport || isRawClient || isQueryBuilder) {
      hits.push({ line: i + 1, specifier });
    }
  }
  return hits;
}

/** Direct raw-client calls in a route source (`getDb()` / `getRootDb()`). */
function findRawClientCalls(source) {
  const hits = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*(\/\/|\*)/.test(lines[i])) continue;
    if (/\b(?:getDb|getRootDb)\s*\(/.test(lines[i])) hits.push(i + 1);
  }
  return hits;
}

if (!fs.existsSync(routesDir)) {
  console.error(`✗ Backend routes not found at ${path.relative(rootDir, routesDir)}`);
  process.exit(1);
}

// In `--changed` mode only the touched route files are scanned, so the *global*
// baseline (19) would mask a single new offender. There the bar is zero: any changed
// route file that reaches into storage is a new violation.
const changedMode = process.argv.includes("--changed");
const baseline = changedMode ? 0 : BASELINE;

const sources = changedMode
  ? changedFiles()
      .filter((rel) => rel.startsWith("apps/backend/src/routes/") && isRouteSource(rel))
      .map((rel) => path.join(rootDir, rel))
      .filter((file) => fs.existsSync(file))
  : collectSourceFiles(routesDir);

const offenders = [];
for (const file of sources) {
  const source = fs.readFileSync(file, "utf8");
  const hits = findDirectStorageImports(source);
  const rawCalls = findRawClientCalls(source);
  if (hits.length === 0 && rawCalls.length === 0) continue;
  offenders.push({
    file: path.relative(rootDir, file),
    specifiers: [...new Set(hits.map((h) => h.specifier))],
    lines: hits.map((h) => h.line),
    rawCallLines: rawCalls,
  });
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ total: offenders.length, baseline, offenders }, null, 2));
  process.exit(0);
}

console.log(
  "Backend route → storage boundary (db/repositories, db/dbClient, getDb()/getRootDb(), drizzle-orm)",
);
console.log(
  `  offenders: ${offenders.length} files (${changedMode ? "changed files" : `baseline ${BASELINE}`})`,
);
for (const o of [...offenders].sort((a, b) => a.file.localeCompare(b.file))) {
  console.log(`    ${o.file}`);
}

if (offenders.length > baseline) {
  const added = offenders.slice(baseline);
  console.error(
    `\n✗ ${offenders.length - baseline} new route file(s) reaching into storage directly:\n` +
      added.map((o) => `  - ${o.file}  (${o.specifiers.join(", ")})`).join("\n") +
      "\n\nRoutes must go through the owning module's use-cases/repository seam, e.g.:\n" +
      "  imports: routes -> ../<module>/use-cases/<module>UseCases.js\n" +
      "  logic:   use-case -> <module>/repository/<module>Repository.ts (interface)\n" +
      "  storage: the Drizzle adapter implementation (only file that touches drizzle-orm)\n\n" +
      "See SYSTEM_ARCHITECTURE.md §5 (Backend Clean Architecture & Persistence).",
  );
  process.exit(1);
}

if (!changedMode && offenders.length < BASELINE) {
  console.log(
    `\n✓ ${BASELINE - offenders.length} fewer than baseline — lower BASELINE in ` +
      "scripts/check-backend-boundaries.mjs to lock in the improvement.",
  );
} else {
  console.log("\n✓ No new direct storage imports in routes.");
}
