import type { Enrollment } from "./enrollmentsModuleManifest.js";
import { paginateArray } from "./utils.js";
import { baseListQuerySchema, LIST_PAGE_MAX_LIMIT } from "./apiSchemas.js";
import { z } from "zod";

export const enrollmentsListQuerySchema = baseListQuerySchema.extend({
  status: z.string().max(100).optional(),
  sessionId: z.string().max(64).optional(),
  classId: z.string().max(64).optional(),
});

export interface EnrollmentsListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sessionId?: string;
  classId?: string;
  sortField?: string;
  sortDir?: "asc" | "desc" | "";
  includeDeleted?: boolean;
}

export interface EnrollmentsListPageResult {
  enrollments: Enrollment[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export function filterEnrollmentsForQuery(
  enrollments: Enrollment[],
  query: EnrollmentsListQuery,
): Enrollment[] {
  let rows = enrollments;
  if (query.status?.trim() && query.status !== "all") {
    const statuses = new Set(
      query.status
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    if (statuses.size > 0) {
      rows = rows.filter((enrollment) => statuses.has(String(enrollment.status)));
    }
  }
  if (query.sessionId?.trim() && query.sessionId !== "all") {
    rows = rows.filter((enrollment) => enrollment.sessionId === query.sessionId);
  }
  if (query.classId?.trim() && query.classId !== "all") {
    rows = rows.filter((enrollment) => enrollment.classId === query.classId);
  }
  if (query.search?.trim()) {
    const search = query.search.trim().toLowerCase();
    rows = rows.filter(
      (enrollment) =>
        enrollment.studentName.toLowerCase().includes(search) ||
        enrollment.sessionName.toLowerCase().includes(search) ||
        enrollment.className.toLowerCase().includes(search),
    );
  }
  return rows;
}

export function paginateEnrollments(
  enrollments: Enrollment[],
  query: EnrollmentsListQuery,
): EnrollmentsListPageResult {
  let rows = filterEnrollmentsForQuery(enrollments, query);
  const sortField = query.sortField?.trim();
  if (sortField) {
    const dir = query.sortDir === "desc" ? -1 : 1;
    rows = [...rows].sort((left, right) => {
      const leftValue = String(Reflect.get(left, sortField) ?? "");
      const rightValue = String(Reflect.get(right, sortField) ?? "");
      return leftValue.localeCompare(rightValue) * dir;
    });
  }
  const result = paginateArray(rows, query.page ?? 1, query.limit ?? 12, LIST_PAGE_MAX_LIMIT);
  return {
    enrollments: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
    hasMore: result.hasMore,
  };
}
