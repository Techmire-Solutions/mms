import { sql } from "drizzle-orm";
import { loadBackendEnv } from "../config/loadEnv.js";
import { closeDatabase, initializeDatabaseConnection } from "../db/dbConnection.js";
import { withGlobalTenant } from "../db/tenant-context.js";
import { logger } from "../lib/logger.js";

loadBackendEnv();

const BATCH = 2000;

/**
 * Resumable backfill for attendance.section_id (migration 0171): copies the section of the
 * student's enrollment in that class onto historical attendance rows, in small batches so it
 * never holds long row locks. Safe to re-run; rows already stamped are skipped.
 *
 *   pnpm --filter mms-backend backfill:attendance-sections
 */
async function main(): Promise<void> {
  initializeDatabaseConnection();
  let total = 0;
  for (;;) {
    const updated = await withGlobalTenant(async (tx) => {
      // Derived fill: keep each row's updated_at (see migration 0173).
      await tx.execute(sql`SELECT set_config('app.preserve_updated_at', 'on', true)`);
      const result = await tx.execute<{ id: string }>(sql`
        WITH batch AS (
          SELECT a.workspace_subdomain, a.id, e.section_id
            FROM attendance a
            JOIN LATERAL (
              SELECT en.section_id FROM enrollments en
               WHERE en.workspace_subdomain = a.workspace_subdomain AND en.student_id = a.student_id
                 AND en.class_id = a.class_id AND en.section_id IS NOT NULL
               ORDER BY (en.deleted_at IS NULL) DESC, en.updated_at DESC
               LIMIT 1
            ) e ON true
           WHERE a.section_id IS NULL
           LIMIT ${BATCH}
           FOR UPDATE OF a SKIP LOCKED
        )
        UPDATE attendance a SET section_id = b.section_id
          FROM batch b
         WHERE a.workspace_subdomain = b.workspace_subdomain AND a.id = b.id
        RETURNING a.id
      `);
      return result.rows.length;
    });
    total += updated;
    if (updated > 0) logger.info({ updated, total }, "[backfill:attendance-sections] batch");
    if (updated < BATCH) break;
  }
  console.log(`[backfill:attendance-sections] stamped ${total} attendance row(s).`);
  await closeDatabase();
}

main().catch(async (error: unknown) => {
  logger.error({ err: error }, "backfill:attendance-sections failed");
  process.exitCode = 1;
  await closeDatabase();
});
