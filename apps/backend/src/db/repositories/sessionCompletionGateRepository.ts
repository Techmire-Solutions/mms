import { sql } from "drizzle-orm";
import { withTenantRead } from "../tenant-context.js";
import { loadCountableAttendanceSql, loadWorkspaceWeekdays } from "./attendanceCountableSql.js";

/**
 * Completion finalisation facts (review findings C1–C4/C7):
 * - `unmarkedDays`: instructional days before the session end that have no attendance row;
 * - `unfinalizedExams`: class exams that are not completed with finalized results;
 * - `outstandingDues`: unpaid/credited balance on the enrollment's invoices;
 * - `stale`: attendance/exam evidence changed after the last evaluation.
 * One row per live (non-released) enrollment of the session.
 */
export interface CompletionGateRow {
  enrollmentId: string;
  unmarkedDays: number;
  unfinalizedExams: number;
  outstandingDues: number;
  stale: boolean;
}

export async function loadCompletionGates(
  tenant: string,
  sessionId: string,
): Promise<CompletionGateRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  const weekdays = await loadWorkspaceWeekdays(subdomain);
  const countable = await loadCountableAttendanceSql(subdomain);
  const weekdayLiteral = `{${weekdays.join(",")}}`;

  const result = await withTenantRead(subdomain, (tx) =>
    tx.execute<{
      enrollmentId: string;
      unmarkedDays: number;
      unfinalizedExams: number;
      outstandingDues: string;
      stale: boolean;
    }>(sql`
      SELECT
        e.id AS "enrollmentId",
        GREATEST(expected."days" - marked."days", 0)::int AS "unmarkedDays",
        unfinalized."count"::int AS "unfinalizedExams",
        dues."amount" AS "outstandingDues",
        stale."value" AS "stale"
      FROM enrollments e
      JOIN sessions s
        ON s.workspace_subdomain = e.workspace_subdomain AND s.id = e.session_id
      LEFT JOIN LATERAL (
        SELECT CASE
          WHEN COALESCE(e.start_on, s.start_date) IS NULL
            OR COALESCE(e.end_on, s.end_date) IS NULL THEN 0
          ELSE (
            SELECT count(*)::int
              FROM generate_series(
                     COALESCE(e.start_on, s.start_date)::date,
                     COALESCE(e.end_on, s.end_date)::date,
                     interval '1 day'
                   ) AS g(day)
             WHERE COALESCE(
                     (SELECT ce.kind = 'makeup_day'
                        FROM academic_calendar_events ce
                       WHERE ce.workspace_subdomain = e.workspace_subdomain
                         AND ce.deleted_at IS NULL
                         AND ce.kind IN ('holiday', 'makeup_day')
                         AND g.day::date BETWEEN ce.start_on AND ce.end_on
                         AND (ce.scope = 'workspace'
                           OR (ce.scope = 'session' AND ce.session_id = e.session_id)
                           OR (ce.scope = 'class' AND ce.class_id = e.class_id)
                           OR (ce.scope = 'section' AND ce.section_id = e.section_id))
                       ORDER BY CASE ce.scope
                                  WHEN 'section' THEN 0 WHEN 'class' THEN 1 WHEN 'session' THEN 2 ELSE 3
                                END,
                                (ce.kind = 'holiday') DESC
                       LIMIT 1),
                     extract(dow FROM g.day)::int = ANY(COALESCE(
                       (SELECT array_agg(wd.weekday::int)
                          FROM session_working_days wd
                         WHERE wd.workspace_subdomain = e.workspace_subdomain
                           AND wd.session_id = e.session_id),
                       ${weekdayLiteral}::int[]))
                   )
               AND NOT EXISTS (
                 SELECT 1 FROM attendance_leaves lv
                  WHERE lv.workspace_subdomain = e.workspace_subdomain
                    AND lv.student_id = e.student_id
                    AND lower(lv.status) = 'approved'
                    AND g.day::date BETWEEN lv.from_date AND lv.to_date
               )
          )
        END AS "days"
      ) expected ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS "days"
          FROM attendance a
         WHERE a.workspace_subdomain = e.workspace_subdomain
           AND a.deleted_at IS NULL
           AND a.student_id = e.student_id
           AND a.class_id = e.class_id
           AND (e.start_on IS NULL OR a.date_on >= e.start_on)
           AND (e.end_on IS NULL OR a.date_on <= e.end_on)
           AND ${countable("a")}
      ) marked ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS "count"
          FROM exam_classes ec
          JOIN exams x
            ON x.workspace_subdomain = ec.workspace_subdomain
           AND x.id = ec.exam_id
           AND x.deleted_at IS NULL
         WHERE ec.workspace_subdomain = e.workspace_subdomain
           AND ec.class_id = e.class_id
           AND x.status <> 'cancelled'
           AND (x.status <> 'completed' OR x.results_finalized_at IS NULL)
      ) unfinalized ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(GREATEST(0, fi.final_amt - COALESCE(fi.paid_amt, 0) - fi.credited_amt)), 0)
               AS "amount"
          FROM finance_invoices fi
         WHERE fi.workspace_subdomain = e.workspace_subdomain
           AND fi.enrollment_id = e.id
           AND fi.deleted_at IS NULL
           AND fi.status <> 'cancelled'
      ) dues ON true
      LEFT JOIN LATERAL (
        SELECT s.completion_evaluated_at IS NOT NULL AND (
          -- Deliberately includes soft-deleted rows: deleting a mark changes the numerator and
          -- denominator, so it must flag the evaluation stale (previously it did not).
          EXISTS (
            SELECT 1 FROM attendance a2
             WHERE a2.workspace_subdomain = e.workspace_subdomain
               AND a2.student_id = e.student_id
               AND a2.class_id = e.class_id
               AND a2.updated_at > s.completion_evaluated_at
          )
          -- Approved leave changes the denominator too (leave days are not countable), and it was
          -- never part of the staleness probe at all.
          OR EXISTS (
            SELECT 1 FROM attendance_leaves lv2
             WHERE lv2.workspace_subdomain = e.workspace_subdomain
               AND lv2.student_id = e.student_id
               AND lv2.updated_at > s.completion_evaluated_at
               AND (e.start_on IS NULL OR COALESCE(lv2.to_date, lv2.from_date) >= e.start_on)
               AND (e.end_on IS NULL OR COALESCE(lv2.from_date, lv2.to_date) <= e.end_on)
          )
          OR EXISTS (
            SELECT 1 FROM exam_results r2
             JOIN exam_classes ec2
               ON ec2.workspace_subdomain = r2.workspace_subdomain AND ec2.exam_id = r2.exam_id
             WHERE ec2.workspace_subdomain = e.workspace_subdomain
               AND ec2.class_id = e.class_id
               AND r2.student_id = e.student_id
               AND r2.updated_at > s.completion_evaluated_at
          )
        ) AS "value"
      ) stale ON true
      WHERE e.workspace_subdomain = ${subdomain}
        AND e.session_id = ${sessionId}
        AND e.deleted_at IS NULL
        AND e.status NOT IN ('cancelled', 'withdrawn', 'promoted', 'retained', 'graduated', 'left')
    `),
  );

  return result.rows.map((row) => ({
    enrollmentId: String(row.enrollmentId),
    unmarkedDays: Number(row.unmarkedDays ?? 0),
    unfinalizedExams: Number(row.unfinalizedExams ?? 0),
    outstandingDues: Number(row.outstandingDues ?? 0),
    stale: row.stale === true,
  }));
}
