import {
  FACULTY_MODULE_MANIFEST,
  type FacultyRecord,
  type FacultyListPageResult,
  type FacultyListQuery,
} from "@mms/shared";
import { FACULTY_API, FACULTY_QUERY_KEY } from "@/tenant/features/faculty/hooks/facultyQueryKeys";

export type { FacultyRecord, FacultyListPageResult };

/** Work list Query params — shared {@link FacultyListQuery} + FE-only `enabled`. */
export type FacultyPaginatedParams = FacultyListQuery & {
  page: number;
  enabled?: boolean;
};

export function buildFacultyPageUrl(params: FacultyPaginatedParams): string {
  const queryParams = new URLSearchParams();
  queryParams.set("page", String(params.page));
  queryParams.set("limit", String(params.limit ?? FACULTY_MODULE_MANIFEST.defaultPageSize));
  if (params.search?.trim()) queryParams.set("search", params.search.trim());
  if (params.status?.trim()) queryParams.set("status", params.status.trim());
  if (params.specialization?.trim())
    queryParams.set("specialization", params.specialization.trim());
  if (params.gender?.trim()) queryParams.set("gender", params.gender.trim());
  if (params.quickFilter && params.quickFilter !== "all")
    queryParams.set("quickFilter", params.quickFilter);
  if (params.sortField?.trim()) queryParams.set("sortField", params.sortField.trim());
  if (params.sortDir?.trim()) queryParams.set("sortDir", params.sortDir.trim());
  if (params.department?.trim()) queryParams.set("department", params.department.trim());
  if (params.designation?.trim()) queryParams.set("designation", params.designation.trim());
  if (params.reportingFacultyId?.trim()) {
    queryParams.set("reportingFacultyId", params.reportingFacultyId.trim());
  }
  if (params.includeDeleted) queryParams.set("includeDeleted", "true");
  return `${FACULTY_API}?${queryParams.toString()}`;
}

export function facultyListQueryKeyParams(params: FacultyPaginatedParams) {
  return {
    page: params.page,
    limit: params.limit ?? FACULTY_MODULE_MANIFEST.defaultPageSize,
    search: params.search?.trim() || "",
    status: params.status?.trim() || "",
    specialization: params.specialization?.trim() || "",
    gender: params.gender?.trim() || "",
    quickFilter: params.quickFilter && params.quickFilter !== "all" ? params.quickFilter : "all",
    sortField: params.sortField?.trim() || "",
    sortDir: params.sortDir?.trim() || "",
    department: params.department?.trim() || "",
    designation: params.designation?.trim() || "",
    reportingFacultyId: params.reportingFacultyId?.trim() || "",
    includeDeleted: Boolean(params.includeDeleted),
  } as const;
}

export function facultyPaginatedQueryKey(params: FacultyPaginatedParams) {
  return [...FACULTY_QUERY_KEY, "page", facultyListQueryKeyParams(params)] as const;
}

/** Keep previous page data only when filters match (avoid stale flash on filter change). */
export function sameFacultyListFilters(
  previous: ReturnType<typeof facultyListQueryKeyParams> | undefined,
  next: ReturnType<typeof facultyListQueryKeyParams>,
): boolean {
  if (!previous) return false;
  return (
    previous.search === next.search &&
    previous.status === next.status &&
    previous.specialization === next.specialization &&
    previous.gender === next.gender &&
    previous.quickFilter === next.quickFilter &&
    previous.includeDeleted === next.includeDeleted &&
    previous.sortField === next.sortField &&
    previous.sortDir === next.sortDir &&
    previous.department === next.department &&
    previous.designation === next.designation &&
    previous.reportingFacultyId === next.reportingFacultyId &&
    previous.limit === next.limit
  );
}
