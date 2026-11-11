import { sql } from "drizzle-orm";
import {
  ATTENDANCE_ATTENDED_STATUSES,
  attendancePctFromCounts,
  evaluateExamEligibility,
  type ExamEligibilityResult,
} from "@mms/shared";
import { withTenantRead } from "../tenant-context.js";
import { loadCountableAttendanceSql } from "./attendanceCountableSql.js";

/**
 * Batched eligibility reads for examinations.
 *
 * Split from `examEligibilityRepository.ts` for the 300-line band: the roster/attendance/
 * threshold queries are the hot path (one batched query per marks save) and are easier to reason
 * about beside the SQL that backs them.
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

/**
 * Effective attendance gate per exam in one query: the exam's own value wins; otherwise the
 * **strictest** owning session value applies (`MIN`). The previous code took an arbitrary
 * `LIMIT 1` session, so a multi-session exam could enforce any of them.
 */
async function loadEffectiveThresholds(
  subdomain: string,
  examIds: readonly string[],
): Promise<Map<string, number | null>> {
  if (examIds.length === 0) return new Map();
  return withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute<{ examId: string; requiredPct: string | null }>(sql`
      SELECT ec.exam_id AS "examId",
             COALESCE(MAX(e.min_attendance_pct), MIN(s.min_attendance_pct)) AS "requiredPct"
        FROM exam_classes ec
        LEFT JOIN exams e
          ON e.workspace_subdomain = ec.workspace_subdomain AND e.id = ec.exam_id
        LEFT JOIN session_classes sc
          ON sc.workspace_subdomain = ec.workspace_subdomain AND sc.id = ec.class_id
        LEFT JOIN sessions s
          ON s.workspace_subdomain = sc.workspace_subdomain AND s.id = sc.session_id
       WHERE ec.workspace_subdomain = ${subdomain}
         AND ec.exam_id IN (${sql.join(
           examIds.map((id) => sql`${id}`),
           sql`, `,
         )})
       GROUP BY ec.exam_id
    `);
    const map = new Map<string, number | null>();
    for (const row of result.rows ?? []) {
      const value = row.requiredPct;
      map.set(String(row.examId), value === null || value === undefined ? null : Number(value));
    }
    return map;
  });
}

/**
 * Per-enrolled-student attendance percentage for a batch of exams, plus any active override.
 *
 * One query for the whole batch (the previous code ran 6–7 queries *per exam* on every marks save,
 * including unchanged re-saves). The roster is the seat-holding enrollment set — the same one the
 * marks grid uses — so a withdrawn student can no longer be graded while being absent from the
 * eligibility rows.
 */
export async function loadExamEligibilityBatch(
  tenant: string,
  examIds: readonly string[],
): Promise<Map<string, ExamEligibilityView>> {
  const subdomain = tenant.trim().toLowerCase();
  const cleanIds = [...new Set(examIds.map((id) => String(id ?? "").trim()).filter(Boolean))];
  if (cleanIds.length === 0) return new Map();

  const countable = await loadCountableAttendanceSql(subdomain);
  const attendedIn = sql.join(
    ATTENDANCE_ATTENDED_STATUSES.map((status) => sql`${status}`),
    sql`, `,
  );
  const requiredByExam = await loadEffectiveThresholds(subdomain, cleanIds);

  const rows = await withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute<{
      examId: string;
      studentId: string;
      studentName: string;
      classId: string;
      present: number;
      countable: number;
      overridden: boolean;
    }>(sql`
      SELECT ec.exam_id AS "examId",
             e.student_id AS "studentId",
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
                 count(*) FILTER (WHERE lower(trim(a.status)) IN (${attendedIn})) AS present
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
       WHERE ec.workspace_subdomain = ${subdomain}
         AND ec.exam_id IN (${sql.join(
           cleanIds.map((id) => sql`${id}`),
           sql`, `,
         )})
       ORDER BY ec.exam_id, e.class_id, c.name
    `);
    return result.rows ?? [];
  });

  const views = new Map<string, ExamEligibilityView>();
  for (const examId of cleanIds) {
    views.set(examId, { examId, requiredPct: requiredByExam.get(examId) ?? null, rows: [] });
  }

  for (const row of rows) {
    const view = views.get(String(row.examId));
    if (!view) continue;
    const pct = attendancePctFromCounts(Number(row.present ?? 0), Number(row.countable ?? 0));
    const decision = evaluateExamEligibility({
      attendancePct: pct,
      minPct: view.requiredPct,
      overridden: row.overridden === true,
    });
    view.rows.push({
      ...decision,
      studentId: String(row.studentId),
      studentName: String(row.studentName ?? ""),
      classId: String(row.classId),
    });
  }

  return views;
}

