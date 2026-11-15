#!/usr/bin/env node
/**
 * Migration hygiene ratchet.
 *
 * Three independent, measured checks that the existing gates do not cover:
 *
 *   1. **lock_timeout on new DDL.** 143 of the 197 applied migrations have no
 *      `lock_timeout`, and 0 use `CONCURRENTLY` (impossible inside Drizzle's
 *      single migration transaction). Applied migrations are immutable
 *      (forward-only), so the past cannot be fixed — but every NEW migration that
 *      runs locking DDL must bound its wait (`SET LOCAL lock_timeout = '2s'`),
 *      otherwise one long query queues every later statement on the table.
 *
 *   2. **No new timezone-naive timestamps.** The DB has 311 bare `timestamp`
 *      columns against 72 `timestamptz`, while Drizzle declares
 *      `withTimezone: true` for them — a mismatch that shifts values whenever the
 *      server session is not UTC. Converting the existing columns is a
 *      table-rewrite project; new columns must be `timestamptz` from day one.
 *
 *   3. **Drizzle snapshot chain.** 20 meta snapshots exist for 197 migrations, so
 *      `drizzle-kit generate` diffs against `0133` and would re-emit 63 already
 *      applied migrations. Regeneration is pending (see docs/open-items.md); this
 *      check stops the gap from growing unnoticed.
 *
 *   4. **Journal chronology & file alignment.** Drizzle's migrator sequences on
 *      the journal `when` value, so a duplicate or non-increasing value silently
 *      skips the later migration forever on existing databases (0208/0217 did
 *      exactly that). Every journal entry must have its SQL file and vice versa.
 *
 * Usage:
 *   node scripts/check-migration-hygiene.mjs [--base origin/main] [--json]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(rootDir, "apps/backend/src/db/migrations_drizzle");
const metaDir = path.join(migrationsDir, "meta");

/** Measured 2026-10-28. These may only go down. */
const BASELINE = {
  missingLockTimeout: 0, // new migrations only (diff-scoped)
  bareTimestamps: 311,
  // 0197 now follows 0133 in the snapshot chain, so the metric is 0. Keeping the
  // old 63 allowed 63 new migrations to ship without a snapshot; 0 makes any
  // future journal entry without one fail. The historical 0134–0196 gap remains
  // a one-time regeneration task (docs/open-items.md).
  missingSnapshots: 0,
  journalIntegrity: 0,
};

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const baseRef = baseIndex >= 0 ? args[baseIndex + 1] : "HEAD^1";
const json = args.includes("--json");

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(migrationsDir)) fail(`Migrations directory not found: ${migrationsDir}`);

// A shallow/unresolvable base used to silently disable the new-migration check
// (the function returned []), so a PR could add locking DDL without
// `lock_timeout` and still pass. Fail closed instead.
try {
  execFileSync("git", ["rev-parse", "--verify", "--quiet", baseRef], {
    cwd: rootDir,
    stdio: "ignore",
  });
} catch {
  fail(`Cannot resolve base ref "${baseRef}" — pass --base <ref> or fetch enough history.`);
}

const sqlFiles = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

/** Files added relative to `baseRef`. */
function addedMigrationFiles() {
  const out = execFileSync(
    "git",
    [
      "diff",
      "--name-only",
      "--diff-filter=A",
      `${baseRef}...HEAD`,
      "--",
      "apps/backend/src/db/migrations_drizzle",
    ],
    { cwd: rootDir, encoding: "utf8" },
  );
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.endsWith(".sql"))
    .map((line) => path.basename(line));
}

// --- 1. lock_timeout on NEW locking DDL ------------------------------------
const LOCKING_DDL =
  /\b(ALTER\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX|CREATE\s+TABLE|DROP\s+TABLE|ALTER\s+INDEX)\b/i;
const added = addedMigrationFiles();
const missingLockTimeout = [];
for (const file of added) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  if (!LOCKING_DDL.test(sql)) continue;
  if (/lock_timeout/i.test(sql)) continue;
  missingLockTimeout.push(file);
}

// --- 2. timezone-naive timestamp columns ------------------------------------
const bareTimestamps = [];
for (const file of sqlFiles) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  // `"<col>" timestamp` not followed by `with time zone`; CREATE TEMP/snapshot
  // statements never match because they do not use this column syntax.
  const pattern = /"([a-z_0-9]+)"\s+timestamp(?!\s+with\s+time\s+zone)/gi;
  for (const match of sql.matchAll(pattern)) {
    bareTimestamps.push({ file, column: match[1] });
  }
}

// --- 3. Drizzle snapshot chain ---------------------------------------------
const journalPath = path.join(metaDir, "_journal.json");
let journalEntries = 0;
if (fs.existsSync(journalPath)) {
  journalEntries = JSON.parse(fs.readFileSync(journalPath, "utf8")).entries?.length ?? 0;
}
const snapshotFiles = fs.existsSync(metaDir)
  ? fs.readdirSync(metaDir).filter((name) => name.endsWith("_snapshot.json"))
  : [];
// `drizzle-kit generate` diffs against the HIGHEST snapshot, so the drift that
// matters is how many journal entries follow it — those are the migrations that
// would be re-emitted as new DDL.
const highestSnapshotIndex = snapshotFiles.reduce((highest, name) => {
  const index = Number.parseInt(name.slice(0, 4), 10);
  return Number.isFinite(index) ? Math.max(highest, index) : highest;
}, -1);
const missingSnapshots = Math.max(0, journalEntries - (highestSnapshotIndex + 1));

