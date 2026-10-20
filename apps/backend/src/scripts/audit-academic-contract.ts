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
 * Every count must be 0 before migrating. Each one is a row whose value would otherwise be lost
 * or left without its replacement when the legacy columns are dropped. Nothing is written.
 */
const CHECKS: { name: string; fix: string; query: ReturnType<typeof sql> }[] = [
  {
    name: "attendance rows whose date was never converted",
    fix: "run backfill:date-columns, then fix rows audit:date-columns reports",
    query: sql`SELECT count(*)::int AS n FROM attendance WHERE date_on IS NULL`,
  },
  {
    name: "enrollments whose enrolled date was never converted",
    fix: "run backfill:date-columns, then fix rows audit:date-columns reports",
    query: sql`SELECT count(*)::int AS n FROM enrollments
      WHERE enrolled_on IS NULL AND btrim(COALESCE(enrolled_date, '')) <> ''`,
  },
  {
    name: "students whose registered / enrollment date was never converted",
    fix: "run backfill:date-columns, then fix rows audit:date-columns reports",
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
];

async function main(): Promise<void> {
  initializeDatabaseConnection();
  let blocking = 0;
  await withGlobalTenant(async (tx) => {
    for (const check of CHECKS) {
      const [row] = (await tx.execute<{ n: number }>(check.query)).rows;
      const n = Number(row?.n ?? 0);
      blocking += n;
      logger.info(
        { check: check.name, count: n, fix: n > 0 ? check.fix : undefined },
        "contract check",
      );
    }
  });
  logger.info({ blocking }, blocking === 0 ? "ready for 0182" : "fix the rows above before 0182");
  await closeDatabase();
  if (blocking > 0) process.exitCode = 1;
}

void main();
