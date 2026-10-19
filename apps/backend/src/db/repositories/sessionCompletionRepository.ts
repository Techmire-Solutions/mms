import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { EnrollmentCompletionStatus } from "@mms/shared";
import { enrollments } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { loadCountableAttendanceSql } from "./attendanceCountableSql.js";
import { isPresentOrLateSql } from "./attendanceReportOverview.js";

export interface CompletionFactRow {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  className: string;
  countableDays: number;
  presentDays: number;
  examsTotal: number;
  examsTaken: number;
  examsPassed: number;
  completedAt: string | null;
  certificateIssuedAt: string | null;
}

/**
 * Per enrollment of a session (not cancelled / withdrawn): attendance inside the enrollment window
 * on countable days (the attendance-rate KPI definition) and results of its class's exams.
 */
export async function loadSessionCompletionFacts(
  tenant: string,
  sessionId: string,
): Promise<CompletionFactRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  const countable = await loadCountableAttendanceSql(subdomain);
  return withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute<Record<string, unknown>>(sql`
      SELECT e.id AS "enrollmentId", e.student_id AS "studentId", e.student_name AS "studentName",
             e.class_name AS "className",
             to_char(e.completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "completedAt",
             to_char(e.certificate_issued_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "certificateIssuedAt",
             COALESCE(att.countable, 0)::int AS "countableDays",
             COALESCE(att.present, 0)::int AS "presentDays",
             COALESCE(ex.total, 0)::int AS "examsTotal",
             COALESCE(ex.taken, 0)::int AS "examsTaken",
             COALESCE(ex.passed, 0)::int AS "examsPassed"
        FROM enrollments e
        LEFT JOIN LATERAL (
          SELECT count(*) AS countable, count(*) FILTER (WHERE ${isPresentOrLateSql("a")}) AS present
            FROM attendance a
           WHERE a.workspace_subdomain = e.workspace_subdomain AND a.deleted_at IS NULL
             AND a.student_id = e.student_id AND a.class_id = e.class_id
             AND (e.start_on IS NULL OR left(a.date, 10) >= e.start_on::text)
             AND (e.end_on IS NULL OR left(a.date, 10) <= e.end_on::text)
             AND ${countable("a")}
        ) att ON true
        LEFT JOIN LATERAL (
          SELECT count(DISTINCT x.id) AS total, count(r.id) AS taken,
                 count(r.id) FILTER (WHERE r.marks_obtained >= x.passing_marks) AS passed
            FROM exam_classes ec
            JOIN exams x ON x.workspace_subdomain = ec.workspace_subdomain AND x.id = ec.exam_id
             AND x.deleted_at IS NULL
            LEFT JOIN exam_results r ON r.workspace_subdomain = x.workspace_subdomain
             AND r.exam_id = x.id AND r.student_id = e.student_id
           WHERE ec.workspace_subdomain = e.workspace_subdomain AND ec.class_id = e.class_id
        ) ex ON true
       WHERE e.workspace_subdomain = ${subdomain} AND e.session_id = ${sessionId}
         AND e.deleted_at IS NULL AND e.status NOT IN ('cancelled', 'withdrawn')
       ORDER BY e.class_name, e.student_name`);
    return result.rows.map((row) => ({
      enrollmentId: String(row.enrollmentId),
      studentId: String(row.studentId),
      studentName: String(row.studentName ?? ""),
      className: String(row.className ?? ""),
      countableDays: Number(row.countableDays ?? 0),
      presentDays: Number(row.presentDays ?? 0),
      examsTotal: Number(row.examsTotal ?? 0),
      examsTaken: Number(row.examsTaken ?? 0),
      examsPassed: Number(row.examsPassed ?? 0),
      completedAt: row.completedAt ? String(row.completedAt) : null,
      certificateIssuedAt: row.certificateIssuedAt ? String(row.certificateIssuedAt) : null,
    }));
  });
}

/**
 * Stores evaluated outcomes. `completed_at` is set when an enrollment first completes and cleared
 * when it no longer does; enrollments that already hold a certificate keep their outcome.
 */
export async function saveCompletionOutcomes(
  tenant: string,
  outcomes: readonly { enrollmentId: string; status: EnrollmentCompletionStatus }[],
): Promise<void> {
  if (outcomes.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    for (const status of ["completed", "not_completed"] as const) {
      const ids = outcomes.filter((row) => row.status === status).map((row) => row.enrollmentId);
      if (ids.length === 0) continue;
      await tx
        .update(enrollments)
        .set({
          completionStatus: status,
          completedAt:
            status === "completed" ? sql`COALESCE(${enrollments.completedAt}, now())` : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(enrollments.workspaceSubdomain, subdomain),
            inArray(enrollments.id, ids),
            isNull(enrollments.certificateIssuedAt),
          ),
        );
    }
  });
}

/** Stamps `certificate_issued_at` on completed enrollments that have none; returns their ids. */
export async function markCertificatesIssued(
  tenant: string,
  sessionId: string,
  enrollmentIds: readonly string[],
): Promise<string[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const filters = [
      eq(enrollments.workspaceSubdomain, subdomain),
      eq(enrollments.sessionId, sessionId),
      eq(enrollments.completionStatus, "completed"),
      isNull(enrollments.certificateIssuedAt),
      isNull(enrollments.deletedAt),
    ];
    if (enrollmentIds.length > 0) filters.push(inArray(enrollments.id, [...enrollmentIds]));
    const rows = await tx
      .update(enrollments)
      .set({ certificateIssuedAt: new Date(), updatedAt: new Date() })
      .where(and(...filters))
      .returning({ id: enrollments.id });
    return rows.map((row) => row.id);
  });
}
