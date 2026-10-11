import type { QueryClient } from "@tanstack/react-query";
import {
  FINANCE_INVOICES_QUERY_KEY,
  FINANCE_METRICS_QUERY_KEY,
  FINANCE_PAYMENTS_QUERY_KEY,
  FINANCE_REPORT_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/finance/hooks/useFinanceApi";

/** Invalidate Finance invoices/payments/metrics/report-aggregates Query keys (mutations + live push). */
export function invalidateFinanceQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: FINANCE_INVOICES_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: FINANCE_PAYMENTS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: FINANCE_METRICS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: FINANCE_REPORT_AGGREGATES_QUERY_KEY });
}
