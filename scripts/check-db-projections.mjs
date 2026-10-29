#!/usr/bin/env node
/**
 * Ratchet against bare (wildcard) Drizzle projections in the backend.
 *
 * `mms-performance` bans wildcard database queries — `SELECT *` and bare
 * `db.select().from(table)` — in favour of explicit typed column projections.
 * The completion-review table repeats the ban.
 *
 * Application code has a zero baseline: no bare `.select()` is accepted. The
 * legacy one-time data migrations under `src/db/migrations/**` are excluded —
 * they deliberately scan whole collections/tables during a transform and are not
 * request-path queries.
 *
 * Usage:
 *   node scripts/check-db-projections.mjs [--json] [--changed]
 *
 * `--changed` scans only the changed backend sources (vs the merge-base). With a
 * zero baseline that is equivalent to the full scan for catching regressions.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { changedFiles } from "./lib/changed-files.mjs";
import { findWildcardProjections } from "./lib/db-projections-core.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(rootDir, "apps", "backend", "src");

/** Measured 2026-09-19. Zero wildcard projections across apps/backend. */
const BASELINE = 0;

const isBackendSource = (rel) =>
  rel.endsWith(".ts") &&
  !/\.(test|spec)\.ts$/.test(rel) &&
  !rel.includes("/__tests__/") &&
  !rel.startsWith("apps/backend/src/db/migrations/");

/** Recursively collects non-test TypeScript sources. */
function collectSourceFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      if (path.join(dir, entry.name) === path.join(srcDir, "db", "migrations")) continue;
      found.push(...collectSourceFiles(full));
      continue;
    }
    if (!entry.name.endsWith(".ts")) continue;
    if (/\.(test|spec)\.ts$/.test(entry.name)) continue;
    found.push(full);
  }
  return found;
}

if (!fs.existsSync(srcDir)) {
  console.error(`✗ Backend source not found at ${path.relative(rootDir, srcDir)}`);
  process.exit(1);
}

const sources = process.argv.includes("--changed")
  ? changedFiles()
      .filter((rel) => rel.startsWith("apps/backend/src/") && isBackendSource(rel))
      .map((rel) => path.join(rootDir, rel))
      .filter((file) => fs.existsSync(file))
  : collectSourceFiles(srcDir);

const offenders = [];
for (const file of sources) {
  const hits = findWildcardProjections(fs.readFileSync(file, "utf8"));
  for (const hit of hits) {
    offenders.push({
      file: path.relative(rootDir, file),
      ...hit,
    });
  }
}

const grouped = new Map();
for (const offender of offenders) {
  grouped.set(offender.file, (grouped.get(offender.file) ?? 0) + 1);
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ total: offenders.length, baseline: BASELINE, offenders }, null, 2));
  process.exit(0);
}

console.log("Wildcard DB projections (bare .select())");
console.log(`  count: ${offenders.length} (baseline ${BASELINE})`);
for (const [file, count] of [...grouped.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(count).padStart(3)}  ${file}`);
}

if (offenders.length > BASELINE) {
  const added = offenders.slice(-(offenders.length - BASELINE));
  console.error(
    `\n✗ ${offenders.length - BASELINE} new wildcard projection(s) introduced:\n` +
      added.map((o) => `  - ${o.file}:${o.line}`).join("\n") +
      "\n\nProject the columns you actually read, e.g.:\n" +
      "  tx.select({ id: t.id, name: t.name }).from(t)\n\n" +
      "A bare .select() fetches every column, so a future wide column silently\n" +
      "inflates the query. See mms-performance (wildcard DB query ban).",
  );
  process.exit(1);
}

if (offenders.length < BASELINE) {
  console.log(
    `\n✓ ${BASELINE - offenders.length} fewer than baseline — lower BASELINE in ` +
      "scripts/check-db-projections.mjs to lock in the improvement.",
  );
} else {
  console.log("\n✓ No new wildcard DB projections.");
}
