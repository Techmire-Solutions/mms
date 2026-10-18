import { sql } from "drizzle-orm";
import { loadBackendEnv } from "../config/loadEnv.js";
import { closeDatabase, initializeDatabaseConnection } from "../db/dbConnection.js";
import { withGlobalTenant } from "../db/tenant-context.js";
import { logger } from "../lib/logger.js";

loadBackendEnv();

/**
 * Read-only audit for Phase 3 (enrollments = source of truth for student ↔ session membership).
 *
 *   pnpm --filter mms-backend audit:enrollment-ssot
 *
 * Lists `student_enrolled_sessions` pairs that have no enrollment row at all. Migration 0168
 * converts the pairs whose session has exactly one class with exactly one section; everything
 * reported here as "needs admin" must be enrolled into a class by an administrator (Enrollments →
 * New, or Students → Bulk enroll). Nothing is written.
 */
type OrphanPair = {
  workspace: string;
  studentId: string;
  sessionId: string;
  sessionName: string | null;
  classCount: number;
  sectionCount: number;
};

async function main(): Promise<void> {
  initializeDatabaseConnection();
  const rows = await withGlobalTenant(async (tx) => {
    const result = await tx.execute<OrphanPair>(sql`
      SELECT p.workspace_subdomain AS workspace, p.student_id AS "studentId", p.session_id AS "sessionId",
             ses.name AS "sessionName",
             (SELECT count(*)::int FROM session_classes c WHERE c.workspace_subdomain = p.workspace_subdomain AND c.session_id = p.session_id) AS "classCount",
             (SELECT count(*)::int FROM session_class_sections s WHERE s.workspace_subdomain = p.workspace_subdomain AND s.session_id = p.session_id) AS "sectionCount"
        FROM student_enrolled_sessions p
        LEFT JOIN sessions ses ON ses.workspace_subdomain = p.workspace_subdomain AND ses.id = p.session_id
       WHERE NOT EXISTS (
         SELECT 1 FROM enrollments e
          WHERE e.workspace_subdomain = p.workspace_subdomain AND e.student_id = p.student_id AND e.session_id = p.session_id
       )
       ORDER BY p.workspace_subdomain, p.session_id, p.student_id
    `);
    return result.rows;
  });

  const convertible = rows.filter((row) => row.classCount === 1 && row.sectionCount === 1);
  const needsAdmin = rows.filter((row) => !(row.classCount === 1 && row.sectionCount === 1));
  console.log(`[audit:enrollment-ssot] ${rows.length} session pair(s) without an enrollment.`);
  console.log(
    `  • ${convertible.length} convertible by migration 0168 (session has one class / one section)`,
  );
  console.log(`  • ${needsAdmin.length} need an administrator to choose a class\n`);
  for (const row of needsAdmin) {
    console.log(
      `  ${row.workspace.padEnd(24)} student ${row.studentId.padEnd(24)} session ${row.sessionName ?? row.sessionId} (${row.classCount} classes)`,
    );
  }
  if (needsAdmin.length > 0) process.exitCode = 1;
  await closeDatabase();
}

main().catch(async (error: unknown) => {
  logger.error({ err: error }, "audit:enrollment-ssot failed");
  console.error("✗ Failed:", error instanceof Error ? error.message : String(error));
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
