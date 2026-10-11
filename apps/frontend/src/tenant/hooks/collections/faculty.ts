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
} from "@/tenant/features/faculty/hooks/useFaculty";

export { useFacultyLookupsQuery } from "@/tenant/features/faculty/hooks/useFacultyLookups";

export {
  FACULTY_PREFERENCES_QUERY_KEY,
  useFacultyPreferencesMutation,
  useComposedFacultySettings,
} from "@/tenant/features/faculty/hooks/useFacultySetupConfig";

export { setFacultyPreferencesMemory } from "@/tenant/features/faculty/hooks/facultySetupConfigApi";

export { applyFacultyWorkDrillDown } from "@/tenant/features/faculty/hooks/facultyWorkDrillDown";

export { invalidateFacultyQueries } from "@/tenant/features/faculty/hooks/invalidateFacultyQueries";

export {
  facultyListQueryOptions,
  useFacultyContractList,
  useFacultyContractGet,
  useFacultyContractCreate,
  useFacultyContractUpdate,
  useFacultyContractDelete,
  useFacultyContractBulkStatus,
  useFacultyContractDuplicateCheck,
  useFacultyContractNextEmployeeId,
} from "@/tenant/features/faculty/hooks/useFacultyTsrHooks";

export {
  FACULTY_DEPARTMENTS_QUERY_KEY,
  facultyDepartmentsQueryOptions,
  useFacultyDepartments,
  useSaveFacultyDepartment,
  useDeleteFacultyDepartment,
  departmentEntitiesToNames,
} from "@/tenant/features/faculty/hooks/useFacultyDepartments";

export {
  FACULTY_DESIGNATIONS_QUERY_KEY,
  facultyDesignationsQueryOptions,
  useFacultyDesignations,
} from "@/tenant/features/faculty/hooks/useFacultyDesignations";
