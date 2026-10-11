export type { Faculty, FacultyRecord } from "@/tenant/features/faculty/hooks/facultyQueryShared";

export {
  FACULTY_API,
  FACULTY_QUERY_KEY,
  FACULTY_METRICS_QUERY_KEY,
  FACULTY_WIDGET_AGGREGATES_QUERY_KEY,
  type FacultyPaginatedParams,
  type FacultyNextEmployeeIdParams,
  type FacultyWidgetAggregateWidgetInput,
  type FacultyDirectoryQueryInput,
  buildFacultyPageUrl,
  buildFacultyDirectoryQuery,
  sameFacultyListFilters,
  facultyListQueryKeyParams,
  facultyPaginatedQueryKey,
} from "@/tenant/features/faculty/hooks/facultyQueryShared";

export { useFacultyMutations } from "@/tenant/features/faculty/hooks/useFacultyMutations";

export {
  fetchAllFacultyForQuery,
  useFacultyLinkedContactIds,
  useFacultyNextEmployeeId,
  facultyCommandMetricsQueryOptions,
  facultyWidgetAggregatesQueryOptions,
  useFacultyMetrics,
  useFacultyByIds,
  facultyResolveQueryOptions,
  useFacultyWidgetAggregates,
  checkFacultyRegistrationDuplicate,
  migrateFacultyEmployeeIds,
} from "@/tenant/features/faculty/hooks/useFacultyQueries";
