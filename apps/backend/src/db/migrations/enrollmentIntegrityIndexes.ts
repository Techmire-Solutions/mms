/**
 * @file enrollmentIntegrityIndexes.ts
 * @description Provision the Enrollments module's integrity/performance indexes.
 *
 * The database is the only backstop against duplicate live enrollments and duplicate
 * roll numbers; the application checks are advisory (read-then-insert, and some run on
 * the read replica). Those indexes cannot live in a Drizzle migration: `CREATE INDEX
 * CONCURRENTLY` is rejected inside the migrator's single transaction, and a plain build
 * on a populated `enrollments` table is a write outage. They used to sit in three
 * unreferenced `.sql` files, so most databases never got them.
 *
 * This runs once per boot, right after the Drizzle migrate step, on a disposable
 * `pg.Client` (never inside a transaction). It is idempotent and repairs invalid
 * indexes left behind by a failed concurrent build.
 *
 * A unique build is skipped — never fatal — when existing rows violate it. Refusing to
 * boot a school's system because two enrollment rows collide is worse than running with
 * the application-level guard, and the skip is logged at error level with the offending
 * ids so the data can be repaired. Non-unique builds always proceed.
 */
import type pg from "pg";
import { logger } from "../../lib/logger.js";

/** Serializes the whole step across replicas (2145836401/02/03 are taken by other boot steps). */
const ENROLLMENT_INDEX_LOCK_KEY = 2145836406;

type IndexState = "missing" | "valid" | "invalid";

interface ConcurrentIndexSpec {
  name: string;
  /** Pre-flight that must return no rows before a unique build. */
  duplicateCheckSql?: string;
  createSql: string;
}

const RELEASED_STATUSES_SQL = sqlList([
  "cancelled",
  "withdrawn",
  "promoted",
  "retained",
  "graduated",
  "left",
]);

function sqlList(values: readonly string[]): string {
  return values.map((value) => `'${value.replace(/'/g, "''")}'`).join(", ");
}

const ENROLLMENT_INDEXES: readonly ConcurrentIndexSpec[] = [
  {
    name: "enrollments_live_student_session_uidx",
    duplicateCheckSql: `
      SELECT "workspace_subdomain", "session_id", "student_id",
             array_agg("id" ORDER BY "id") AS enrollment_ids
        FROM public."enrollments"
       WHERE "deleted_at" IS NULL
         AND "status" NOT IN (${RELEASED_STATUSES_SQL})
       GROUP BY 1, 2, 3
      HAVING count(*) > 1
       LIMIT 5`,
    createSql: `
      CREATE UNIQUE INDEX CONCURRENTLY "enrollments_live_student_session_uidx"
        ON public."enrollments" ("workspace_subdomain", "session_id", "student_id")
        WHERE "deleted_at" IS NULL
          AND "status" NOT IN (${RELEASED_STATUSES_SQL})`,
  },
  {
    name: "enrollments_section_roll_no_active_uidx",
    duplicateCheckSql: `
      SELECT "workspace_subdomain", "section_id", lower(btrim("roll_no")) AS roll_no,
             array_agg("id" ORDER BY "id") AS enrollment_ids
        FROM public."enrollments"
       WHERE "deleted_at" IS NULL
         AND "roll_no" IS NOT NULL
         AND btrim("roll_no") <> ''
         AND "status" <> 'cancelled'
       GROUP BY 1, 2, 3
      HAVING count(*) > 1
       LIMIT 5`,
    createSql: `
      CREATE UNIQUE INDEX CONCURRENTLY "enrollments_section_roll_no_active_uidx"
        ON public."enrollments" ("workspace_subdomain", "section_id", lower(btrim("roll_no")))
        WHERE "deleted_at" IS NULL
          AND "roll_no" IS NOT NULL
          AND btrim("roll_no") <> ''
          AND "status" <> 'cancelled'`,
  },
  {
    name: "enrollments_session_promoted_from_uidx",
    duplicateCheckSql: `
      SELECT "workspace_subdomain", "session_id", "promoted_from_enrollment_id",
             array_agg("id" ORDER BY "id") AS enrollment_ids
        FROM public."enrollments"
       WHERE "deleted_at" IS NULL
         AND "promoted_from_enrollment_id" IS NOT NULL
       GROUP BY 1, 2, 3
      HAVING count(*) > 1
       LIMIT 5`,
    createSql: `
      CREATE UNIQUE INDEX CONCURRENTLY "enrollments_session_promoted_from_uidx"
        ON public."enrollments" ("workspace_subdomain", "session_id", "promoted_from_enrollment_id")
        WHERE "promoted_from_enrollment_id" IS NOT NULL
          AND "deleted_at" IS NULL`,
  },
  {
    name: "enrollments_workspace_section_idx",
    createSql: `
      CREATE INDEX CONCURRENTLY "enrollments_workspace_section_idx"
        ON public."enrollments" ("workspace_subdomain", "section_id")
        WHERE "deleted_at" IS NULL`,
  },
  {
    // Seat counts group by class/section for one session; `status` is in the payload so
    // the count can be answered from the index alone.
    name: "enrollments_seat_count_idx",
    createSql: `
      CREATE INDEX CONCURRENTLY "enrollments_seat_count_idx"
        ON public."enrollments" ("workspace_subdomain", "session_id", "class_id", "section_id")
        INCLUDE ("status")
        WHERE "deleted_at" IS NULL`,
  },
];

async function indexState(client: pg.Client, indexName: string): Promise<IndexState> {
  const existing = await client.query<{ indisvalid: boolean }>(
    `SELECT i.indisvalid FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1`,
    [indexName],
  );
  if (!existing.rows.length) return "missing";
  return existing.rows[0]?.indisvalid ? "valid" : "invalid";
}

async function hasDuplicateRows(client: pg.Client, spec: ConcurrentIndexSpec): Promise<boolean> {
  if (!spec.duplicateCheckSql) return false;
  const duplicates = await client.query(spec.duplicateCheckSql);
  if (duplicates.rows.length === 0) return false;
  logger.error(
    { index: spec.name, duplicates: duplicates.rows },
    `Skipping unique enrollment index ${spec.name}: existing rows violate it. ` +
      "Repair the duplicate rows (see apps/backend/src/scripts/enrollment_integrity_concurrent_indexes.sql) " +
      "and restart — the index is created on the next boot.",
  );
  return true;
}

export async function ensureEnrollmentIntegrityIndexes(client: pg.Client): Promise<void> {
  await client.query("SELECT pg_advisory_lock($1)", [ENROLLMENT_INDEX_LOCK_KEY]);
  try {
    const created: string[] = [];
    for (const spec of ENROLLMENT_INDEXES) {
      const state = await indexState(client, spec.name);
      if (state === "valid") continue;
      if (state === "invalid") {
        // A failed CONCURRENTLY build leaves an index the planner ignores.
        await client.query(`DROP INDEX CONCURRENTLY IF EXISTS public."${spec.name}"`);
      }
      if (await hasDuplicateRows(client, spec)) continue;
      await client.query(spec.createSql);
      created.push(spec.name);
    }
    if (created.length > 0) {
      logger.info({ indexes: created }, "Provisioned enrollment integrity indexes");
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [ENROLLMENT_INDEX_LOCK_KEY]);
  }
}
