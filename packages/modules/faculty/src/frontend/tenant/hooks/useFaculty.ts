export type { Faculty, FacultyRecord } from "./facultyQueryShared";

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
} from "./facultyQueryShared";

export { useFacultyMutations } from "./useFacultyMutations";

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
} from "./useFacultyQueries";
