#!/usr/bin/env node
/**
 * Ratchet: applied migrations are immutable — DDL is forward-only.
 *
 * `mms-schema-migrate` states the norm (append a new migration; never rewrite one
 * that may have run), but nothing enforced it: the only thing stopping a retcon was
 * `softDelete0104Regression.test.ts`, which pins exactly one migration's bytes.
 *
 * This closes it generally. A migration file that already exists at the change base
 * must be **byte-identical** now, and must still exist. Adding new migrations is
 * always allowed, as is appending entries to Drizzle's meta/_journal.json (existing
 * entries stay frozen). Renames surface as a delete of the old path, so they fail too.
 *
 * Why not a hash manifest: 166 migrations would need a committed hash list that any
 * whitespace touch would false-fail. Comparing against the change base gives the same
 * protection from data git already stores.
 *
 * Why `--base` exists: the local default resolves `origin/main`'s merge-base, but in
 * CI that ref is often absent and the diff would silently be empty — a vacuously green
 * gate. Passing `--base` explicitly makes an unresolvable ref a hard error instead.
 *
 * Usage:
 *   node scripts/check-migrations-forward-only.mjs                 # vs merge-base(origin/main)
 *   node scripts/check-migrations-forward-only.mjs --base HEAD^1   # CI (PR/push diff)
 *   node scripts/check-migrations-forward-only.mjs --json
 */

import { execFileSync } from "node:child_process";
import process from "node:process";
import { changeBase, changedFiles, readAtBase, readCurrent } from "./lib/changed-files.mjs";

/** Both migration trees: the hand-written TS data migrations and the Drizzle SQL ones. */
const MIGRATION_DIRS = [
  "apps/backend/src/db/migrations/",
  "apps/backend/src/db/migrations_drizzle/",
];

const isMigration = (rel) => MIGRATION_DIRS.some((dir) => rel.startsWith(dir));

/** Drizzle's journal must grow with every new migration; only its existing entries are frozen. */
const JOURNAL = "apps/backend/src/db/migrations_drizzle/meta/_journal.json";

function isAppendOnlyJournal(atBase, now) {
  try {
    const before = JSON.parse(atBase);
    const after = JSON.parse(now);
    const { entries: beforeEntries = [], ...beforeHeader } = before;
    const { entries: afterEntries = [], ...afterHeader } = after;
    return (
      JSON.stringify(beforeHeader) === JSON.stringify(afterHeader) &&
      afterEntries.length >= beforeEntries.length &&
      beforeEntries.every((entry, i) => JSON.stringify(entry) === JSON.stringify(afterEntries[i]))
    );
  } catch {
    return false;
  }
}

function git(args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

const baseFlagIndex = process.argv.indexOf("--base");
const explicitBase = baseFlagIndex === -1 ? null : (process.argv[baseFlagIndex + 1] ?? null);

let files;
let base = changeBase;

if (explicitBase !== null) {
  const resolved = git(["rev-parse", "--verify", `${explicitBase}^{commit}`]);
  if (resolved === null) {
    console.error(
      `✗ --base ${explicitBase} does not resolve to a commit in this checkout.\n` +
        "  Refusing to pass: an unresolvable base makes the diff empty and the gate vacuous.\n" +
        "  Fetch more history (actions/checkout fetch-depth) or pass a valid ref.",
    );
    process.exit(1);
  }
  base = explicitBase;
  files = (git(["diff", "--name-only", base]) ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
} else {
  files = changedFiles();
}

const violations = [];
for (const rel of new Set(files)) {
  if (!isMigration(rel)) continue;
  const atBase = readAtBase(rel);
  // Not present at the base → a genuinely new migration. Always fine.
  if (atBase === null) continue;
  const now = readCurrent(rel);
  if (now === null) {
    violations.push({ file: rel, reason: "deleted" });
  } else if (now !== atBase && !(rel === JOURNAL && isAppendOnlyJournal(atBase, now))) {
    violations.push({ file: rel, reason: "modified" });
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ base, scanned: files.length, violations }, null, 2));
  process.exit(0);
}

console.log("Migrations are forward-only (no rewriting an already-applied migration)");
console.log(`  change set: ${files.length} file(s) vs ${base.slice(0, 9)}`);
for (const v of violations) console.log(`    ${v.reason}: ${v.file}`);

if (violations.length > 0) {
  console.error(
    `\n✗ ${violations.length} already-applied migration(s) changed:\n` +
      violations.map((v) => `  - ${v.file} (${v.reason})`).join("\n") +
      "\n\nAn existing migration may already have run on a deployed database; editing it means\n" +
      "fresh installs and existing installs diverge, and the change never reaches the latter.\n" +
      "Add a NEW migration that performs the fix instead (append-only), e.g.\n" +
      "  apps/backend/src/db/migrations_drizzle/0NNN_<description>.sql\n\n" +
      "See .agent/skills/mms-schema-migrate/SKILL.md (forward-only DDL).",
  );
  process.exit(1);
}

console.log("\n✓ No applied migration was modified.");
