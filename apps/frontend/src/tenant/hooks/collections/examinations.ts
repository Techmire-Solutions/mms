/**
 * Cross-module public surface for Examinations Query hooks.
 * Other features and shared UI must import from here — not `@/tenant/features/examinations/hooks/*`.
 */
export {
  useExaminationsExams,
  useExaminationsExamsCollection,
  useExaminationsResults,
  useExaminationsResultsCollection,
  examinationsCommandMetricsQueryOptions,
  useExaminationsMetrics,
  useExaminationsMutations,
} from "@/tenant/features/examinations/hooks/useExaminationsApi";
export {
  useComposedExaminationsSettings,
  useExaminationPreferencesMutation,
  useExaminationPreferencesQuery,
  EXAMINATIONS_PREFERENCES_QUERY_KEY,
} from "@/tenant/features/examinations/hooks/useExaminationSetupConfig";
export { invalidateExaminationsQueries } from "@/tenant/features/examinations/hooks/invalidateExaminationsQueries";
// Phase 7: contract-driven tsrClient hooks & query factories
export {
  examinationsExamsListQueryOptions,
  useExaminationsContractList,
  useExaminationsContractResults,
  useExaminationsContractBulkDelete,
  useExaminationsContractBulkRestore,
  useExaminationsContractBulkUpdateExams,
  useExaminationsContractBulkUpdateResults,
  useExaminationsContractDeleteExam,
  useExaminationsContractRestoreExam,
} from "@/tenant/features/examinations/hooks/useExaminationsTsrHooks";
export { useExaminationsReportAggregates } from "@/tenant/features/examinations/hooks/useExaminationsReportAggregates";
