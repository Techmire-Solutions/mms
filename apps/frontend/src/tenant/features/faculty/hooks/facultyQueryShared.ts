import type { Faculty, FacultyListQuery, FacultyQuickFilter, FacultySortField } from "@mms/shared";
import { normalizeFacultyFilterValue } from "@/tenant/features/faculty/lib/facultyFilterValues";

export {
  FACULTY_API,
  FACULTY_METRICS_QUERY_KEY,
  FACULTY_QUERY_KEY,
  FACULTY_WIDGET_AGGREGATES_QUERY_KEY,
  buildFacultyPageUrl,
  facultyListQueryKeyParams,
  facultyPaginatedQueryKey,
  sameFacultyListFilters,
} from "./facultyQueryKeys";
export type {
  FacultyRecord,
  FacultyNextEmployeeIdParams,
  FacultyListPageResult,
  FacultyPaginatedParams,
  FacultyWidgetAggregateWidgetInput,
} from "./facultyQueryKeys";
export type { Faculty, FacultyListQuery };

export interface FacultyDirectoryQueryInput {
  search?: string;
  filterStatus: string[];
  filterSpecialization: string;
  filterGender: string;
  filterDepartment?: string;
  filterDesignation?: string;
  filterReportingFacultyId?: string;
  quickFilter: FacultyQuickFilter;
  sortField: FacultySortField | null | undefined;
  sortDir: "asc" | "desc";
}

/** Directory filter state → {@link FacultyListQuery} (Work page + server CSV share this). */
export function buildFacultyDirectoryQuery({
  search,
  filterStatus,
  filterSpecialization,
  filterGender,
  filterDepartment,
  filterDesignation,
  filterReportingFacultyId,
  quickFilter,
  sortField,
  sortDir,
}: FacultyDirectoryQueryInput): FacultyListQuery {
  // Defensive: a neutral `all` selection must never reach the server as a filter.
  const specialization = normalizeFacultyFilterValue(filterSpecialization);
  const gender = normalizeFacultyFilterValue(filterGender);
  const department = normalizeFacultyFilterValue(filterDepartment ?? "");
  const designation = normalizeFacultyFilterValue(filterDesignation ?? "");
  const reportingFacultyId = normalizeFacultyFilterValue(filterReportingFacultyId ?? "");

  return {
    search: search?.trim() || undefined,
    status: filterStatus.length > 0 ? filterStatus.join(",") : undefined,
    specialization: specialization || undefined,
    gender: gender || undefined,
    department: department || undefined,
    designation: designation || undefined,
    reportingFacultyId: reportingFacultyId || undefined,
    quickFilter: quickFilter !== "all" ? quickFilter : undefined,
    sortField: sortField ?? undefined,
    sortDir: sortField ? sortDir : undefined,
  };
}
