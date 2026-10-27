import { createModuleQueryInvalidator } from "@/lib/query/createModuleQueryInvalidator";
import {
  FINANCE_INVOICES_QUERY_KEY,
  FINANCE_METRICS_QUERY_KEY,
  FINANCE_PAYMENTS_QUERY_KEY,
  FINANCE_PREFERENCES_QUERY_KEY,
  FINANCE_REPORT_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/finance/hooks/financeQueryKeys";

/** Invalidate Finance invoices/payments/metrics/report-aggregates/setup Query keys. */
export const invalidateFinanceQueries = createModuleQueryInvalidator({
  list: FINANCE_INVOICES_QUERY_KEY,
  lists: [FINANCE_PAYMENTS_QUERY_KEY, FINANCE_REPORT_AGGREGATES_QUERY_KEY],
  metrics: FINANCE_METRICS_QUERY_KEY,
  preferences: FINANCE_PREFERENCES_QUERY_KEY,
});
