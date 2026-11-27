#!/usr/bin/env node
// Gate: the docs that describe the CURRENT tree must not name repo paths that no longer exist.
//
// Why this exists: `check:docs` validates markdown links; it does not notice a plain-text or code-block
// mention of a path that was moved or deleted. Round 40's audit found `README.md` telling readers to run
// a script that had moved into `@mms/db` — a working link-free instruction that no longer worked.
//
// Scope policy (deliberate, not an oversight): only files that claim to describe today are checked.
// Dated audits (`*-audit-YYYY-MM-DD*`, `project-review-*`, `*-baseline.md`), `docs/archive/**`, ADRs
// (immutable records) and the migration blueprint/plan (which documents the *old* layout on purpose)
// keep their historical paths — rewriting them would falsify the record.
//
// It also enforces acceptance criterion 10 of the migration blueprint: no living doc may name the retired
// pre-monorepo apps (`apps/frontend/`, `apps/backend/`). Those paths are allowed in dated records, never in a
// document that claims to describe today.
//
// Usage: node scripts/check-docs-paths.mjs [--json] [--fix]
//   --fix repoints a moved path when exactly one file in the repo carries that basename.

import fs from "node:fs";
import path from "node:path";

import { ROOT, EmptyScanError } from "./lib/repo-paths.mjs";

/** Files that describe the current tree. Add a doc here only if it must stay true today. */
const LIVING_DOCS = Object.freeze([
  "README.md",
  "AGENTS.md",
  "SYSTEM_ARCHITECTURE.md",
  "docs/README.md",
  "docs/architecture.md",
]);

/** Repo-relative paths ending in a source-ish extension. */
const REPO_PATH = /\b(?:apps|packages|scripts)\/[A-Za-z0-9._/-]+\.(?:ts|tsx|mjs|cjs|json|sql)\b/g;

/**
 * A doc's path mention can be relative to a workspace package rather than the repo root — the README's
 * index-build command runs under `pnpm --filter @mms/db`, so `scripts/sql/x.sql` correctly means
 * `packages/db/scripts/sql/x.sql`. Accept the mention when it resolves from the root OR from any
 * workspace package/app, and only report it when it resolves from nowhere.
 */
function existsAnywhere(mentioned, root) {
  if (fs.existsSync(path.join(root, mentioned))) return true;
  for (const group of ["packages", "apps", "packages/modules"]) {
    const base = path.join(root, group);
    if (!fs.existsSync(base)) continue;
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (fs.existsSync(path.join(base, entry.name, mentioned))) return true;
    }
  }
  return false;
}

/** The two app directories that the monorepo migration retired. */
const RETIRED_APPS = /\bapps\/(?:frontend|backend)\b/g;

export function staleMentions(docs = LIVING_DOCS, root = ROOT) {
  const findings = [];
  let scanned = 0;
  for (const doc of docs) {
    const absolute = path.join(root, doc);
    if (!fs.existsSync(absolute)) continue;
    scanned += 1;
    const text = fs.readFileSync(absolute, "utf8");
    const seen = new Set();
    // Retired app directories: naming them in a living doc is the acceptance-criterion-10 violation.
    for (const match of text.matchAll(RETIRED_APPS)) {
      const mentioned = `${match[0]}/`;
      if (seen.has(mentioned)) continue;
      seen.add(mentioned);
      findings.push({ doc, path: mentioned, reason: "retired pre-monorepo app" });
    }
    for (const match of text.matchAll(REPO_PATH)) {
      const mentioned = match[0];
      if (seen.has(mentioned)) continue;
      seen.add(mentioned);
      if (!existsAnywhere(mentioned, root)) findings.push({ doc, path: mentioned });
    }
  }
  if (scanned === 0) {
    throw new EmptyScanError("check-docs-paths", LIVING_DOCS.join(", "));
  }
  return findings;
}

/**
 * Index every tracked-ish file by basename so a moved path can be repointed. Skips build output and
 * installed packages, and ignores anything under `.git`.
 */
export function indexByBasename(
  root = ROOT,
  groups = ["apps", "packages", "scripts", "docs", "e2e", "tooling"],
) {
  const index = new Map();
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (
        entry.name.startsWith(".") ||
        ["node_modules", "dist", "coverage", ".turbo"].includes(entry.name)
      ) {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      const rel = path.relative(root, full);
      if (!index.has(entry.name)) index.set(entry.name, []);
      index.get(entry.name).push(rel);
    }
  };
  for (const group of groups) {
    const full = path.join(root, group);
    if (fs.existsSync(full)) walk(full);
  }
  return index;
}

/**
 * Replace each stale mention with its unique current path. Ambiguous basenames are reported, never guessed.
 * Returns { fixed, ambiguous }.
 */
export function applyFixes(findings, root = ROOT, index = indexByBasename(root)) {
  const fixed = [];
  const ambiguous = [];
  const byDoc = new Map();
  for (const finding of findings) {
    const candidates = index.get(path.basename(finding.path)) ?? [];
    if (candidates.length !== 1) {
      ambiguous.push({ ...finding, candidates: candidates.slice(0, 5) });
      continue;
    }
    if (!byDoc.has(finding.doc)) byDoc.set(finding.doc, []);
    byDoc.get(finding.doc).push({ from: finding.path, to: candidates[0] });
  }
  for (const [doc, replacements] of byDoc) {
    const absolute = path.join(root, doc);
    let text = fs.readFileSync(absolute, "utf8");
    for (const { from, to } of replacements) {
      text = text.split(from).join(to);
      fixed.push(`${doc}: ${from} → ${to}`);
    }
    fs.writeFileSync(absolute, text);
  }
  return { fixed, ambiguous };
}

function main() {
  const json = process.argv.includes("--json");
  const fix = process.argv.includes("--fix");
  let findings = staleMentions();

  if (fix && findings.length > 0) {
    const { fixed, ambiguous } = applyFixes(findings);
    for (const line of fixed) console.log(`fixed  ${line}`);
    for (const item of ambiguous) {
      console.log(
        `skip   ${item.doc} → ${item.path} (${item.candidates.length} candidates: ${item.candidates.join(", ") || "none"})`,
      );
    }
    findings = staleMentions();
  }

  if (json) {
    process.stdout.write(`${JSON.stringify({ docs: LIVING_DOCS.length, findings }, null, 2)}\n`);
    process.exitCode = findings.length === 0 ? 0 : 1;
    return;
  }

  if (findings.length === 0) {
    console.log(`✓ ${LIVING_DOCS.length} living doc(s) name only paths that exist`);
  } else {
    console.error(`✗ ${findings.length} stale repo path(s) named in living docs:`);
    for (const { doc, path: mentioned } of findings) console.error(`    ${doc} → ${mentioned}`);
    console.error(
      "\nFix: point the mention at the file's current home. If the doc is a dated record rather than a\n" +
        "description of today, move it under docs/archive/ instead of editing the paths.",
    );
  }
  process.exitCode = findings.length === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    if (error instanceof EmptyScanError) {
      console.error(`✗ ${error.message}`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
