/**
 * Cross-module public surface for Students Query hooks.
 * Other features and shared UI must import from here — not `@/tenant/features/students/hooks/*`.
 * Prefer paginated / by-id / metrics APIs.
 */
export {
  STUDENTS_QUERY_KEY,
  STUDENTS_METRICS_QUERY_KEY,
  STUDENTS_WIDGET_AGGREGATES_QUERY_KEY,
  fetchAllStudentsForQuery,
  studentsCommandMetricsQueryOptions,
  useStudentMutations,
  useStudentsByIds,
  useStudentsMetrics,
  useStudentsWidgetAggregates,
  type StudentRecord,
} from "./useStudents";
export { useStudentLookupsQuery } from "./useStudentLookups";
export {
  STUDENTS_PREFERENCES_QUERY_KEY,
  useStudentPreferencesMutation,
  useComposedStudentsSettings,
} from "./useStudentSetupConfig";
export { setStudentPreferencesMemory } from "./studentSetupConfigApi";
export { applyStudentsWorkDrillDown } from "./studentsWorkDrillDown";
export { invalidateStudentsQueries } from "./invalidateStudentsQueries";
// Phase 7: contract-driven tsrClient hooks (single list key + fetcher)
export {
  studentsListQueryOptions,
  useStudentsContractList,
  useStudentsContractCreate,
  useStudentsContractUpdate,
  useStudentsContractDelete,
  useStudentsContractBulkStatus,
  useStudentsContractBulkEnroll,
  useStudentsContractDuplicateCheck,
} from "./useStudentsQueries";
