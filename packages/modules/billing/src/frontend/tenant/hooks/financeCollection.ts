/**
 * Cross-module public surface for Finance Query hooks.
 * Other features and shared UI must import from here — not `@/tenant/features/finance/hooks/*`.
 */
export {
  FINANCE_INVOICES_QUERY_KEY,
  FINANCE_PAYMENTS_QUERY_KEY,
  FINANCE_METRICS_QUERY_KEY,
  FINANCE_REPORT_AGGREGATES_QUERY_KEY,
  useFinanceInvoicesPaginated,
  useFinancePaymentsPaginated,
  useFinanceReportAggregates,
  useFinanceMutations,
} from "./useFinanceApi";
export { financeCommandMetricsQueryOptions, useFinanceMetrics } from "./useFinanceMetrics";
export { invalidateFinanceQueries } from "./invalidateFinanceQueries";
export {
  useComposedFinanceSettings,
  useFinancePreferencesMutation,
  useFinancePreferencesQuery,
  FINANCE_PREFERENCES_QUERY_KEY,
} from "./useFinanceSetupConfig";
// Contract-driven tsrClient hooks & query factories
export {
  financeInvoicesListQueryOptions,
  financePaymentsListQueryOptions,
  useFinanceContractInvoices,
  useFinanceContractPayments,
  useFinanceContractMetrics,
  useFinanceContractCreateInvoice,
  useFinanceContractUpdateInvoice,
  useFinanceContractDeleteInvoice,
  useFinanceContractCreatePayment,
  useFinanceContractUpdatePayment,
  useFinanceContractBulkDeleteInvoices,
  useFinanceContractBulkStatusInvoices,
} from "./useFinanceQueries";
export { applyFinanceWorkDrillDown } from "./financeWorkDrillDown";
