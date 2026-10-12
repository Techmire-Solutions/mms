import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";
import {
  MODULE_METRICS_DEFAULT_PERIOD_DAYS,
  type AttendanceCommandMetricsSnapshot,
  type AttendanceListQuery,
  type AttendanceListPageResult,
} from "@mms/shared";
import { attendance, sessionClasses, sessions } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import {
  attendanceRowToRecord as rowToRecord,
  type AttendanceRow,
} from "./attendanceRepositoryMappers.js";
import {
  buildAttendanceListConditions,
  buildAttendanceOrderBy,
} from "./attendanceListQueryBuilders.js";

export async function listAttendancePage(
  tenant: string,
  query: AttendanceListQuery & { afterId?: string; skipCount?: boolean },
): Promise<AttendanceListPageResult & { nextCursor?: string }> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 15), 500);
    const isCursorPaging = Boolean(query.afterId?.trim());
    const offset = isCursorPaging ? 0 : (page - 1) * limit;

    const baseConditions = buildAttendanceListConditions(subdomain, query);
    const conditions = [...baseConditions];
    if (isCursorPaging) {
      conditions.push(sql`${attendance.id} > ${query.afterId!.trim()}`);
    }
    const whereClause = and(...conditions);

    let total = 0;
    if (!query.skipCount) {
      const countRows = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(attendance)
        .where(and(...baseConditions));
      total = Number(countRows[0]?.count ?? 0);
    }

    const classJoinConditions: SQL[] = [
      eq(attendance.workspaceSubdomain, sessionClasses.workspaceSubdomain),
      eq(attendance.classId, sessionClasses.id),
    ];
    if (query.sessionId?.trim()) {
      classJoinConditions.push(eq(sessionClasses.sessionId, query.sessionId.trim()));
    }
    const facultyFilterId = query.facultyId?.trim();
    if (facultyFilterId) {
      classJoinConditions.push(eq(sessionClasses.facultyId, facultyFilterId));
    }

    const orderBy = isCursorPaging
      ? asc(attendance.id)
      : buildAttendanceOrderBy(query.sortField, query.sortDir);

    const rows = await tx
      .select({
        attendance: {
          id: attendance.id,
          classId: attendance.classId,
          studentId: attendance.studentId,
          studentName: attendance.studentName,
          rollNo: attendance.rollNo,
          date: attendance.date,
          status: attendance.status,
          timeIn: attendance.timeIn,
          timeOut: attendance.timeOut,
          notes: attendance.notes,
          deletedAt: attendance.deletedAt,
          deletedBy: attendance.deletedBy,
          deletionReason: attendance.deletionReason,
          createdAt: attendance.createdAt,
          updatedAt: attendance.updatedAt,
        },
        sessionId: sessionClasses.sessionId,
        sessionName: sessions.name,
        facultyId: sessionClasses.facultyId,
      })
      .from(attendance)
      .leftJoin(sessionClasses, and(...classJoinConditions))
      .leftJoin(
        sessions,
        and(
          eq(sessionClasses.workspaceSubdomain, sessions.workspaceSubdomain),
          eq(sessionClasses.sessionId, sessions.id),
        ),
      )
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const records = rows.map((r) => {
      const rec = rowToRecord(r.attendance as AttendanceRow);
      rec.sessionId = r.sessionId ?? "";
      rec.sessionName = r.sessionName ?? "";
      rec.facultyId = r.facultyId ?? "";
      return rec;
    });

    return {
      records,
      total,
      page,
      limit,
      hasMore: isCursorPaging ? rows.length === limit : page * limit < total,
      ...(isCursorPaging && rows.length > 0
        ? { nextCursor: rows[rows.length - 1].attendance.id }
        : {}),
    };
  });
}

/** Active (non-deleted) attendance count for the tenant — used by `/count`. */
export async function countAttendanceActiveByWorkspace(tenant: string): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(attendance)
      .where(and(eq(attendance.workspaceSubdomain, subdomain), isNull(attendance.deletedAt)));
    return Number(rows[0]?.count ?? 0);
  });
}

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
  const selectedDate =
    options?.selectedDate && DATE_RE.test(options.selectedDate)
      ? options.selectedDate
      : new Date().toISOString().slice(0, 10);
  const periodStart = new Date(Date.now() - periodDays * 86_400_000).toISOString().slice(0, 10);

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
        selectedDatePresentRate: sql<number>`coalesce(round(count(*) FILTER (WHERE ${attendance.date} = ${selectedDate} AND ${attendance.status} IN ('present','late')) * 100.0 / nullif(count(*) FILTER (WHERE ${attendance.date} = ${selectedDate}), 0)), 0)::int`,
        overallPresentRate: sql<number>`coalesce(round(count(*) FILTER (WHERE ${attendance.status} IN ('present','late')) * 100.0 / nullif(count(*), 0)), 0)::int`,
        priorDate: sql<string | null>`coalesce(
          (select max(${attendance.date}) from ${attendance} where ${attendance.workspaceSubdomain} = ${subdomain} and ${attendance.deletedAt} is null and ${attendance.date} < ${selectedDate}),
          (select max(${attendance.date}) from ${attendance} where ${attendance.workspaceSubdomain} = ${subdomain} and ${attendance.deletedAt} is null and ${attendance.date} <> ${selectedDate})
        )`,
      })
      .from(attendance)
      .where(active);

    const priorDate = row?.priorDate ?? null;
    let priorDatePresentRate = 0;
    if (priorDate) {
      const [priorRow] = await tx
        .select({
          rate: sql<number>`coalesce(round(count(*) FILTER (WHERE ${attendance.status} IN ('present','late')) * 100.0 / nullif(count(*), 0)), 0)::int`,
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
