import { sql } from "drizzle-orm";
import { type AttendanceReportOverview } from "@mms/shared";
import { getQueryRows } from "../documentStoreKeys.js";
import type { TenantTransaction } from "../tenant-context.js";

/**
 * Attendance report *overview* aggregate. Split out of
 * `attendanceRepositoryReport.ts` for the ADR-001 line bands — that file still
 * drives the ComparisonMode aggregates and imports `loadAttendanceOverview` /
 * `isPresentOrLateSql` from here, so the dependency stays one-directional.
 */

export function isPresentOrLateSql(alias = "a"): ReturnType<typeof sql> {
  return sql`lower(trim(${sql.raw(`${alias}.status`)})) IN ('present', 'late')`;
}

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

export async function loadAttendanceOverview(
  tx: TenantTransaction,
  subdomain: string,
  classId?: string,
): Promise<AttendanceReportOverview> {
  const attendanceClassFilter = classId ? sql`AND a.class_id = ${classId}` : sql``;
  const sessionClassFilter = classId ? sql`AND sc.id = ${classId}` : sql``;
  const presentOrLate = isPresentOrLateSql("a");

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
      ${attendanceClassFilter}
    GROUP BY 1
    ORDER BY 1
  `);

  const monthlyResult = await tx.execute(sql`
    SELECT
      left(a.date, 7) AS "monthKey",
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
      AND a.date ~ '^[0-9]{4}-(0[1-9]|1[0-2])-[0-9]{2}'
      ${attendanceClassFilter}
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
      ${attendanceClassFilter}
    GROUP BY a.student_id
  `);

  const studentRateResult = await tx.execute(sql`
    SELECT
      "studentId",
      name,
      "presentCount",
      total,
      rate,
      COUNT(*) FILTER (WHERE rate < 75) OVER ()::int AS "lowAttendanceCount"
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
    monthKey: String(row.monthKey ?? ""),
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
