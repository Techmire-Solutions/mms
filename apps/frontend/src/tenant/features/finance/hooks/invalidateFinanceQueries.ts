import { createModuleQueryInvalidator } from "@/lib/query/createModuleQueryInvalidator";
import {
  FINANCE_FEE_STRUCTURES_QUERY_KEY,
  FINANCE_INVOICES_QUERY_KEY,
  FINANCE_METRICS_QUERY_KEY,
  FINANCE_PAYMENTS_QUERY_KEY,
  FINANCE_PREFERENCES_QUERY_KEY,
  FINANCE_REPORT_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/finance/hooks/financeQueryKeys";

/**
 * Invalidate Finance invoices/payments/fee-structures/metrics/report-aggregates/setup keys.
 * Fee structures are a setup read that the backend broadcasts independently
 * (`finance_fee_structures`), so they must be part of the module's invalidation set.
 */
export const invalidateFinanceQueries = createModuleQueryInvalidator({
  list: FINANCE_INVOICES_QUERY_KEY,
  lists: [
    FINANCE_PAYMENTS_QUERY_KEY,
    FINANCE_REPORT_AGGREGATES_QUERY_KEY,
    FINANCE_FEE_STRUCTURES_QUERY_KEY,
  ],
  metrics: FINANCE_METRICS_QUERY_KEY,
  preferences: FINANCE_PREFERENCES_QUERY_KEY,
});
