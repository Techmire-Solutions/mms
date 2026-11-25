import type { z } from "zod";
import type { AttendanceRecord } from "./attendanceModuleManifest.js";
import type { attendanceListQuerySchema } from "./attendanceApiSchemas.js";
import type { attendanceListPageResponseSchema } from "../contracts/attendance.contractSchemas.js";
import { LIST_PAGE_MAX_LIMIT } from "../core/apiSchemas.js";
import { compareByField, paginateArray } from "../core/utils.js";

/**
 * Supported attendance list filters and pagination options.
 *
 * **Inferred from the wire schema** — the hand-written interface used to lag behind it (missing
 * `sectionId`, `afterId`, `skipCount`, and accepting any `sortField` string). One definition now
 * serves the route, the client and the in-memory filter helper.
 */
export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>;

/** Paginated attendance list response, inferred from the contract response schema (incl. `nextCursor`). */
export type AttendanceListPageResult = z.infer<typeof attendanceListPageResponseSchema>;

/** Filters attendance rows using server-supported Work directory fields. */
export function filterAttendanceForQuery(
  records: AttendanceRecord[],
  query: AttendanceListQuery,
): AttendanceRecord[] {
  let rows = records;
  if (query.sessionId?.trim()) {
    rows = rows.filter((record) => record.sessionId === query.sessionId);
  }
  if (query.classId?.trim()) {
    rows = rows.filter((record) => record.classId === query.classId);
  }
  if (query.facultyId?.trim()) {
    const facultyFilter = query.facultyId.trim();
    rows = rows.filter((record) => record.facultyId === facultyFilter);
  }
  if (query.date?.trim()) {
    rows = rows.filter((record) => record.date === query.date);
  }
  if (query.status?.trim()) {
    const statuses = new Set(
      query.status
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    if (statuses.size > 0) {
      rows = rows.filter((record) => statuses.has(record.status));
    }
  }
  if (query.search?.trim()) {
    const search = query.search.trim().toLowerCase();
    rows = rows.filter(
      (record) =>
        record.studentName.toLowerCase().includes(search) ||
        record.rollNo.toLowerCase().includes(search),
    );
  }
  return rows;
}

/** Sorts and paginates an in-memory attendance list. */
export function paginateAttendance(
  records: AttendanceRecord[],
  query: AttendanceListQuery,
): AttendanceListPageResult {
  let rows = filterAttendanceForQuery(records, query);
  if (query.sortField?.trim()) {
    rows = [...rows].sort((left, right) =>
      compareByField(left, right, query.sortField!, query.sortDir === "desc" ? "desc" : "asc"),
    );
  }
  const result = paginateArray(rows, query.page ?? 1, query.limit ?? 15, LIST_PAGE_MAX_LIMIT);
  return {
    records: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
    hasMore: result.hasMore,
  };
}
