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
} from "@mms/mod-examinations/frontend/tenant/hooks/useExaminationsApi";
export {
  useComposedExaminationsSettings,
  useExaminationPreferencesMutation,
  useExaminationPreferencesQuery,
  EXAMINATIONS_PREFERENCES_QUERY_KEY,
} from "@mms/mod-examinations/frontend/tenant/hooks/useExaminationSetupConfig";
export { invalidateExaminationsQueries } from "@mms/mod-examinations/frontend/tenant/hooks/invalidateExaminationsQueries";
export { EXAMINATIONS_ELIGIBILITY_QUERY_KEY } from "@mms/mod-examinations/frontend/tenant/hooks/examinationsQueryKeys";
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
} from "@mms/mod-examinations/frontend/tenant/hooks/useExaminationsQueries";
export { useExaminationsReportAggregates } from "@mms/mod-examinations/frontend/tenant/hooks/useExaminationsReportAggregates";
