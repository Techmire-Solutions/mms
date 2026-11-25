import { createModuleQueryInvalidator } from "@mms/fe-core/query/createModuleQueryInvalidator";
import { invalidateDashboardDataQueries } from "@mms/fe-core/query/dashboardDataInvalidation";
import {
  ACCOUNTING_PREFERENCES_QUERY_KEY,
  VOUCHER_NUMBERING_QUERY_KEY,
  ACCOUNTING_ACCOUNTS_QUERY_KEY,
  ACCOUNTING_ENTRIES_QUERY_KEY,
  ACCOUNTING_FISCAL_YEARS_QUERY_KEY,
  ACCOUNTING_METRICS_QUERY_KEY,
  ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY,
} from "./accountingQueryKeys";

/**
 * Invalidate every Accounting Query key a ledger write can affect (mutations +
 * live push).
 *
 * `report-aggregates` is included deliberately: it is the only cached read of
 * ledger figures outside the entries list, and it held a 5-minute `staleTime`,
 * so an omitted invalidation left the Trial Balance, Income Statement, Balance
 * Sheet and Cash Flow showing pre-posting numbers for minutes after a journal
 * entry was saved, a period was closed or a reversal was posted. Setup and
 * voucher numbering are invalidated for the same reason.
 */
const invalidateAccountingModuleQueries = createModuleQueryInvalidator({
  list: ACCOUNTING_ENTRIES_QUERY_KEY,
  lists: [
    ACCOUNTING_ACCOUNTS_QUERY_KEY,
    ACCOUNTING_FISCAL_YEARS_QUERY_KEY,
    ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY,
    VOUCHER_NUMBERING_QUERY_KEY,
  ],
  metrics: ACCOUNTING_METRICS_QUERY_KEY,
  preferences: ACCOUNTING_PREFERENCES_QUERY_KEY,
});

/** Accounting writes (posting, reversal, close, seed) also refresh dashboard data. */
export function invalidateAccountingQueries(
  queryClient: Parameters<typeof invalidateAccountingModuleQueries>[0],
): void {
  invalidateAccountingModuleQueries(queryClient);
  invalidateDashboardDataQueries(queryClient);
}
