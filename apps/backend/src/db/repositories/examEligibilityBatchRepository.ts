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
 * Effective attendance gate per exam in one query: the exam's own value wins (0 disables);
 * otherwise the **strictest non-zero** owning-session requirement applies (`MAX`). The previous
 * code used `MIN`, which is the *most lenient* threshold — a 60 % session let a 65 % student pass
 * even when another owning session required 75 %.
 */
async function loadEffectiveThresholds(
  subdomain: string,
  examIds: readonly string[],
): Promise<Map<string, number | null>> {
  if (examIds.length === 0) return new Map();
  return withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute<{ examId: string; requiredPct: string | null }>(sql`
      SELECT ec.exam_id AS "examId",
             COALESCE(MAX(e.min_attendance_pct), MAX(NULLIF(s.min_attendance_pct, 0))) AS "requiredPct"
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
      WITH roster AS (
        SELECT ec.exam_id AS "examId",
               e.student_id AS "studentId",
               e.student_name AS "studentName",
               e.class_id AS "classId",
               e.start_on AS "startOn",
               e.end_on AS "endOn"
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
      ),
      windows AS (
        SELECT DISTINCT "studentId", "classId", "startOn", "endOn" FROM roster
      ),
      counts AS (
        SELECT w."studentId" AS "studentId",
               w."classId" AS "classId",
               count(a.id)::int AS countable,
               count(a.id) FILTER (WHERE lower(trim(a.status)) IN (${attendedIn}))::int AS present
          FROM windows w
          LEFT JOIN attendance a
            ON a.workspace_subdomain = ${subdomain}
           AND a.student_id = w."studentId"
           AND a.class_id = w."classId"
           AND a.deleted_at IS NULL
           AND (w."startOn" IS NULL OR a.date_on >= w."startOn")
           AND (w."endOn" IS NULL OR a.date_on <= w."endOn")
           AND ${countable("a")}
         GROUP BY w."studentId", w."classId"
      )
      SELECT r."examId" AS "examId",
             r."studentId" AS "studentId",
             COALESCE(NULLIF(c.name, ''), r."studentName", r."studentId") AS "studentName",
             r."classId" AS "classId",
             COALESCE(cnt.countable, 0)::int AS countable,
             COALESCE(cnt.present, 0)::int AS present,
             (o.exam_id IS NOT NULL) AS overridden
        FROM roster r
        LEFT JOIN students st
          ON st.workspace_subdomain = ${subdomain} AND st.id = r."studentId"
        LEFT JOIN contacts c
          ON c.workspace_subdomain = st.workspace_subdomain AND c.id = st.contact_id
        LEFT JOIN counts cnt
          ON cnt."studentId" = r."studentId" AND cnt."classId" = r."classId"
        LEFT JOIN exam_eligibility_overrides o
          ON o.workspace_subdomain = ${subdomain}
         AND o.exam_id = r."examId"
         AND o.student_id = r."studentId"
         AND o.revoked_at IS NULL
       ORDER BY r."examId", r."classId", c.name
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

/** Single-exam view — a batch of one, so the endpoint and the gate never diverge. */
export async function loadExamEligibility(
  tenant: string,
  examId: string,
): Promise<ExamEligibilityView> {
  const batch = await loadExamEligibilityBatch(tenant, [examId]);
  return batch.get(examId.trim()) ?? { examId, requiredPct: null, rows: [] };
}
