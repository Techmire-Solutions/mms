import {
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import {
  dedupeTrimmedIds,
  isQueryFlagTrue,
  toSqlSearchPattern,
  type AttendanceListQuery,
} from "@mms/shared";
import { attendance, sessionClasses } from "../schema.js";

/**
 * WHERE/ORDER BY builders for the Attendance list page. Split out of
 * `attendanceRepositoryList.ts` for the ADR-001 line bands; only that module
 * consumes them, so no public surface changes.
 */

export function buildAttendanceListConditions(
  subdomain: string,
  query: AttendanceListQuery,
): SQL[] {
  const conditions: SQL[] = [eq(attendance.workspaceSubdomain, subdomain)];

  // Manifest softDelete.workExcludesDeleted — Work = active, trash = deleted-only.
  if (isQueryFlagTrue(query.includeDeleted)) {
    conditions.push(isNotNull(attendance.deletedAt));
  } else {
    conditions.push(isNull(attendance.deletedAt));
  }

  const search = query.search?.trim();
  if (search) {
    const pattern = toSqlSearchPattern(search);
    conditions.push(
      or(ilike(attendance.studentName, pattern), ilike(attendance.rollNo, pattern)) as SQL,
    );
  }

  if (query.classId?.trim()) {
    conditions.push(eq(attendance.classId, query.classId.trim()));
  }
  const sessionId = query.sessionId?.trim();
  const facultyId = query.facultyId?.trim();
  if (sessionId && facultyId) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${sessionClasses} sc
      WHERE sc.workspace_subdomain = ${attendance.workspaceSubdomain}
        AND sc.id = ${attendance.classId}
        AND sc.session_id = ${sessionId}
        AND sc.faculty_id = ${facultyId}
    )`);
  } else if (sessionId) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${sessionClasses} sc
      WHERE sc.workspace_subdomain = ${attendance.workspaceSubdomain}
        AND sc.id = ${attendance.classId}
        AND sc.session_id = ${sessionId}
    )`);
  } else if (facultyId) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${sessionClasses} sc
      WHERE sc.workspace_subdomain = ${attendance.workspaceSubdomain}
        AND sc.id = ${attendance.classId}
        AND sc.faculty_id = ${facultyId}
    )`);
  }
  if (query.date?.trim()) {
    conditions.push(eq(attendance.date, query.date.trim()));
  }
  if (query.dateFrom?.trim()) {
    conditions.push(sql`${attendance.date} >= ${query.dateFrom.trim()}`);
  }
  if (query.dateTo?.trim()) {
    conditions.push(sql`${attendance.date} <= ${query.dateTo.trim()}`);
  }
  const statuses = dedupeTrimmedIds(query.status);
  if (statuses.length) {
    conditions.push(inArray(attendance.status, statuses));
  }

  return conditions;
}

export const ATTENDANCE_SORT_FIELDS = new Set([
  "date",
  "studentName",
  "rollNo",
  "status",
  "updatedAt",
]);

export function buildAttendanceOrderBy(sortField?: string, sortDir?: "asc" | "desc" | ""): SQL {
  const field = sortField?.trim();
  let column: AnyColumn;
  if (field && ATTENDANCE_SORT_FIELDS.has(field)) {
    switch (field) {
      case "updatedAt":
        column = attendance.updatedAt;
        break;
      case "date":
        column = attendance.date;
        break;
      case "studentName":
        column = attendance.studentName;
        break;
      case "rollNo":
        column = attendance.rollNo;
        break;
      case "status":
        column = attendance.status;
        break;
      default:
        column = attendance.updatedAt;
    }
  } else {
    column = attendance.updatedAt;
  }
  return sortDir === "asc" ? asc(column) : desc(column);
}
