/**
 * Cross-module public surface for Obligations Query hooks.
 * Other features and shared UI must import from here — not `@/tenant/features/obligations/hooks/*`.
 */
export {
  OBLIGATIONS_TYPES_QUERY_KEY,
  OBLIGATIONS_MUJTAHIDS_QUERY_KEY,
  OBLIGATIONS_REPS_QUERY_KEY,
  OBLIGATIONS_WAKALA_QUERY_KEY,
  OBLIGATIONS_DISTRIBUTIONS_QUERY_KEY,
  OBLIGATIONS_COLLECTIONS_QUERY_KEY,
  OBLIGATIONS_METRICS_QUERY_KEY,
  OBLIGATIONS_REPORT_AGGREGATES_QUERY_KEY,
  useObligationsTypes,
  useObligationsTypesCollection,
  useObligationsMujtahids,
  useObligationsMujtahidsCollection,
  useObligationsReps,
  useObligationsRepsCollection,
  useObligationsWakala,
  useObligationsWakalaCollection,
  useObligationsDistributions,
  useObligationsDistributionsCollection,
  useObligationsCollections,
  useObligationsCollectionsCollection,
  obligationsCommandMetricsQueryOptions,
  useObligationsMetrics,
  useObligationsReportAggregates,
  useObligationsMutations,
} from "@/tenant/features/obligations/hooks/useObligationsApi";
export { invalidateObligationsQueries } from "@/tenant/features/obligations/hooks/invalidateObligationsQueries";
// Phase 7: contract-driven tsrClient hooks & query factories
export {
  obligationsCollectionsListQueryOptions,
  useObligationsContractCollections,
  useObligationsContractTypes,
  useObligationsContractMujtahids,
  useObligationsContractDistributions,
  useObligationsContractReps,
  useObligationsContractWakala,
  useObligationsContractDeleteCollection,
  useObligationsContractRestoreCollection,
  useObligationsContractBulkDeleteCollections,
  useObligationsContractBulkRestoreCollections,
} from "@/tenant/features/obligations/hooks/useObligationsQueries";
export {
  useObligationsSettings,
  loadObligationsSettings,
  saveObligationsSettings,
} from "@/tenant/features/obligations/hooks/useObligationsSettings";
export {
  OBLIGATIONS_PREFERENCES_QUERY_KEY,
  useObligationsPreferencesQuery,
  useObligationsPreferencesMutation,
  useComposedObligationsSettings,
} from "@/tenant/features/obligations/hooks/useObligationsSetupConfig";

