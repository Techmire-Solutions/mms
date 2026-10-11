import type { UseQueryResult } from "@tanstack/react-query";
import type {
  FinanceReportComparisonQuery,
  FinanceListQuery,
  FinanceInvoicesListPageResult,
  FinancePaymentsListPageResult,
} from "@mms/shared";
import { FINANCE_MODULE_MANIFEST, normalizeFinanceReportComparisonQuery } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  useFinanceContractInvoices,
  useFinanceContractPayments,
  useFinanceContractReportAggregates,
} from "@/tenant/features/finance/hooks/useFinanceTsrHooks";

export const FINANCE_INVOICES_QUERY_KEY = ["finance", "invoices", "list"] as const;
export const FINANCE_PAYMENTS_QUERY_KEY = ["finance", "payments", "list"] as const;
export const FINANCE_METRICS_QUERY_KEY = ["finance", "metrics"] as const;
export const FINANCE_REPORT_AGGREGATES_QUERY_KEY = [
  FINANCE_MODULE_MANIFEST.collectionKey,
  "report-aggregates",
] as const;

/** Contract list hooks return the TanStack Query envelope; `data` is narrowed to the parsed page shape. */
export type FinancePaginatedQueryResult<TPage> = Omit<
  UseQueryResult<{ status: number; body: unknown; headers: Headers }>,
  "data"
> & { data: TPage | undefined };

export function useFinanceInvoicesPaginated(
  query: FinanceListQuery,
  options?: { enabled?: boolean },
): FinancePaginatedQueryResult<FinanceInvoicesListPageResult> {
  const { isAuthenticated } = useAuth();
  const enabled = (options?.enabled ?? true) && isAuthenticated;

  const queryParams: Record<string, unknown> = {};
  if (query.page) queryParams.page = query.page;
  if (query.limit) queryParams.limit = query.limit;
  if (query.search) queryParams.search = query.search;
  if (query.sortField) queryParams.sortField = query.sortField;
  if (query.sortDir) queryParams.sortDir = query.sortDir;
  if (query.includeDeleted) queryParams.includeDeleted = "true";

  const result = useFinanceContractInvoices(queryParams, enabled);
  return {
    ...result,
    data:
      result.data?.status === 200 ? (result.data.body as FinanceInvoicesListPageResult) : undefined,
  };
}

export function useFinancePaymentsPaginated(
  query: FinanceListQuery,
  options?: { enabled?: boolean },
): FinancePaginatedQueryResult<FinancePaymentsListPageResult> {
  const { isAuthenticated } = useAuth();
  const enabled = (options?.enabled ?? true) && isAuthenticated;

  const queryParams: Record<string, unknown> = {};
  if (query.page) queryParams.page = query.page;
  if (query.limit) queryParams.limit = query.limit;
  if (query.search) queryParams.search = query.search;
  if (query.sortField) queryParams.sortField = query.sortField;
  if (query.sortDir) queryParams.sortDir = query.sortDir;
  if (query.includeDeleted) queryParams.includeDeleted = "true";

  const result = useFinanceContractPayments(queryParams, enabled);
  return {
    ...result,
    data:
      result.data?.status === 200 ? (result.data.body as FinancePaymentsListPageResult) : undefined,
  };
}

export function useFinanceReportAggregates(options?: {
  enabled?: boolean;
  comparison?: FinanceReportComparisonQuery;
}) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  const comparison = normalizeFinanceReportComparisonQuery(options?.comparison);

  const queryParams: Record<string, unknown> = {};
  if (comparison?.sessionIds?.length) queryParams.sessionIds = comparison.sessionIds.join(",");
  if (comparison?.rangeAFrom) queryParams.rangeAFrom = comparison.rangeAFrom;
  if (comparison?.rangeATo) queryParams.rangeATo = comparison.rangeATo;
  if (comparison?.rangeBFrom) queryParams.rangeBFrom = comparison.rangeBFrom;
  if (comparison?.rangeBTo) queryParams.rangeBTo = comparison.rangeBTo;

  return useFinanceContractReportAggregates(queryParams, isAuthenticated && enabled);
}

export { useFinanceMutations } from "./useFinanceMutations";
