#!/usr/bin/env node
/**
 * Migration move ledger checker (`docs/monorepo-migration-plan.md` §9.1, U1/D9).
 *
 * Every directory move in the migration is a checked-in entry in
 * `scripts/migration/move-manifest.json`. This gate keeps the ledger honest so a
 * half-finished move cannot hide:
 *
 *   - `todo` : `from` must still exist and `to` must NOT exist yet.
 *   - `done` : `from` must be gone and `to` must exist.
 *   - no duplicate `from`/`to`, repo-relative paths only, no `from` inside `to`.
 *
 *   node scripts/check-move-manifest.mjs
 *   node scripts/check-move-manifest.mjs --json
 *   node scripts/check-move-manifest.mjs --phase P4
 *   node scripts/check-move-manifest.mjs --manifest scripts/migration/move-manifest.json
 *
 * Exit 1 when the ledger contradicts the tree; exit 0 otherwise.
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, toRel } from "./lib/repo-paths.mjs";

const DEFAULT_MANIFEST = "scripts/migration/move-manifest.json";
const PHASE_RE = /^P\d$/;
const STATUSES = new Set(["todo", "done"]);

/** True when a repo-relative path is inside another (both POSIX, no trailing slash). */
const isInside = (child, parent) => child === parent || child.startsWith(`${parent}/`);

/**
 * Validate a parsed manifest against an injected existence check.
 * Exported for unit tests (`scripts/ci/move-manifest.test.mjs`).
 *
 * @param {unknown} manifest Parsed manifest JSON.
 * @param {{ pathExists?: (repoRelative: string) => boolean }} [options]
 * @returns {{ errors: string[], entries: Array<{from: string, to: string, phase: string, status: string}>, summary: Record<string, { total: number, done: number }> }}
 */
export function validateMoveManifest(manifest, { pathExists = defaultPathExists } = {}) {
  const errors = [];
  const entries = [];
  const summary = {};

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { errors: ["manifest must be a JSON object"], entries, summary };
  }
  if (manifest.version !== 1) errors.push(`manifest.version must be 1 (got ${manifest.version})`);
  if (!Array.isArray(manifest.entries)) {
    errors.push("manifest.entries must be an array");
    return { errors, entries, summary };
  }

  const seenFrom = new Map();
  const seenTo = new Map();

  manifest.entries.forEach((entry, index) => {
    const where = `entries[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${where} must be an object`);
      return;
    }
    const { from, to, phase, status } = entry;
    for (const [key, value] of [
      ["from", from],
      ["to", to],
      ["phase", phase],
      ["status", status],
    ]) {
      if (typeof value !== "string" || value.length === 0) {
        errors.push(`${where}.${key} must be a non-empty string`);
        return;
      }
    }
    if (!PHASE_RE.test(phase)) errors.push(`${where}.phase must look like "P4" (got "${phase}")`);
    if (!STATUSES.has(status))
      errors.push(`${where}.status must be "todo" or "done" (got "${status}")`);
    for (const [key, value] of [
      ["from", from],
      ["to", to],
    ]) {
      if (path.isAbsolute(value)) errors.push(`${where}.${key} must be repo-relative`);
      if (value.startsWith("../") || value.includes("/../"))
        errors.push(`${where}.${key} must not escape the repository`);
      if (value !== value.replace(/\\/g, "/"))
        errors.push(`${where}.${key} must use POSIX separators`);
      if (value.endsWith("/")) errors.push(`${where}.${key} must not end with a slash`);
    }
    if (from === to) errors.push(`${where} moves "${from}" onto itself`);
    if (isInside(to, from)) errors.push(`${where}.to must not be inside .from`);
    if (isInside(from, to)) errors.push(`${where}.from must not be inside .to`);

    const previousFrom = seenFrom.get(from);
    if (previousFrom !== undefined)
      errors.push(`${where}.from duplicates entries[${previousFrom}].from`);
    else seenFrom.set(from, index);
    const previousTo = seenTo.get(to);
    if (previousTo !== undefined) errors.push(`${where}.to duplicates entries[${previousTo}].to`);
    else seenTo.set(to, index);

    if (status === "todo") {
      if (!pathExists(from)) errors.push(`${where} is "todo" but ${from} does not exist`);
      if (pathExists(to))
        errors.push(`${where} is "todo" but ${to} already exists — flip status to "done"`);
    } else {
      if (pathExists(from)) errors.push(`${where} is "done" but ${from} still exists`);
      if (!pathExists(to)) errors.push(`${where} is "done" but ${to} does not exist`);
    }

    entries.push({ from, to, phase, status });
    const bucket = (summary[phase] ??= { total: 0, done: 0 });
    bucket.total += 1;
    if (status === "done") bucket.done += 1;
  });

  return { errors, entries, summary };
}

function defaultPathExists(repoRelative) {
  return fs.existsSync(path.join(ROOT, repoRelative));
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const manifestIndex = args.indexOf("--manifest");
  const manifestPath = manifestIndex >= 0 ? args[manifestIndex + 1] : DEFAULT_MANIFEST;
  const phaseIndex = args.indexOf("--phase");
  const phaseFilter = phaseIndex >= 0 ? args[phaseIndex + 1] : null;

  if (!manifestPath) {
    console.error("--manifest requires a path");
    process.exit(1);
  }
  if (phaseFilter && !PHASE_RE.test(phaseFilter)) {
    console.error(`--phase must look like "P4" (got "${phaseFilter}")`);
    process.exit(1);
  }

  const absoluteManifest = path.resolve(ROOT, manifestPath);
  if (!fs.existsSync(absoluteManifest)) {
    console.error(`::error::move manifest not found: ${toRel(absoluteManifest)}`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(absoluteManifest, "utf8"));
  } catch (error) {
    console.error(`::error::move manifest is not valid JSON: ${error.message}`);
    process.exit(1);
  }

  const { errors, entries, summary } = validateMoveManifest(parsed);
  const filtered = phaseFilter ? entries.filter((entry) => entry.phase === phaseFilter) : entries;

  if (json) {
    process.stdout.write(
      `${JSON.stringify({ manifest: toRel(absoluteManifest), phase: phaseFilter, entries: filtered, summary, errors }, null, 2)}\n`,
    );
  } else {
    console.log(`Move ledger: ${toRel(absoluteManifest)}`);
    if (entries.length === 0) {
      console.log(
        "  (no entries yet — add one per directory move, docs/monorepo-migration-plan.md §9.1)",
      );
    }
    for (const phase of Object.keys(summary).sort()) {
      const { total, done } = summary[phase];
      console.log(`  ${phase}: ${done}/${total} done`);
    }
    if (phaseFilter) {
      console.log(`\n${phaseFilter} entries (${filtered.length}):`);
      for (const entry of filtered) console.log(`  [${entry.status}] ${entry.from} -> ${entry.to}`);
    }
  }

  if (errors.length > 0) {
    for (const error of errors) console.error(`::error::${error}`);
    console.error(`\n✗ Move ledger contradicts the tree (${errors.length} issue(s)).`);
    process.exit(1);
  }

  console.log(`\n✓ Move ledger matches the tree (${entries.length} entries).`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
