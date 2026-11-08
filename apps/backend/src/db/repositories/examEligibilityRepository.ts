import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  attendancePctFromCounts,
  evaluateExamEligibility,
  type ExamEligibilityResult,
} from "@mms/shared";
import { examEligibilityOverrides, exams } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { loadCountableAttendanceSql } from "./attendanceCountableSql.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";

/**
 * Exam eligibility storage: the threshold on the exam, per-student attendance for its classes, the
 * audited overrides, and the finalisation stamp that completion depends on.
 */

export interface ExamEligibilityRow extends ExamEligibilityResult {
  studentId: string;
  studentName: string;
  classId: string;
}

export interface ExamEligibilityView {
  examId: string;
  /** Effective gate: the exam's own value, else the session's. `null` disables it. */
  requiredPct: number | null;
  rows: ExamEligibilityRow[];
}

/** Reads the exam's explicit gate and falls back to the session's completion threshold. */
async function loadEffectiveThreshold(tenant: string, examId: string): Promise<number | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const [row] = await tx
      .select({ minAttendancePct: exams.minAttendancePct })
      .from(exams)
      .where(and(eq(exams.workspaceSubdomain, subdomain), eq(exams.id, examId)))
      .limit(1);
    if (!row) return null;
    if (row.minAttendancePct !== null && row.minAttendancePct !== undefined) {
      return Number(row.minAttendancePct);
    }
    const [session] = await tx
      .execute<{ pct: number | null }>(
        sql`
      SELECT s.min_attendance_pct AS pct
        FROM exam_classes ec
        JOIN session_classes sc
          ON sc.workspace_subdomain = ec.workspace_subdomain AND sc.id = ec.class_id
        JOIN sessions s
          ON s.workspace_subdomain = sc.workspace_subdomain AND s.id = sc.session_id
       WHERE ec.workspace_subdomain = ${subdomain} AND ec.exam_id = ${examId}
       LIMIT 1
    `,
      )
      .then((result) => (result.rows ?? []) as Array<{ pct: number | null }>);
    return session?.pct === null || session?.pct === undefined ? null : Number(session.pct);
  });
}

/**
 * Per-enrolled-student attendance percentage for an exam's classes, plus any active override.
 *
 * One query: the attendance definition is the shared countable rule (present-or-late over countable
 * instructional, non-leave days), so eligibility cannot drift from completion.
 */
export async function loadExamEligibility(
  tenant: string,
  examId: string,
): Promise<ExamEligibilityView> {
  const subdomain = tenant.trim().toLowerCase();
  const countable = await loadCountableAttendanceSql(subdomain);
  const requiredPct = await loadEffectiveThreshold(subdomain, examId);

  const rows = await withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute<{
      studentId: string;
      studentName: string;
      classId: string;
      present: number;
      countable: number;
      overridden: boolean;
    }>(sql`
      SELECT e.student_id AS "studentId",
             COALESCE(NULLIF(c.name, ''), e.student_name, e.student_id) AS "studentName",
             e.class_id AS "classId",
             COALESCE(att.present, 0)::int AS present,
             COALESCE(att.countable, 0)::int AS countable,
             (o.exam_id IS NOT NULL) AS overridden
        FROM exam_classes ec
        JOIN enrollments e
          ON e.workspace_subdomain = ec.workspace_subdomain
         AND e.class_id = ec.class_id
         AND e.deleted_at IS NULL
         AND e.status NOT IN ('cancelled', 'withdrawn', 'promoted', 'retained', 'graduated', 'left')
        LEFT JOIN students st
          ON st.workspace_subdomain = e.workspace_subdomain AND st.id = e.student_id
        LEFT JOIN contacts c
          ON c.workspace_subdomain = st.workspace_subdomain AND c.id = st.contact_id
        LEFT JOIN LATERAL (
          SELECT count(*) AS countable,
                 count(*) FILTER (WHERE lower(trim(a.status)) IN ('present','late')) AS present
            FROM attendance a
           WHERE a.workspace_subdomain = e.workspace_subdomain
             AND a.deleted_at IS NULL
             AND a.student_id = e.student_id
             AND a.class_id = e.class_id
             AND (e.start_on IS NULL OR a.date_on >= e.start_on)
             AND (e.end_on IS NULL OR a.date_on <= e.end_on)
             AND ${countable("a")}
        ) att ON true
        LEFT JOIN exam_eligibility_overrides o
          ON o.workspace_subdomain = ec.workspace_subdomain
         AND o.exam_id = ec.exam_id
         AND o.student_id = e.student_id
         AND o.revoked_at IS NULL
       WHERE ec.workspace_subdomain = ${subdomain} AND ec.exam_id = ${examId}
       ORDER BY e.class_id, c.name
    `);

    return (result.rows ?? []).map((row) => {
      const pct = attendancePctFromCounts(Number(row.present ?? 0), Number(row.countable ?? 0));
      const decision = evaluateExamEligibility({
        attendancePct: pct,
        minPct: requiredPct,
        overridden: row.overridden === true,
      });
      return {
        ...decision,
        studentId: String(row.studentId),
        studentName: String(row.studentName ?? ""),
        classId: String(row.classId),
      };
    });
  });

  return { examId, requiredPct, rows };
}

