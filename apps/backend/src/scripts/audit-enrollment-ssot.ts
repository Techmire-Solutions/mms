import { sql, type SQL } from "drizzle-orm";
import { loadBackendEnv } from "../config/loadEnv.js";
import { closeDatabase, initializeDatabaseConnection } from "../db/dbConnection.js";
import { withGlobalTenant } from "../db/tenant-context.js";
import { logger } from "../lib/logger.js";

loadBackendEnv();

/**
 * Read-only audit for enrollments as the source of truth.
 *
 *   pnpm --filter mms-backend audit:enrollment-ssot
 *
 * Two families of checks (nothing is written; a violation sets exit code 1 so CI/ops can gate):
 *
 *  1. **Legacy memberships** — `student_enrolled_sessions_legacy` pairs with no enrollment row.
 *     Migration 0168 converted the ones with one class/one section; the rest need an administrator
 *     to choose a class (Enrollments → New, or Students → Bulk enroll).
 *  2. **Derived-state divergence** — archived-parent memberships, stale denormalized name
 *     snapshots, invoice↔enrollment link drift (both directions) and current-day attendance marked
 *     for a student who is not enrolled in the class. These are the ways the projections can drift
 *     from the enrollments table.
 */
type OrphanPair = {
  workspace: string;
  studentId: string;
  sessionId: string;
  sessionName: string | null;
  classCount: number;
  sectionCount: number;
};

type ViolationRow = { workspace: string; detail: string };

const DIVERGENCE_CHECKS: ReadonlyArray<{ label: string; query: SQL }> = [
  {
    label: "live enrollment under an archived student",
    query: sql`
      SELECT e.workspace_subdomain AS workspace,
             e.id || ' · student ' || e.student_id AS detail
        FROM enrollments e
        JOIN students s
          ON s.workspace_subdomain = e.workspace_subdomain AND s.id = e.student_id
       WHERE e.deleted_at IS NULL AND s.deleted_at IS NOT NULL
       ORDER BY e.workspace_subdomain, e.id`,
  },
  {
    label: "live enrollment under an archived session",
    query: sql`
      SELECT e.workspace_subdomain AS workspace,
             e.id || ' · session ' || e.session_id AS detail
        FROM enrollments e
        JOIN sessions ses
          ON ses.workspace_subdomain = e.workspace_subdomain AND ses.id = e.session_id
       WHERE e.deleted_at IS NULL AND ses.deleted_at IS NOT NULL
       ORDER BY e.workspace_subdomain, e.id`,
  },
  {
    label: "stale enrollment name snapshot (student / session / class)",
    query: sql`
      SELECT e.workspace_subdomain AS workspace,
             e.id || ' · ' || concat_ws(' / ',
               CASE WHEN c.name IS NOT NULL AND c.name <> e.student_name THEN 'student' END,
               CASE WHEN ses.name IS NOT NULL AND ses.name <> e.session_name THEN 'session' END,
               CASE WHEN sc.name IS NOT NULL AND sc.name <> e.class_name THEN 'class' END) AS detail
        FROM enrollments e
        LEFT JOIN students s
          ON s.workspace_subdomain = e.workspace_subdomain AND s.id = e.student_id
        LEFT JOIN contacts c
          ON c.workspace_subdomain = s.workspace_subdomain AND c.id = s.contact_id
        LEFT JOIN sessions ses
          ON ses.workspace_subdomain = e.workspace_subdomain AND ses.id = e.session_id
        LEFT JOIN session_classes sc
          ON sc.workspace_subdomain = e.workspace_subdomain AND sc.id = e.class_id
       WHERE e.deleted_at IS NULL
         AND ((c.name IS NOT NULL AND c.name <> e.student_name)
           OR (ses.name IS NOT NULL AND ses.name <> e.session_name)
           OR (sc.name IS NOT NULL AND sc.name <> e.class_name))
       ORDER BY e.workspace_subdomain, e.id`,
  },
  {
    label: "enrollment.invoice_id does not link back from the invoice",
    query: sql`
      SELECT e.workspace_subdomain AS workspace,
             e.id || ' · invoice ' || e.invoice_id AS detail
        FROM enrollments e
       WHERE e.deleted_at IS NULL
         AND e.invoice_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM finance_invoices fi
            WHERE fi.workspace_subdomain = e.workspace_subdomain
              AND fi.id = e.invoice_id
              AND fi.enrollment_id = e.id
              AND fi.deleted_at IS NULL)
       ORDER BY e.workspace_subdomain, e.id`,
  },
  {
    label: "invoice points at a missing enrollment",
    query: sql`
      SELECT fi.workspace_subdomain AS workspace,
             fi.id || ' · enrollment ' || fi.enrollment_id AS detail
        FROM finance_invoices fi
       WHERE fi.enrollment_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM enrollments e
            WHERE e.workspace_subdomain = fi.workspace_subdomain
              AND e.id = fi.enrollment_id)
       ORDER BY fi.workspace_subdomain, fi.id`,
  },
  {
    label: "current-day attendance without a live enrollment",
    query: sql`
      SELECT a.workspace_subdomain AS workspace,
             a.id || ' · student ' || a.student_id || ' · class ' || a.class_id AS detail
        FROM attendance a
       WHERE a.deleted_at IS NULL
         AND a.date_on >= current_date
         AND NOT EXISTS (
           SELECT 1 FROM enrollments e
            WHERE e.workspace_subdomain = a.workspace_subdomain
              AND e.student_id = a.student_id
              AND e.class_id = a.class_id
              AND e.deleted_at IS NULL)
       ORDER BY a.workspace_subdomain, a.id`,
  },
];

async function main(): Promise<void> {
  initializeDatabaseConnection();
  let failures = 0;

  const rows = await withGlobalTenant(async (tx) => {
    const result = await tx.execute<OrphanPair>(sql`
      SELECT p.workspace_subdomain AS workspace, p.student_id AS "studentId", p.session_id AS "sessionId",
             ses.name AS "sessionName",
             (SELECT count(*)::int FROM session_classes c WHERE c.workspace_subdomain = p.workspace_subdomain AND c.session_id = p.session_id) AS "classCount",
             (SELECT count(*)::int FROM session_class_sections s WHERE s.workspace_subdomain = p.workspace_subdomain AND s.session_id = p.session_id) AS "sectionCount"
        FROM student_enrolled_sessions_legacy p
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
  if (needsAdmin.length > 0) failures += needsAdmin.length;

  for (const check of DIVERGENCE_CHECKS) {
    const violations = await withGlobalTenant(async (tx) => {
      const result = await tx.execute<ViolationRow>(check.query);
      return result.rows;
    });
    console.log(`[audit:enrollment-ssot] ${check.label}: ${violations.length} violation(s)`);
    for (const violation of violations.slice(0, 20)) {
      console.log(`  ${violation.workspace.padEnd(24)} ${violation.detail}`);
    }
    if (violations.length > 20) console.log(`  … ${violations.length - 20} more`);
    failures += violations.length;
  }

  if (failures > 0) process.exitCode = 1;
  await closeDatabase();
}

main().catch(async (error: unknown) => {
  logger.error({ err: error }, "audit:enrollment-ssot failed");
  console.error("✗ Failed:", error instanceof Error ? error.message : String(error));
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