// --- 4. Journal chronology & file alignment --------------------------------
// Drizzle records each migration's `when` in `drizzle.__drizzle_migrations` and only applies
// entries whose `when` is greater than the highest recorded value. A duplicated or non-increasing
// `when` therefore makes the later migration permanently invisible on every existing database
// (0208/0217 shipped that way and silently skipped their DDL — the dead-letter column and the
// enrollment CHECK). Those two historical entries are frozen by check:migrations-forward-only and
// are replayed by 0260_migration_journal_drift_repair; every NEW entry must be strictly greater
// than its predecessor and must not reuse an earlier `when`. A journal entry without its SQL file
// (or vice versa) means one side was forgotten.
const journalIntegrity = [];
if (!fs.existsSync(journalPath)) {
  journalIntegrity.push("meta/_journal.json is missing");
} else {
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  const entries = Array.isArray(journal.entries) ? journal.entries : [];
  const journalTags = new Set();
  // Existing entries are immutable (forward-only). Validate only what the change set appends.
  const journalRel = "apps/backend/src/db/migrations_drizzle/meta/_journal.json";
  let frozenEntryCount = null;
  try {
    const baseJournal = JSON.parse(
      execFileSync("git", ["show", `${baseRef}:${journalRel}`], {
        cwd: rootDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
    frozenEntryCount = Array.isArray(baseJournal.entries) ? baseJournal.entries.length : 0;
  } catch {
    journalIntegrity.push(`cannot read ${journalRel} at base ${baseRef}`);
  }
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.idx !== index) {
      journalIntegrity.push(`entry #${index} declares idx ${entry.idx}`);
    }
    if (!entry.tag) {
      journalIntegrity.push(`entry #${index} has no tag`);
      continue;
    }
    journalTags.add(entry.tag);
    if (!fs.existsSync(path.join(migrationsDir, `${entry.tag}.sql`))) {
      journalIntegrity.push(`${entry.tag} has no ${entry.tag}.sql`);
    }
  }
  if (frozenEntryCount !== null) {
    for (let index = frozenEntryCount; index < entries.length; index += 1) {
      const entry = entries[index];
      const previous = entries[index - 1];
      if (typeof entry.when !== "number" || !Number.isFinite(entry.when)) {
        journalIntegrity.push(`${entry.tag} has an invalid when`);
        continue;
      }
      if (previous && entry.when <= previous.when) {
        journalIntegrity.push(
          `${entry.tag} when ${entry.when} does not increase past ${previous.tag} when ${previous.when}`,
        );
      }
      const reuse = entries.slice(0, index).find((earlier) => earlier.when === entry.when);
      if (reuse) {
        journalIntegrity.push(`${entry.tag} reuses when ${entry.when} from ${reuse.tag}`);
      }
    }
  }
  for (const file of sqlFiles) {
    const tag = file.replace(/\.sql$/, "");
    if (!journalTags.has(tag)) journalIntegrity.push(`${file} has no journal entry`);
  }
}

// --- report ----------------------------------------------------------------
const results = [
  {
    name: "New migrations without SET LOCAL lock_timeout",
    count: missingLockTimeout.length,
    baseline: BASELINE.missingLockTimeout,
    sample: missingLockTimeout,
  },
  {
    name: "Timezone-naive `timestamp` columns (prefer timestamptz)",
    count: bareTimestamps.length,
    baseline: BASELINE.bareTimestamps,
    sample: bareTimestamps.slice(-5).map((entry) => `${entry.file}: ${entry.column}`),
  },
  {
    name: "Migrations without a Drizzle meta snapshot",
    count: missingSnapshots,
    baseline: BASELINE.missingSnapshots,
    sample: [
      `journal=${journalEntries} snapshotFiles=${snapshotFiles.length} highest=0${String(highestSnapshotIndex).padStart(3, "0")}`,
    ],
  },
  {
    name: "Journal chronology/file gaps",
    count: journalIntegrity.length,
    baseline: BASELINE.journalIntegrity,
    sample: journalIntegrity.slice(0, 10),
  },
];

if (json) {
  console.log(JSON.stringify({ results, baseRef, added: added.length }, null, 2));
  process.exit(0);
}

let regressions = 0;
for (const result of results) {
  const ok = result.count <= result.baseline;
  if (!ok) regressions += 1;
  const marker = ok ? "✓" : "✗";
  console.log(`${marker} ${result.name}: ${result.count} (baseline ${result.baseline})`);
  if (!ok) for (const sample of result.sample) console.log(`      ${sample}`);
}

if (regressions > 0) {
  fail(
    "Migration hygiene ratchet(s) regressed.\n" +
      "  - New locking DDL must start with `SET LOCAL lock_timeout = '2s';`\n" +
      "  - New timestamp columns must be `timestamp with time zone`\n" +
      "  - Do not add migrations without regenerating the Drizzle snapshot\n" +
      "    (see docs/open-items.md — the 0133→0196 chain is pending regeneration).\n" +
      "  - Journal `when` values appended by this change must increase on the previous entry and must not reuse an earlier value.",
  );
}

console.log("\n✅ Migration hygiene ratchets held.");