/** Sets (or clears) the exam's own attendance gate. */
export async function setExamAttendanceGate(
  tenant: string,
  input: { examId: string; minAttendancePct: number | null; actorId: string },
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    const [before] = await tx
      .select({ minAttendancePct: exams.minAttendancePct })
      .from(exams)
      .where(and(eq(exams.workspaceSubdomain, subdomain), eq(exams.id, input.examId)))
      .limit(1);
    if (!before) return;
    await tx
      .update(exams)
      .set({ minAttendancePct: input.minAttendancePct, updatedAt: new Date() })
      .where(and(eq(exams.workspaceSubdomain, subdomain), eq(exams.id, input.examId)));
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "exams",
      recordId: input.examId,
      actionType: "UPDATE",
      realUserId: input.actorId,
      oldState: { minAttendancePct: before.minAttendancePct },
      newState: { minAttendancePct: input.minAttendancePct },
      minimizeDelta: true,
    });
  });
}

/** Grants an audited override so one student may sit the exam despite the threshold. */
export async function grantEligibilityOverride(
  tenant: string,
  input: { examId: string; studentId: string; reason: string; grantedBy: string },
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(examEligibilityOverrides)
      .values({
        workspaceSubdomain: subdomain,
        examId: input.examId,
        studentId: input.studentId,
        reason: input.reason,
        grantedBy: input.grantedBy,
        grantedAt: new Date(),
        revokedAt: null,
        revokedBy: null,
      })
      .onConflictDoUpdate({
        target: [
          examEligibilityOverrides.workspaceSubdomain,
          examEligibilityOverrides.examId,
          examEligibilityOverrides.studentId,
        ],
        set: {
          reason: input.reason,
          grantedBy: input.grantedBy,
          grantedAt: new Date(),
          revokedAt: null,
          revokedBy: null,
        },
      });
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "exam_eligibility_overrides",
      recordId: `${input.examId}:${input.studentId}`,
      actionType: "CREATE",
      realUserId: input.grantedBy,
      newState: { examId: input.examId, studentId: input.studentId, reason: input.reason },
      minimizeDelta: true,
    });
  });
}

/** Active overrides for a batch of students, used by the results-entry gate. */
export async function listActiveOverrides(
  tenant: string,
  examIds: readonly string[],
  studentIds: readonly string[],
): Promise<Set<string>> {
  const subdomain = tenant.trim().toLowerCase();
  if (examIds.length === 0 || studentIds.length === 0) return new Set();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        examId: examEligibilityOverrides.examId,
        studentId: examEligibilityOverrides.studentId,
      })
      .from(examEligibilityOverrides)
      .where(
        and(
          eq(examEligibilityOverrides.workspaceSubdomain, subdomain),
          inArray(examEligibilityOverrides.examId, [...examIds]),
          inArray(examEligibilityOverrides.studentId, [...studentIds]),
          isNull(examEligibilityOverrides.revokedAt),
        ),
      );
    return new Set(rows.map((row) => `${row.examId}|${row.studentId}`));
  });
}
