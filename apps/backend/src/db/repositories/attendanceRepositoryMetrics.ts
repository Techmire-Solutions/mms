import { and, eq, isNull, sql } from "drizzle-orm";
import {
  ATTENDANCE_ATTENDED_STATUSES,
  MODULE_METRICS_DEFAULT_PERIOD_DAYS,
  type AttendanceCommandMetricsSnapshot,
} from "@mms/contracts";
import { attendance } from "@mms/db/schema";
import { withTenantRead } from "@mms/db/context";
import { loadCountableAttendanceSql } from "./attendanceCountableSql.js";
import { getWorkspaceTimezone } from "../../lib/workspaceTimezone.js";
import { todayInTimeZone } from "../../lib/dbDate.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * SQL aggregates for Attendance command-centre metrics. `date` is a YYYY-MM-DD
 * varchar, so lexicographic comparison is correct. `selectedDate` defaults to
 * today (UTC, matching the prior JS reducer's `toISOString().slice(0,10)`).
 */
export async function aggregateAttendanceCommandMetrics(
  tenant: string,
  options?: { selectedDate?: string; periodDays?: number },
): Promise<AttendanceCommandMetricsSnapshot> {
  const subdomain = tenant.trim().toLowerCase();
  const periodDays = options?.periodDays ?? MODULE_METRICS_DEFAULT_PERIOD_DAYS;
  // "Today" and the period window are workspace-local calendar days — `attendance.date`
  // is a YYYY-MM-DD string, so UTC `toISOString().slice(0,10)` could land on the wrong
  // day for a workspace ahead of/behind UTC (2026-11-17 review, m13).
  const timezone = await getWorkspaceTimezone(subdomain);
  const selectedDate =
    options?.selectedDate && DATE_RE.test(options.selectedDate)
      ? options.selectedDate
      : todayInTimeZone(timezone);
  const periodStart = todayInTimeZone(timezone, new Date(Date.now() - periodDays * 86_400_000));

  const countable = (await loadCountableAttendanceSql(subdomain))('"attendance"');
  // One placeholder list for every "attended" filter (present, late, half day).
  const attendedIn = sql.join(
    ATTENDANCE_ATTENDED_STATUSES.map((status) => sql`${status}`),
    sql`, `,
  );
  return withTenantRead(subdomain, async (tx) => {
    const active = and(eq(attendance.workspaceSubdomain, subdomain), isNull(attendance.deletedAt));

    const [row] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        selectedDatePresent: sql<number>`count(*) FILTER (WHERE ${attendance.date} = ${selectedDate} AND ${attendance.status} = 'present')::int`,
        selectedDateAbsent: sql<number>`count(*) FILTER (WHERE ${attendance.date} = ${selectedDate} AND ${attendance.status} = 'absent')::int`,
        selectedDateLate: sql<number>`count(*) FILTER (WHERE ${attendance.date} = ${selectedDate} AND ${attendance.status} = 'late')::int`,
        selectedDateExcused: sql<number>`count(*) FILTER (WHERE ${attendance.date} = ${selectedDate} AND ${attendance.status} = 'excused')::int`,
        periodTotal: sql<number>`count(*) FILTER (WHERE ${attendance.date} >= ${periodStart})::int`,
        selectedDatePresentRate: sql<number>`coalesce(round(count(*) FILTER (WHERE ${countable} AND ${attendance.date} = ${selectedDate} AND ${attendance.status} IN (${attendedIn})) * 100.0 / nullif(count(*) FILTER (WHERE ${countable} AND ${attendance.date} = ${selectedDate}), 0)), 0)::int`,
        overallPresentRate: sql<number>`coalesce(round(count(*) FILTER (WHERE ${countable} AND ${attendance.status} IN (${attendedIn})) * 100.0 / nullif(count(*) FILTER (WHERE ${countable}), 0)), 0)::int`,
        priorDate: sql<string | null>`coalesce(
          (select max(${attendance.date})::text from ${attendance} where ${attendance.workspaceSubdomain} = ${subdomain} and ${attendance.deletedAt} is null and ${attendance.date} < ${selectedDate}),
          (select max(${attendance.date})::text from ${attendance} where ${attendance.workspaceSubdomain} = ${subdomain} and ${attendance.deletedAt} is null and ${attendance.date} <> ${selectedDate})
        )`,
      })
      .from(attendance)
      .where(active);

    const priorDate = row?.priorDate ?? null;
    let priorDatePresentRate = 0;
    if (priorDate) {
      const [priorRow] = await tx
        .select({
          rate: sql<number>`coalesce(round(count(*) FILTER (WHERE ${countable} AND ${attendance.status} IN (${attendedIn})) * 100.0 / nullif(count(*) FILTER (WHERE ${countable}), 0)), 0)::int`,
        })
        .from(attendance)
        .where(and(active, eq(attendance.date, priorDate)));
      priorDatePresentRate = Number(priorRow?.rate ?? 0);
    }

    return {
      total: Number(row?.total ?? 0),
      selectedDatePresent: Number(row?.selectedDatePresent ?? 0),
      selectedDateAbsent: Number(row?.selectedDateAbsent ?? 0),
      selectedDateLate: Number(row?.selectedDateLate ?? 0),
      selectedDateExcused: Number(row?.selectedDateExcused ?? 0),
      periodTotal: Number(row?.periodTotal ?? 0),
      selectedDatePresentRate: Number(row?.selectedDatePresentRate ?? 0),
      priorDatePresentRate,
      overallPresentRate: Number(row?.overallPresentRate ?? 0),
    };
  });
}
