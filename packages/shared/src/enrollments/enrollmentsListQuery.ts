import type { Enrollment } from "./enrollmentsModuleManifest.js";
import { ENROLLMENT_STATUSES } from "./enrollmentsModuleManifest.js";
import { paginateArray } from "../core/utils.js";
import { LIST_PAGE_MAX_LIMIT } from "../core/apiSchemas.js";
import { z } from "zod";

/**
 * Enrollments Work-list query.
 *
 * Strict on purpose: unknown query parameters are rejected (the old schema was
 * `.passthrough()`, so a typo silently returned an unfiltered page). `status` accepts
 * `all` or a comma-separated list of real enrollment statuses — an unknown status is a
 * 400 instead of a query against the database that can never match.
 */
const statusListSchema = z
  .string()
  .max(100)
  .optional()
  .refine(
    (value) => {
      const trimmed = value?.trim();
      if (!trimmed || trimmed === "all") return true;
      const statuses = trimmed
        .split(",")
        .map((status) => status.trim())
        .filter(Boolean);
      return (
        statuses.length > 0 &&
        statuses.every((status) => (ENROLLMENT_STATUSES as readonly string[]).includes(status))
      );
    },
    { message: "status must be 'all' or a comma-separated list of enrollment statuses" },
  );

export const enrollmentsListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(LIST_PAGE_MAX_LIMIT).optional(),
    search: z.string().max(500).optional(),
    sortField: z.string().max(64).optional(),
    sortDir: z.union([z.enum(["asc", "desc"]), z.literal("")]).optional(),
    includeDeleted: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
    /** Keyset pagination: fetch rows whose id is strictly greater than this value. */
    afterId: z.string().min(1).max(64).optional(),
    /** Skip the count(*) query when only iteration matters (cursor mode). */
    skipCount: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
    status: statusListSchema,
    sessionId: z.string().max(64).optional(),
    classId: z.string().max(64).optional(),
    sectionId: z.string().max(64).optional(),
    studentId: z.string().max(64).optional(),
  })
  .strict();

export interface EnrollmentsListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sessionId?: string;
  classId?: string;
  sectionId?: string;
  studentId?: string;
  sortField?: string;
  sortDir?: "asc" | "desc" | "";
  includeDeleted?: boolean;
  /** Keyset cursor (id > afterId). */
  afterId?: string;
  skipCount?: boolean;
}

export interface EnrollmentsListPageResult {
  enrollments: Enrollment[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  /** Present only when the request used `afterId` (keyset mode). */
  nextCursor?: string;
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
  if (query.sectionId?.trim() && query.sectionId !== "all") {
    rows = rows.filter((enrollment) => enrollment.sectionId === query.sectionId);
  }
  if (query.studentId?.trim()) {
    rows = rows.filter((enrollment) => enrollment.studentId === query.studentId);
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
