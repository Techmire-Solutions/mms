import { sql } from "drizzle-orm";
import { loadBackendEnv } from "../config/loadEnv.js";
import { closeDatabase, initializeDatabaseConnection } from "../db/dbConnection.js";
import { withGlobalTenant } from "../db/tenant-context.js";
import { logger } from "../lib/logger.js";

loadBackendEnv();

/**
 * Read-only pre-flight for the Phase 12 drop release (0182, after release A / 0181 has shipped):
 *
 *   pnpm --filter mms-backend audit:academic-contract
 *
 * Every blocking count must be 0 before migrating. Each one is a row whose value would otherwise
 * be lost, or left without its replacement, when the legacy columns are dropped. Nothing is
 * written. Safe to re-run after 0182: a check whose column or table is gone is skipped.
 *
 * The same preconditions are re-asserted inside 0182's own transaction, so this script failing
 * open can never turn into a destructive migration.
 */
interface ContractCheck {
  name: string;
  fix: string;
  query: ReturnType<typeof sql>;
  /**
   * Boolean probe run first. When it comes back false the check is skipped, because its shape no
   * longer exists. This cannot be folded into `query` with a CASE: PostgreSQL resolves column and
   * table names when it parses the statement, so a reference to a dropped column raises even on a
   * branch that would never be evaluated.
   */
  requires?: ReturnType<typeof sql>;
  /** Reported but not blocking: 0182 repairs these itself. */
  advisory?: boolean;
}

const columnExists = (table: string, column: string) => sql`SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column}) AS ok`;

const tableExists = (table: string) =>
  sql`SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS ok`;

const CHECKS: ContractCheck[] = [
  {
    // First, because every later check reads a shape release A introduced.
    name: "release A (0181) not applied — student_session_memberships view is missing",
    fix: "deploy release A and let it run everywhere before attempting 0182",
    query: sql`SELECT CASE WHEN to_regclass('public.student_session_memberships') IS NULL
                           THEN 1 ELSE 0 END::int AS n`,
  },
  {
    name: "attendance rows whose date was never converted",
    fix: "run backfill:date-columns, then fix rows audit:date-columns reports",
    query: sql`SELECT count(*)::int AS n FROM attendance WHERE date_on IS NULL`,
  },
  {
    name: "enrollments whose enrolled date was never converted",
    fix: "run backfill:date-columns, then fix rows audit:date-columns reports",
    requires: columnExists("enrollments", "enrolled_date"),
    query: sql`SELECT count(*)::int AS n FROM enrollments
      WHERE enrolled_on IS NULL AND btrim(COALESCE(enrolled_date, '')) <> ''`,
  },
  {
    name: "students whose registered / enrollment date was never converted",
    fix: "run backfill:date-columns, then fix rows audit:date-columns reports",
    requires: columnExists("students", "registered_date"),
    query: sql`SELECT count(*)::int AS n FROM students
      WHERE (registered_on IS NULL AND btrim(COALESCE(registered_date, '')) <> '')
         OR (enrollment_on IS NULL AND btrim(COALESCE(enrollment_date, '')) <> '')`,
  },
  {
    name: "attendance rows that would collide on (class, student, day)",
    fix: "merge the duplicate marks for the same student and day",
    query: sql`SELECT count(*)::int AS n FROM (
      SELECT 1 FROM attendance WHERE date_on IS NOT NULL
       GROUP BY workspace_subdomain, class_id, student_id, date_on HAVING count(*) > 1) d`,
  },
  {
    name: "replacement date_on indexes missing or invalid",
    fix: "run both index:concurrent scripts (date_columns, then academic_contract)",
    query: sql`SELECT count(*)::int AS n
      FROM (VALUES
        ('attendance_workspace_class_student_date_on_uidx'),
        ('attendance_workspace_class_date_on_active_idx'),
        ('attendance_workspace_class_date_on_status_active_idx'),
        ('attendance_workspace_date_on_idx'),
        ('enrollments_workspace_enrolled_on_idx'),
        ('students_workspace_registered_on_idx')
      ) AS expected(name)
     WHERE NOT EXISTS (
       SELECT 1 FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
        WHERE c.relname = expected.name AND i.indisvalid)`,
  },
  {
    name: "membership pairs that neither enrollments nor the legacy table can serve",
    fix: "none needed — 0182 copies these into student_enrolled_sessions_legacy before dropping",
    requires: tableExists("student_enrolled_sessions"),
    query: sql`SELECT count(*)::int AS n FROM student_enrolled_sessions s
      WHERE NOT EXISTS (
        SELECT 1 FROM enrollments e
         WHERE e.workspace_subdomain = s.workspace_subdomain
           AND e.student_id = s.student_id AND e.session_id = s.session_id)
        AND NOT EXISTS (
        SELECT 1 FROM student_enrolled_sessions_legacy l
         WHERE l.workspace_subdomain = s.workspace_subdomain
           AND l.student_id = s.student_id AND l.session_id = s.session_id)`,
    advisory: true,
  },
];

async function main(): Promise<void> {
  initializeDatabaseConnection();
  let blocking = 0;
  await withGlobalTenant(async (tx) => {
    for (const check of CHECKS) {
      if (check.requires) {
        const [probe] = (await tx.execute<{ ok: boolean }>(check.requires)).rows;
        if (!probe?.ok) {
          logger.info({ check: check.name, skipped: "shape already dropped" }, "contract check");
          continue;
        }
      }
      const [row] = (await tx.execute<{ n: number }>(check.query)).rows;
      const n = Number(row?.n ?? 0);
      if (!check.advisory) blocking += n;
      logger.info(
        {
          check: check.name,
          count: n,
          advisory: check.advisory,
          fix: n > 0 ? check.fix : undefined,
        },
        "contract check",
      );
    }
  });
  logger.info({ blocking }, blocking === 0 ? "ready for 0182" : "fix the rows above before 0182");
  await closeDatabase();
  if (blocking > 0) process.exitCode = 1;
}

void main();
