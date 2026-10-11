/**
 * Cross-module public surface for Accounting Query hooks.
 * Other features and shared UI must import from here — not `@/tenant/features/accounting/hooks/*`.
 */
export {
  useAccountingAccountsPaginated,
  useAccountingEntriesPaginated,
  useAccountingFiscalYearsPaginated,
  useAccountingReportAggregates,
  useAccountingMutations,
  accountingCommandMetricsQueryOptions,
  useAccountingMetrics,
  ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/accounting/hooks/useAccountingApi";
export { invalidateAccountingQueries } from "@/tenant/features/accounting/hooks/invalidateAccountingQueries";
export {
  useComposedAccountingSettings,
  useAccountingPreferencesMutation,
  useAccountingPreferencesQuery,
  ACCOUNTING_PREFERENCES_QUERY_KEY,
} from "@/tenant/features/accounting/hooks/useAccountingSetupConfig";
// Phase 7: contract-driven tsrClient hooks & query factories
export {
  accountingAccountsListQueryOptions,
  accountingEntriesListQueryOptions,
  accountingFiscalYearsListQueryOptions,
  useAccountingContractAccounts,
  useAccountingContractEntries,
  useAccountingContractFiscalYears,
  useAccountingContractUpsertAccounts,
  useAccountingContractUpsertEntries,
  useAccountingContractUpsertFiscalYears,
  useAccountingContractDeleteEntry,
  useAccountingContractRestoreEntry,
  useAccountingContractBulkDeleteEntries,
  useAccountingContractBulkRestoreEntries,
} from "@/tenant/features/accounting/hooks/useAccountingTsrHooks";
export {
  type JournalEntryFilterState,
  EMPTY_JOURNAL_ENTRY_FILTERS,
} from "@/tenant/features/accounting/components/journalEntriesControllerFilters";