/** A mark's exact placement for teacher row-scoping: exam → student → class/section. */
export interface ExamStudentSection {
  examId: string;
  studentId: string;
  classId: string;
  sectionId: string | null;
}

/**
 * Class/section of every roster student for the given exams, in one query.
 *
 * Used by the marks-submission guard to apply the exact-section teacher rule: the mark carries the
 * student, and the student's seat-holding enrollment carries the section the teacher must be
 * staffed on. One query for the whole batch.
 */
export async function loadExamStudentSections(
  tenant: string,
  examIds: readonly string[],
): Promise<ExamStudentSection[]> {
  const subdomain = tenant.trim().toLowerCase();
  const cleanIds = [...new Set(examIds.map((id) => String(id ?? "").trim()).filter(Boolean))];
  if (cleanIds.length === 0) return [];
  return withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute<{
      examId: string;
      studentId: string;
      classId: string;
      sectionId: string | null;
    }>(sql`
      SELECT ec.exam_id AS "examId",
             e.student_id AS "studentId",
             e.class_id AS "classId",
             e.section_id AS "sectionId"
        FROM exam_classes ec
        JOIN enrollments e
          ON e.workspace_subdomain = ec.workspace_subdomain
         AND e.class_id = ec.class_id
         AND e.deleted_at IS NULL
         AND e.status NOT IN ('cancelled', 'withdrawn', 'promoted', 'retained', 'graduated', 'left')
       WHERE ec.workspace_subdomain = ${subdomain}
         AND ec.exam_id IN (${sql.join(
           cleanIds.map((id) => sql`${id}`),
           sql`, `,
         )})
    `);
    return (result.rows ?? []).map((row) => ({
      examId: String(row.examId),
      studentId: String(row.studentId),
      classId: String(row.classId),
      sectionId: row.sectionId ? String(row.sectionId) : null,
    }));
  });
}

/** One roster student: the natural key a marks import matches on, plus display fields. */
export interface ExamRosterEntry {
  studentId: string;
  studentName: string;
  rollNumber: string;
  classId: string;
  sectionId: string | null;
}

/**
 * The exam's markable roster with roll numbers (deduplicated per student).
 *
 * Used by the marks importer (roll → student) and the broadsheet export (student names), so both
 * resolve against the same seat-holding enrollment set the marks grid uses.
 */
export async function loadExamRoster(tenant: string, examId: string): Promise<ExamRosterEntry[]> {
  const subdomain = tenant.trim().toLowerCase();
  const cleanId = String(examId ?? "").trim();
  if (!cleanId) return [];
  return withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute<{
      studentId: string;
      studentName: string;
      rollNumber: string | null;
      classId: string;
      sectionId: string | null;
    }>(sql`
      SELECT e.student_id AS "studentId",
             COALESCE(NULLIF(e.student_name, ''), e.student_id) AS "studentName",
             COALESCE(e.roll_no, '') AS "rollNumber",
             e.class_id AS "classId",
             e.section_id AS "sectionId"
        FROM exam_classes ec
        JOIN enrollments e
          ON e.workspace_subdomain = ec.workspace_subdomain
         AND e.class_id = ec.class_id
         AND e.deleted_at IS NULL
         AND e.status NOT IN ('cancelled', 'withdrawn', 'promoted', 'retained', 'graduated', 'left')
       WHERE ec.workspace_subdomain = ${subdomain}
         AND ec.exam_id = ${cleanId}
       ORDER BY COALESCE(e.roll_no, ''), e.student_id
    `);
    const seen = new Set<string>();
    const roster: ExamRosterEntry[] = [];
    for (const row of result.rows ?? []) {
      const studentId = String(row.studentId);
      if (seen.has(studentId)) continue;
      seen.add(studentId);
      roster.push({
        studentId,
        studentName: String(row.studentName),
        rollNumber: String(row.rollNumber ?? ""),
        classId: String(row.classId),
        sectionId: row.sectionId ? String(row.sectionId) : null,
      });
    }
    return roster;
  });
}

/** Single-exam view — a batch of one, so the endpoint and the gate never diverge. */
export async function loadExamEligibility(
  tenant: string,
  examId: string,
): Promise<ExamEligibilityView> {
  const batch = await loadExamEligibilityBatch(tenant, [examId]);
  return batch.get(examId.trim()) ?? { examId, requiredPct: null, rows: [] };
}
