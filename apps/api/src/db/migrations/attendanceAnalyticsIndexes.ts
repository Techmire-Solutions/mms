/**
 * @file attendanceAnalyticsIndexes.ts
 * @description Provision the Attendance module's analytics covering indexes.
 *
 * The dashboard aggregates (widgets, report overview, command metrics) scan `attendance` by
 * workspace and a day range, then aggregate on `status` / `class_id` / `student_id`. Without a
 * covering index those scans walk the heap for every row, and the report's per-student temp table
 * sorts the whole tenant.
 *
 * These builds cannot live in a Drizzle migration: `CREATE INDEX CONCURRENTLY` is rejected inside
 * the migrator's single transaction, and a plain build on a populated `attendance` table is a write
 * outage (the repo's migration-index ratchet flags exactly that). This runs once per boot, right
 * after the Drizzle migrate step, on a disposable `pg.Client` (never inside a transaction), and it
 * is idempotent — a failed concurrent build leaves an invalid index that is dropped and rebuilt.
 */
import type pg from "pg";
import { logger } from "../../lib/logger.js";

/** Serializes the step across replicas (2145836401-406 are taken by other boot steps). */
const ATTENDANCE_INDEX_LOCK_KEY = 2145836407;

type IndexState = "missing" | "valid" | "invalid";

interface ConcurrentIndexSpec {
  name: string;
  createSql: string;
}

const ATTENDANCE_ANALYTICS_INDEXES: readonly ConcurrentIndexSpec[] = [
  {
    // Widget counts/charts and the report overview: range scan per workspace, aggregated from the
    // index payload instead of the heap.
    name: "attendance_workspace_date_status_covering_idx",
    createSql: `
      CREATE INDEX CONCURRENTLY "attendance_workspace_date_status_covering_idx"
        ON public."attendance" ("workspace_subdomain", "date_on")
        INCLUDE ("status", "class_id", "student_id")
        WHERE "deleted_at" IS NULL`,
  },
  {
    // Per-student rates (report temp table, eligibility, absence scan window).
    name: "attendance_workspace_student_date_active_idx",
    createSql: `
      CREATE INDEX CONCURRENTLY "attendance_workspace_student_date_active_idx"
        ON public."attendance" ("workspace_subdomain", "student_id", "date_on")
        WHERE "deleted_at" IS NULL`,
  },
  {
    // The countable-attendance predicate's approved-leave EXISTS, evaluated per attendance row.
    name: "attendance_leaves_workspace_student_approved_idx",
    createSql: `
      CREATE INDEX CONCURRENTLY "attendance_leaves_workspace_student_approved_idx"
        ON public."attendance_leaves" ("workspace_subdomain", "student_id", "from_date", "to_date")
        WHERE "status" = 'approved'`,
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
  if (existing.rowCount === 0) return "missing";
  return existing.rows[0]?.indisvalid ? "valid" : "invalid";
}

/**
 * Creates the analytics indexes if missing. Non-fatal: a failure is logged and the application keeps
 * serving (queries fall back to the previous plans) rather than refusing to boot.
 */
export async function ensureAttendanceAnalyticsIndexes(client: pg.Client): Promise<void> {
  try {
    await client.query("SELECT pg_advisory_lock($1)", [ATTENDANCE_INDEX_LOCK_KEY]);
  } catch (error) {
    logger.warn({ err: error }, "Attendance analytics index lock unavailable; skipping");
    return;
  }
  try {
    const created: string[] = [];
    for (const spec of ATTENDANCE_ANALYTICS_INDEXES) {
      const state = await indexState(client, spec.name);
      if (state === "valid") continue;
      if (state === "invalid") {
        // A failed CONCURRENTLY build leaves an index the planner ignores.
        await client.query(`DROP INDEX CONCURRENTLY IF EXISTS public."${spec.name}"`);
      }
      await client.query(spec.createSql);
      created.push(spec.name);
    }
    if (created.length > 0) {
      logger.info({ indexes: created }, "Provisioned attendance analytics indexes");
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to provision attendance analytics indexes");
  } finally {
    await client
      .query("SELECT pg_advisory_unlock($1)", [ATTENDANCE_INDEX_LOCK_KEY])
      .catch(() => undefined);
  }
}
