import { createModuleQueryInvalidator } from "@/lib/query/createModuleQueryInvalidator";
import {
  ACCOUNTING_ACCOUNTS_QUERY_KEY,
  ACCOUNTING_ENTRIES_QUERY_KEY,
  ACCOUNTING_FISCAL_YEARS_QUERY_KEY,
  ACCOUNTING_METRICS_QUERY_KEY,
  ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/accounting/hooks/accountingQueryKeys";
import { ACCOUNTING_PREFERENCES_QUERY_KEY } from "@/tenant/features/accounting/hooks/useAccountingSetupConfig";
import { VOUCHER_NUMBERING_QUERY_KEY } from "@/tenant/features/accounting/hooks/useVoucherNumbering";

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
export const invalidateAccountingQueries = createModuleQueryInvalidator({
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
