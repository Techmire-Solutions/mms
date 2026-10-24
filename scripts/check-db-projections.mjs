#!/usr/bin/env node
/**
 * Ratchet against bare (wildcard) Drizzle projections in the backend.
 *
 * `mms-performance` bans wildcard database queries — `SELECT *` and bare
 * `db.select().from(table)` — in favour of explicit typed column projections.
 * The completion-review table repeats the ban.
 *
 * Why a ratchet rather than a fix-everything pass
 * ----------------------------------------------
 * There are 17 pre-existing sites (all in `sessionRepositoryHydrate.ts`).
 * They are NOT a measured performance problem today: the affected tables are
 * 5–17 columns wide and the mappers read most of those columns to build full domain
 * records, so a projection would save little.
 *
 * The real hazard the ban guards is FUTURE bloat — adding one wide `jsonb` to
 * `session_classes` would silently inflate every session-list query, with
 * nothing to catch it. Converting the existing sites properly also means
 * narrowing 11 mapper input types from `$inferSelect` to `Pick<…>` across a hot
 * hydration path, which is a large speculative refactor rather than a fix.
 *
 * So: no NEW wildcard projections, and the existing count reported so it can be
 * burned down deliberately.
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

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(rootDir, "apps", "backend", "src");

/** Measured 2026-09-19. Zero wildcard projections across apps/backend. */
const BASELINE = 0;

const isBackendSource = (rel) =>
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

/**
 * Finds `.select()` with NO projection argument whose receiver chain continues
 * straight into `.from(`. An empty argument list is what makes it a wildcard;
 * `.select({ id: t.id })` is the compliant form and is not matched.
 */
function findWildcardProjections(source) {
  const hits = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (!/\.select\(\s*\)\s*$/.test(lines[i])) continue;
    // The projection may be followed by `.from(` on a later line.
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") j += 1;
    if (j < lines.length && /^\s*\.from\(/.test(lines[j])) {
      hits.push({ line: i + 1, code: lines[i].trim() });
    }
  }
  return hits;
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
