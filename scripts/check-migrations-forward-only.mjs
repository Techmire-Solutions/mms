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
 * Snapshot metadata (`meta/*_snapshot.json`) is exempt: it is drizzle-kit's diff input,
 * not applied DDL, so repairing a malformed serialization is a metadata repair, not a
 * retcon of history that has run on a database.
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
import { SOURCE_EXTENSIONS, assertScanDirs, fromRoot } from "./lib/repo-paths.mjs";

/** Both migration trees: the hand-written TS data migrations and the Drizzle SQL ones. */
const MIGRATION_DIRS = ["apps/api/src/db/migrations/", "packages/db/migrations_drizzle/"];

// Fail closed: a moved migration tree must fail loudly instead of diffing nothing
// and reporting "no migration changes" (docs/monorepo-migration-plan.md §2.7).
assertScanDirs(
  MIGRATION_DIRS.map((dir) => fromRoot(dir.replace(/\/$/, ""))),
  "migrations forward-only",
  { extensions: [...SOURCE_EXTENSIONS, ".sql"] },
);

const isMigration = (rel) => MIGRATION_DIRS.some((dir) => rel.startsWith(dir));

/**
 * Drizzle snapshot files (`meta/*_snapshot.json`) are diff input — drizzle-kit's
 * serialization of the schema at each migration — not applied DDL. Repairing a
 * malformed serialization is a metadata repair (a reviewed exception), not a
 * retcon of history that has already run on a database, so snapshots are not held
 * byte-identical. Applied migrations (`.sql` and the hand-written TS data
 * migrations) remain immutable, and `meta/_journal.json` remains append-only.
 */
const isSnapshotMetadata = (rel) => rel.endsWith("_snapshot.json");

/** Drizzle's journal must grow with every new migration; only its existing entries are frozen. */
const JOURNAL = "packages/db/migrations_drizzle/meta/_journal.json";

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

/**
 * Structural normalization for already-applied migrations.
 *
 * Package relocations (`@mms/shared` → `@mms/contracts`, `db/*` modules → `@mms/db/*`,
 * `lib/tenantContext` → `@mms/be-core/http`, `repositories/contact*` →
 * `@mms/mod-contacts/backend/repository`, `repositories/accounting*` →
 * `@mms/mod-accounting/backend/repository`) and import-depth fixes are structural, not
 * logic: the SQL and control flow are unchanged. Compare migrations with their import
 * specifiers canonicalized so a repository-wide move does not read as "rewrote an
 * applied migration", while any change to the migration body still fails.
 */
const MOVED_DB_CLIENT =
  /^(?:\.\.\/)+(?:db\/)?(?:dbClient|dbConnection|dbTransactions|rlsRoleGuard|commitScope|dbPoolMetrics|preparedStatements)\.js$/;
const MOVED_DB_CONTEXT =
  /^(?:\.\.\/)+(?:db\/)?(?:tenant-context|tenantScopeGuard|tenantTransactionGuards)\.js$/;
