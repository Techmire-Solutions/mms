/**
 * Hasanat per-student report read model — one statement, no page limit, session/date aware.
 *
 * Replaces the client-side aggregation that was computed from a single 15-row page of cards.
 */

import { sql } from "drizzle-orm";
import { withTenantRead } from "../tenant-context.js";

export interface HasanatStudentReportRow {
  studentId: string;
  studentName: string;
  className: string;
  faculty: string;
  earned: number;
  balance: number;
  redeemed: number;
}

export interface HasanatStudentReportFilters {
  sessionId?: string | null;
  classId?: string | null;
  from?: string | null;
  to?: string | null;
}

export async function loadHasanatStudentReport(
  tenant: string,
  filters: HasanatStudentReportFilters = {},
): Promise<HasanatStudentReportRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  const sessionId = filters.sessionId?.trim() || null;
  const classId = filters.classId?.trim() || null;
  const from = filters.from?.trim() || null;
  const to = filters.to?.trim() || null;

  const sessionPredicate = sessionId ? sql`AND d.session_id = ${sessionId}` : sql``;
  const classPredicate = classId ? sql`AND d.class_id = ${classId}` : sql``;
  const fromPredicate = from ? sql`AND d.issued_date >= ${from}` : sql``;
  const toPredicate = to ? sql`AND d.issued_date <= ${to}` : sql``;

  return withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute(sql`
      WITH cards AS (
        SELECT d.recipient_student_id AS student_id,
               max(d.recipient_name) AS student_name,
               max(d.recipient_class) AS class_name,
               max(d.issued_by) AS faculty,
               COALESCE(SUM(d.points_snapshot), 0)::int AS earned,
               COALESCE(SUM(d.points_snapshot) FILTER (WHERE d.status = 'active'), 0)::int AS balance
          FROM hasanat_distributions d
         WHERE d.workspace_subdomain = ${subdomain}
           AND d.deleted_at IS NULL
           AND d.recipient_type = 'student'
           AND d.recipient_student_id IS NOT NULL
           ${sessionPredicate}
           ${classPredicate}
           ${fromPredicate}
           ${toPredicate}
         GROUP BY d.recipient_student_id
      ),
      ledger AS (
        SELECT r.student_id,
               COALESCE(
                 SUM(CASE WHEN r.kind = 'reversal' THEN -r.points_used ELSE r.points_used END),
                 0
               )::int AS redeemed
          FROM hasanat_redemptions r
          JOIN hasanat_distributions d
            ON d.workspace_subdomain = r.workspace_subdomain
           AND d.id = r.distribution_id
           AND d.deleted_at IS NULL
         WHERE r.workspace_subdomain = ${subdomain}
           AND r.student_id IS NOT NULL
           ${sessionPredicate}
           ${classPredicate}
           ${fromPredicate}
           ${toPredicate}
         GROUP BY r.student_id
      )
      SELECT c.student_id AS "studentId",
             c.student_name AS "studentName",
             COALESCE(c.class_name, '') AS "className",
             COALESCE(c.faculty, '—') AS "faculty",
             c.earned AS "earned",
             c.balance AS "balance",
             COALESCE(l.redeemed, 0) AS "redeemed"
        FROM cards c
        LEFT JOIN ledger l ON l.student_id = c.student_id
       ORDER BY c.student_name
    `);

    const rows = (result as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    return rows.map((row) => ({
      studentId: String(row.studentId ?? ""),
      studentName: String(row.studentName ?? ""),
      className: String(row.className ?? ""),
      faculty: String(row.faculty ?? "—"),
      earned: Number(row.earned ?? 0),
      balance: Number(row.balance ?? 0),
      redeemed: Number(row.redeemed ?? 0),
    }));
  });
}
