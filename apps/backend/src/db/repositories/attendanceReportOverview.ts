import { sql } from "drizzle-orm";
import { ATTENDANCE_ATTENDED_STATUSES } from "@mms/shared";
import { type AttendanceReportOverview } from "@mms/shared";
import { getQueryRows } from "../documentStoreKeys.js";
import type { TenantTransaction } from "../tenant-context.js";
import type { CountableAttendanceSql } from "./attendanceCountableSql.js";

/**
 * Attendance report *overview* aggregate. Split out of
 * `attendanceRepositoryReport.ts` for the ADR-001 line bands — that file still
 * drives the ComparisonMode aggregates and imports `loadAttendanceOverview` /
 * `isPresentOrLateSql` from here, so the dependency stays one-directional.
 */

/**
 * The single "counts as attendance" predicate (present, late, half day).
 *
 * Built from `ATTENDANCE_ATTENDED_STATUSES` so the SQL set can never drift from the shared enum;
 * completion, eligibility, reports and metrics all use this helper.
 */
export function isAttendedSql(alias = "a"): ReturnType<typeof sql> {
  const values = sql.join(
    ATTENDANCE_ATTENDED_STATUSES.map((status) => sql`${status}`),
    sql`, `,
  );
  return sql`lower(trim(${sql.raw(`${alias}.status`)})) IN (${values})`;
}

/** @deprecated Use {@link isAttendedSql}; kept for callers that predate `half_day`. */
export const isPresentOrLateSql = isAttendedSql;

const STUDENT_RATE_LIMIT = 12;

function mapStudentRate(row: Record<string, unknown>) {
  return {
    studentId: String(row.studentId ?? ""),
    name: String(row.name ?? ""),
    presentCount: Number(row.presentCount ?? 0),
    total: Number(row.total ?? 0),
    rate: Number(row.rate ?? 0),
  };
}