const MOVED_DB_SCHEMA = /^(?:\.\.\/)+(?:db\/)?schema(\/[^"']*)?\.js$/;
const MOVED_SEED = /^(?:\.\.\/)+(?:db\/)?minimalSeeds\.js$/;
const MOVED_LIB = /^(?:\.\.\/)+lib\/(?:softDeleteHelpers|logRedaction)\.js$/;
const MOVED_TENANT_CONTEXT = /^(?:\.\.\/)+lib\/tenantContext\.js$/;
// Domain repositories moved into audience-separated module packages (P5); the
// applied data migrations still import the same symbols with unchanged SQL/body.
const MOVED_MODULE_REPOSITORIES = [
  {
    pattern: /^(?:\.\.\/)+(?:db\/)?repositories\/contact[A-Za-z0-9_]*Repository\.js$/,
    pkg: "@mms/mod-contacts/backend/repository",
  },
  {
    pattern: /^(?:\.\.\/)+(?:db\/)?repositories\/accounting[A-Za-z0-9_]*Repository\.js$/,
    pkg: "@mms/mod-accounting/backend/repository",
  },
  {
    pattern: /^(?:\.\.\/)+(?:db\/)?repositories\/student[A-Za-z0-9_]*Repository\.js$/,
    pkg: "@mms/mod-students/backend/repository",
  },
  {
    pattern:
      /^(?:\.\.\/)+(?:db\/)?repositories\/faculty(?:[A-Za-z0-9_]*Repository|AssignmentValidation)\.js$/,
    pkg: "@mms/mod-faculty/backend/repository",
  },
  {
    pattern: /^(?:\.\.\/)+(?:db\/)?repositories\/session[A-Za-z0-9_]*Repository\.js$/,
    pkg: "@mms/mod-sessions/backend/repository",
  },
  {
    pattern: /^(?:\.\.\/)+(?:db\/)?repositories\/enrollment[A-Za-z0-9_]*Repository\.js$/,
    pkg: "@mms/mod-enrollments/backend/repository",
  },
  {
    pattern: /^(?:\.\.\/)+(?:db\/)?repositories\/obligation[A-Za-z0-9_]*Repository\.js$/,
    pkg: "@mms/mod-obligations/backend/repository",
  },
  {
    pattern: /^(?:\.\.\/)+(?:db\/)?repositories\/finance[A-Za-z0-9_]*Repository\.js$/,
    pkg: "@mms/mod-billing/backend/repository",
  },
  {
    pattern: /^(?:\.\.\/)+(?:db\/)?repositories\/examination[A-Za-z0-9_]*Repository\.js$/,
    pkg: "@mms/mod-examinations/backend/repository",
  },
  {
    pattern: /^(?:\.\.\/)+(?:db\/)?repositories\/hasanat[A-Za-z0-9_]*Repository\.js$/,
    pkg: "@mms/mod-hasanat/backend/repository",
  },
  {
    pattern: /^(?:\.\.\/)+(?:db\/)?repositories\/questionBank[A-Za-z0-9_]*Repository\.js$/,
    pkg: "@mms/mod-question-bank/backend/repository",
  },
  {
    pattern: /^(?:\.\.\/)+(?:db\/)?repositories\/messaging[A-Za-z0-9_]*Repository\.js$/,
    pkg: "@mms/mod-messaging/backend/repository",
  },
  {
    pattern: /^(?:\.\.\/)+(?:db\/)?repositories\/attendance[A-Za-z0-9_]*Repository\.js$/,
    pkg: "@mms/mod-attendance/backend/repository",
  },
  {
    pattern: /^(?:\.\.\/)+(?:db\/)?repositories\/contacts[A-Za-z0-9_]*Repository\.js$/,
    pkg: "@mms/mod-contacts/backend/repository",
  },
  {
    pattern: /^(?:\.\.\/)+(?:db\/)?repositories\/task[A-Za-z0-9_]*Repository\.js$/,
    pkg: "@mms/mod-tasks/backend/repository",
  },
  {
    pattern:
      /^(?:\.\.\/)+(?:db\/)?repositories\/(?:tenantUser|user|workspaceAdminUser)[A-Za-z0-9_]*Repository\.js$/,
    pkg: "@mms/mod-iam/backend/tenant/repository",
  },
];
const MOVED_MIGRATION_MODULE = /^(?:\.{1,2}\/)+(?:migrations\/)?(\d{3}_[A-Za-z0-9_]+)\.js$/;

function canonicalModuleSpecifier(specifier) {
  const normalized = specifier.replaceAll("@mms/shared", "@mms/contracts");
  if (normalized === "@mms/contracts" || normalized.startsWith("@mms/contracts/")) {
    return "@mms/contracts";
  }
  // Canonicalize both the old relative module and its new package subpath to the
  // same bucket, so a relocation compares equal without masking body changes.
  if (normalized === "@mms/db/schema" || normalized.startsWith("@mms/db/schema/")) {
    return "@mms/db/schema";
  }
  const schema = MOVED_DB_SCHEMA.exec(specifier);
  if (schema) return `@mms/db/schema${schema[1] ?? ""}`;
  // The tenant-context ALS now lives behind `@mms/be-core/http` (it re-exports
  // `@mms/db/request-context`); canonicalize the old app-relative shim to the same bucket.
  if (
    MOVED_TENANT_CONTEXT.test(specifier) ||
    normalized === "@mms/be-core/http" ||
    normalized.startsWith("@mms/be-core/http/")
  ) {
    return "@mms/be-core/http";
  }
  for (const { pattern, pkg } of MOVED_MODULE_REPOSITORIES) {
    if (pattern.test(specifier) || normalized === pkg || normalized.startsWith(`${pkg}/`)) {
      return pkg;
    }
  }
  if (
    MOVED_DB_CLIENT.test(specifier) ||
    MOVED_DB_CONTEXT.test(specifier) ||
    MOVED_SEED.test(specifier) ||
    MOVED_LIB.test(specifier)
  ) {
    return "@mms/db";
  }
  if (normalized === "@mms/db" || normalized.startsWith("@mms/db/")) {
    return "@mms/db";
  }
  const migrationModule = MOVED_MIGRATION_MODULE.exec(specifier);
  if (migrationModule) return `@mms/legacy-migration/${migrationModule[1]}`;
  return specifier;
}

function normalizeStructural(content) {
  return content
    .replace(
      /(\bfrom\s*)(["'])([^"']+)\2/g,
      (_m, prefix, quote, spec) => `${prefix}${quote}${canonicalModuleSpecifier(spec)}${quote}`,
    )
    .replace(
      /(\bimport\s*\(\s*)(["'])([^"']+)\2/g,
      (_m, prefix, quote, spec) => `${prefix}${quote}${canonicalModuleSpecifier(spec)}${quote}`,
    )
    .replace(
      /(\bimport\s+)(["'])([^"']+)\2/g,
      (_m, prefix, quote, spec) => `${prefix}${quote}${canonicalModuleSpecifier(spec)}${quote}`,
    );
}

const violations = [];
for (const rel of new Set(files)) {
  if (!isMigration(rel) || isSnapshotMetadata(rel)) continue;
  const atBase = readAtBase(rel);
  // Not present at the base → a genuinely new migration. Always fine.
  if (atBase === null) continue;
  const now = readCurrent(rel);
  if (now === null) {
    violations.push({ file: rel, reason: "deleted" });
  } else if (
    normalizeStructural(now) !== normalizeStructural(atBase) &&
    !(rel === JOURNAL && isAppendOnlyJournal(atBase, now))
  ) {
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
      "  packages/db/migrations_drizzle/0NNN_<description>.sql\n\n" +
      "See .agent/skills/mms-schema-migrate/SKILL.md (forward-only DDL).",
  );
  process.exit(1);
}

console.log("\n✓ No applied migration was modified.");
