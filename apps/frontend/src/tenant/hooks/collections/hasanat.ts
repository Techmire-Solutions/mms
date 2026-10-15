/**
 * Cross-module public surface for Hasanat Query hooks.
 * Other features and shared UI must import from here — not `@/tenant/features/hasanat/hooks/*`.
 */
export {
  HASANAT_DENOMS_QUERY_KEY,
  HASANAT_BATCHES_QUERY_KEY,
  HASANAT_DISTRIBUTIONS_QUERY_KEY,
  HASANAT_REDEMPTIONS_QUERY_KEY,
  HASANAT_METRICS_QUERY_KEY,
  HASANAT_REPORT_AGGREGATES_QUERY_KEY,
  useHasanatDenoms,
  useHasanatDenomsCollection,
  useHasanatBatches,
  useHasanatBatchesCollection,
  useHasanatDistributions,
  useHasanatDistributionsCollection,
  useHasanatReportAggregates,
  useHasanatRedemptions,
  useHasanatRedemptionsCollection,
  hasanatCommandMetricsQueryOptions,
  useHasanatMetrics,
  useHasanatMutations,
} from "@/tenant/features/hasanat/hooks/useHasanatApi";
export { invalidateHasanatQueries } from "@/tenant/features/hasanat/hooks/invalidateHasanatQueries";
export {
  useComposedHasanatSettings,
  useHasanatPreferencesQuery,
  useHasanatPreferencesMutation,
  HASANAT_PREFERENCES_QUERY_KEY,
} from "@/tenant/features/hasanat/hooks/useHasanatSetupConfig";
// Phase 7: contract-driven tsrClient hooks & query factories
export {
  hasanatListQueryOptions,
  useHasanatContractList,
  useHasanatContractDenoms,
  useHasanatContractBatches,
  useHasanatContractRedemptions,
  useHasanatContractBulkDelete,
  useHasanatContractBulkRestore,
  useHasanatContractDeleteDistribution,
  useHasanatContractRestoreDistribution,
} from "@/tenant/features/hasanat/hooks/useHasanatQueries";