/** Only rows counting toward rates (instructional days, not on leave) are aggregated. */
export async function loadAttendanceOverview(
  tx: TenantTransaction,
  subdomain: string,
  countable: CountableAttendanceSql,
  classId?: string,
  /** The tenant's configured low-attendance threshold (was hardcoded to 75). */
  lowAttendanceThreshold = 75,
  /** Optional inclusive day range. Omitted = all time, which keeps the dashboard numbers stable. */
  range?: { dateFrom?: string; dateTo?: string },
): Promise<AttendanceReportOverview> {
  const attendanceClassFilter = classId ? sql`AND a.class_id = ${classId}` : sql``;
  // Range predicates are separate from the class filter so the planner can use the
  // (workspace, date_on) covering index even when a class is also selected.
  const dateRangeFilter = sql`${
    range?.dateFrom ? sql`AND a.date_on >= ${range.dateFrom}` : sql``
  } ${range?.dateTo ? sql`AND a.date_on <= ${range.dateTo}` : sql``}`;
  const sessionClassFilter = classId ? sql`AND sc.id = ${classId}` : sql``;
  const presentOrLate = isAttendedSql("a");

  const classResult = await tx.execute(sql`
    SELECT
      sc.id AS "classId",
      sc.name AS "className",
      s.name AS "sessionName",
      COUNT(a.id) FILTER (WHERE ${presentOrLate})::int AS "presentCount",
      COUNT(a.id)::int AS total,
      COALESCE(
        ROUND(
          100.0 * COUNT(a.id) FILTER (WHERE ${presentOrLate})
          / NULLIF(COUNT(a.id), 0)
        ),
        0
      )::int AS rate
    FROM session_classes sc
    INNER JOIN sessions s
      ON s.workspace_subdomain = sc.workspace_subdomain
     AND s.id = sc.session_id
    LEFT JOIN attendance a
      ON a.workspace_subdomain = sc.workspace_subdomain
     AND a.class_id = sc.id
     AND a.deleted_at IS NULL
     AND ${countable("a")}
    WHERE sc.workspace_subdomain = ${subdomain}
      AND s.deleted_at IS NULL
      ${sessionClassFilter}
    GROUP BY sc.id, sc.name, s.name, s.start_date
    HAVING COUNT(a.id) > 0
    ORDER BY s.start_date ASC, sc.name ASC
  `);

  const statusResult = await tx.execute(sql`
    SELECT
      lower(trim(a.status)) AS status,
      COUNT(*)::int AS count
    FROM attendance a
    WHERE a.workspace_subdomain = ${subdomain}
      AND a.deleted_at IS NULL
      AND ${countable("a")}
      ${attendanceClassFilter}
      ${dateRangeFilter}
    GROUP BY 1
    ORDER BY 1
  `);

  const monthlyResult = await tx.execute(sql`
    SELECT
      date_trunc('month', a.date_on)::date AS "monthKey",
      COUNT(*) FILTER (WHERE ${presentOrLate})::int AS "presentCount",
      COUNT(*)::int AS total,
      COALESCE(
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE ${presentOrLate})
          / NULLIF(COUNT(*), 0)
        ),
        0
      )::int AS rate
    FROM attendance a
    WHERE a.workspace_subdomain = ${subdomain}
      AND a.deleted_at IS NULL
      AND ${countable("a")}
      ${attendanceClassFilter}
      ${dateRangeFilter}
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  // Materialize the per-student aggregation ONCE into a temp table (previously
  // the CTE was inlined into two statements, recomputing this heavy GROUP BY
  // twice). ON COMMIT DROP keeps it scoped to this transaction.
  await tx.execute(sql`
    CREATE TEMP TABLE tmp_attendance_student_rates ON COMMIT DROP AS
    SELECT
      a.student_id AS "studentId",
      COALESCE(MAX(NULLIF(btrim(a.student_name), '')), 'Unknown') AS name,
      COUNT(*) FILTER (WHERE ${presentOrLate})::int AS "presentCount",
      COUNT(*)::int AS total,
      COALESCE(
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE ${presentOrLate})
          / NULLIF(COUNT(*), 0)
        ),
        0
      )::int AS rate
    FROM attendance a
    WHERE a.workspace_subdomain = ${subdomain}
      AND a.deleted_at IS NULL
      AND ${countable("a")}
      ${attendanceClassFilter}
      ${dateRangeFilter}
    GROUP BY a.student_id
  `);

  const studentRateResult = await tx.execute(sql`
    SELECT
      "studentId",
      name,
      "presentCount",
      total,
      rate,
      COUNT(*) FILTER (WHERE rate < ${lowAttendanceThreshold}) OVER ()::int AS "lowAttendanceCount"
    FROM tmp_attendance_student_rates
    ORDER BY rate ASC, name ASC, "studentId" ASC
    LIMIT ${STUDENT_RATE_LIMIT}
  `);

  const topPerformerResult = await tx.execute(sql`
    SELECT "studentId", name, "presentCount", total, rate
    FROM tmp_attendance_student_rates
    ORDER BY rate DESC, total DESC, name ASC, "studentId" ASC
    LIMIT 3
  `);

  const classRates = getQueryRows<Record<string, unknown>>(classResult).map((row) => ({
    classId: String(row.classId ?? ""),
    className: String(row.className ?? ""),
    sessionName: String(row.sessionName ?? ""),
    presentCount: Number(row.presentCount ?? 0),
    total: Number(row.total ?? 0),
    rate: Number(row.rate ?? 0),
  }));
  const statusCounts = getQueryRows<Record<string, unknown>>(statusResult).map((row) => ({
    status: String(row.status ?? ""),
    count: Number(row.count ?? 0),
  }));
  const monthlyTrend = getQueryRows<Record<string, unknown>>(monthlyResult).map((row) => ({
    // `date_trunc` returns a timestamptz/date; the wire type is a `YYYY-MM` key.
    monthKey: String(row.monthKey ?? "").slice(0, 7),
    presentCount: Number(row.presentCount ?? 0),
    total: Number(row.total ?? 0),
    rate: Number(row.rate ?? 0),
  }));
  const studentRateRows = getQueryRows<Record<string, unknown>>(studentRateResult);
  const totalRecords = statusCounts.reduce((sum, item) => sum + item.count, 0);
  const presentRecords = statusCounts.reduce(
    (sum, item) => sum + (item.status === "present" || item.status === "late" ? item.count : 0),
    0,
  );

  return {
    overallRate: totalRecords ? Math.round((presentRecords / totalRecords) * 100) : 0,
    totalRecords,
    lowAttendanceCount: Number(studentRateRows[0]?.lowAttendanceCount ?? 0),
    classRates,
    monthlyTrend,
    studentRates: studentRateRows.map(mapStudentRate),
    topPerformers: getQueryRows<Record<string, unknown>>(topPerformerResult).map(mapStudentRate),
    statusCounts,
  };
}
