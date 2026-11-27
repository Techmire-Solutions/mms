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
} from "@mms/mod-accounting/frontend/tenant/hooks/useAccountingApi";
export {
  ACCOUNTING_ENTRIES_QUERY_KEY,
  ACCOUNTING_METRICS_QUERY_KEY,
} from "@mms/mod-accounting/frontend/tenant/hooks/accountingQueryKeys";
export { invalidateAccountingQueries } from "@mms/mod-accounting/frontend/tenant/hooks/invalidateAccountingQueries";
export {
  useComposedAccountingSettings,
  useAccountingPreferencesMutation,
  useAccountingPreferencesQuery,
  ACCOUNTING_PREFERENCES_QUERY_KEY,
} from "@mms/mod-accounting/frontend/tenant/hooks/useAccountingSetupConfig";
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
} from "@mms/mod-accounting/frontend/tenant/hooks/useAccountingContractHooks";
export {
  type JournalEntryFilterState,
  EMPTY_JOURNAL_ENTRY_FILTERS,
} from "@mms/mod-accounting/frontend/tenant/lib/journalEntriesControllerFilters";
export {
  useAccountingCurrencySettings,
  useExchangeRateLookup,
  ACCOUNTING_CURRENCY_SETTINGS_QUERY_KEY,
} from "@mms/mod-accounting/frontend/tenant/hooks/useAccountingFx";
