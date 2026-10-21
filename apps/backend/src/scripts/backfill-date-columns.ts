import { sql, type SQL } from "drizzle-orm";
import { loadBackendEnv } from "../config/loadEnv.js";
import { closeDatabase, initializeDatabaseConnection } from "../db/dbConnection.js";
import { withGlobalTenant } from "../db/tenant-context.js";
import { logger } from "../lib/logger.js";

loadBackendEnv();

const BATCH = 2000;

/**
 * Large-table date fills for migration 0173 (target `date` column ← varchar source).
 *
 * OBSOLETE once migration 0182 has been applied: it drops the varchar source columns and the
 * `mms_try_date` helper, so every statement below fails with "column does not exist". Kept only
 * for environments still between 0173 and 0182.
 */
const FILLS: ReadonlyArray<{ label: string; batch: SQL }> = [
  {
    label: "attendance.date_on",
    batch: sql`UPDATE attendance a SET date_on = mms_try_date(a.date)
      FROM (SELECT workspace_subdomain, id FROM attendance
             WHERE date_on IS NULL AND mms_try_date(date) IS NOT NULL
             LIMIT ${BATCH} FOR UPDATE SKIP LOCKED) b
     WHERE a.workspace_subdomain = b.workspace_subdomain AND a.id = b.id`,
  },
  {
    label: "enrollments.enrolled_on",
    batch: sql`UPDATE enrollments e SET enrolled_on = mms_try_date(e.enrolled_date)
      FROM (SELECT workspace_subdomain, id FROM enrollments
             WHERE enrolled_on IS NULL AND mms_try_date(enrolled_date) IS NOT NULL
             LIMIT ${BATCH} FOR UPDATE SKIP LOCKED) b
     WHERE e.workspace_subdomain = b.workspace_subdomain AND e.id = b.id`,
  },
  {
    label: "students.registered_on / enrollment_on",
    batch: sql`UPDATE students s SET registered_on = mms_try_date(s.registered_date), enrollment_on = mms_try_date(s.enrollment_date)
      FROM (SELECT workspace_subdomain, id FROM students
             WHERE (registered_on IS NULL AND mms_try_date(registered_date) IS NOT NULL)
                OR (enrollment_on IS NULL AND mms_try_date(enrollment_date) IS NOT NULL)
             LIMIT ${BATCH} FOR UPDATE SKIP LOCKED) b
     WHERE s.workspace_subdomain = b.workspace_subdomain AND s.id = b.id`,
  },
];

/**
 * Resumable backfill for the 0173 expand columns: fills the new `date` columns from their varchar
 * sources in small batches (short row locks), preserving each row's updated_at. Rows whose source is
 * empty or unparseable stay NULL (see `audit:date-columns`). Safe to re-run.
 *
 *   pnpm --filter mms-backend backfill:date-columns
 */
async function main(): Promise<void> {
  initializeDatabaseConnection();
  for (const fill of FILLS) {
    let total = 0;
    for (;;) {
      const updated = await withGlobalTenant(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.preserve_updated_at', 'on', true)`);
        const result = await tx.execute(fill.batch);
        return Number(result.rowCount ?? 0);
      });
      total += updated;
      if (updated < BATCH) break;
      logger.info({ fill: fill.label, total }, "[backfill:date-columns] batch");
    }
    console.log(`[backfill:date-columns] ${fill.label}: ${total} row(s) filled.`);
  }
  await closeDatabase();
}

main().catch(async (error: unknown) => {
  logger.error({ err: error }, "backfill:date-columns failed");
  process.exitCode = 1;
  await closeDatabase();
});
