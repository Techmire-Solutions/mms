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
} from "@/tenant/features/finance/hooks/useFinanceApi";
export {
  financeCommandMetricsQueryOptions,
  useFinanceMetrics,
} from "@/tenant/features/finance/hooks/useFinanceMetrics";
export { invalidateFinanceQueries } from "@/tenant/features/finance/hooks/invalidateFinanceQueries";
export {
  useComposedFinanceSettings,
  useFinancePreferencesMutation,
  useFinancePreferencesQuery,
  FINANCE_PREFERENCES_QUERY_KEY,
} from "@/tenant/features/finance/hooks/useFinanceSetupConfig";
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
} from "@/tenant/features/finance/hooks/useFinanceQueries";
export { applyFinanceWorkDrillDown } from "@/tenant/features/finance/hooks/financeWorkDrillDown";
