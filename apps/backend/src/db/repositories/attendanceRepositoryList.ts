import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { type AttendanceListQuery, type AttendanceListPageResult } from "@mms/shared";
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
          markedBy: attendance.markedBy,
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

export { aggregateAttendanceCommandMetrics } from "./attendanceRepositoryMetrics.js";
