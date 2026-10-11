import {
  STUDENTS_MODULE_MANIFEST,
  type StudentRecord,
  type StudentsListPageResult,
  type StudentsListQuery,
} from "@mms/shared";
import {
  STUDENTS_API,
  STUDENTS_QUERY_KEY,
} from "@/tenant/features/students/hooks/studentsQueryKeys";

export type { StudentRecord, StudentsListPageResult };

/** Work list Query params — shared {@link StudentsListQuery} + FE-only `enabled`. */
export type StudentsPaginatedParams = StudentsListQuery & {
  page: number;
  enabled?: boolean;
};

export function buildStudentsPageUrl(params: StudentsPaginatedParams): string {
  const queryParams = new URLSearchParams();
  queryParams.set("page", String(params.page));
  queryParams.set("limit", String(params.limit ?? STUDENTS_MODULE_MANIFEST.defaultPageSize));
  if (params.search?.trim()) queryParams.set("search", params.search.trim());
  if (params.status?.trim()) queryParams.set("status", params.status.trim());
  if (params.gender?.trim()) queryParams.set("gender", params.gender.trim());
  if (params.quickFilter && params.quickFilter !== "all")
    queryParams.set("quickFilter", params.quickFilter);
  if (params.sortField?.trim()) queryParams.set("sortField", params.sortField.trim());
  if (params.sortDir?.trim()) queryParams.set("sortDir", params.sortDir.trim());
  if (params.includeDeleted) queryParams.set("includeDeleted", "true");
  if (params.sessionId?.trim()) queryParams.set("sessionId", params.sessionId.trim());
  if (params.className?.trim()) queryParams.set("className", params.className.trim());
  return `${STUDENTS_API}?${queryParams.toString()}`;
}

export function studentsListQueryKeyParams(params: StudentsPaginatedParams) {
  return {
    page: params.page,
    limit: params.limit ?? STUDENTS_MODULE_MANIFEST.defaultPageSize,
    search: params.search?.trim() || "",
    status: params.status?.trim() || "",
    gender: params.gender?.trim() || "",
    quickFilter: params.quickFilter && params.quickFilter !== "all" ? params.quickFilter : "all",
    sortField: params.sortField?.trim() || "",
    sortDir: params.sortDir?.trim() || "",
    includeDeleted: Boolean(params.includeDeleted),
    sessionId: params.sessionId?.trim() || "",
    className: params.className?.trim() || "",
  } as const;
}

export function studentsPaginatedQueryKey(params: StudentsPaginatedParams) {
  return [...STUDENTS_QUERY_KEY, "page", studentsListQueryKeyParams(params)] as const;
}

/** Keep previous page data only when filters match (avoid stale flash on filter change). */
export function sameStudentsListFilters(
  previous: ReturnType<typeof studentsListQueryKeyParams> | undefined,
  next: ReturnType<typeof studentsListQueryKeyParams>,
): boolean {
  if (!previous) return false;
  return (
    previous.search === next.search &&
    previous.status === next.status &&
    previous.gender === next.gender &&
    previous.quickFilter === next.quickFilter &&
    previous.includeDeleted === next.includeDeleted &&
    previous.sortField === next.sortField &&
    previous.sortDir === next.sortDir &&
    previous.limit === next.limit &&
    previous.sessionId === next.sessionId &&
    previous.className === next.className
  );
}
