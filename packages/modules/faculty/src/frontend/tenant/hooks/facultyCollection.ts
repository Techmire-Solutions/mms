/**
 * Cross-module public surface for Faculty Query hooks.
 * Preferred over importing from `@/tenant/features/faculty/*`.
 */
export {
  FACULTY_QUERY_KEY,
  FACULTY_METRICS_QUERY_KEY,
  FACULTY_WIDGET_AGGREGATES_QUERY_KEY,
  fetchAllFacultyForQuery,
  facultyCommandMetricsQueryOptions,
  facultyWidgetAggregatesQueryOptions,
  useFacultyMutations,
  useFacultyByIds,
  facultyResolveQueryOptions,
  useFacultyMetrics,
  useFacultyWidgetAggregates,
  type FacultyRecord,
} from "./useFaculty";

export { useFacultyLookupsQuery } from "./useFacultyLookups";

export {
  FACULTY_PREFERENCES_QUERY_KEY,
  useFacultyPreferencesMutation,
  useComposedFacultySettings,
} from "./useFacultySetupConfig";

export { setFacultyPreferencesMemory } from "./facultySetupConfigApi";

export { applyFacultyWorkDrillDown } from "./facultyWorkDrillDown";

export { invalidateFacultyQueries } from "./invalidateFacultyQueries";

export {
  facultyListQueryOptions,
  useFacultyContractList,
  useFacultyContractGet,
  useFacultyContractNextEmployeeId,
} from "./useFacultyTsrQueries";

export {
  useFacultyContractCreate,
  useFacultyContractUpdate,
  useFacultyContractDelete,
  useFacultyContractBulkStatus,
  useFacultyContractDuplicateCheck,
} from "./useFacultyTsrMutations";

export {
  FACULTY_DEPARTMENTS_QUERY_KEY,
  facultyDepartmentsQueryOptions,
  useFacultyDepartments,
  useSaveFacultyDepartment,
  useDeleteFacultyDepartment,
  departmentEntitiesToNames,
} from "./useFacultyDepartments";

export {
  FACULTY_DESIGNATIONS_QUERY_KEY,
  facultyDesignationsQueryOptions,
  useFacultyDesignations,
} from "./useFacultyDesignations";
