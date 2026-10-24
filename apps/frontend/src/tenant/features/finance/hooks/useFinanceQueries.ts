/**
 * Finance module contract-driven server-state surface (Phase 7): list query
 * options, contract query hooks, and contract mutation hooks. Module-owned
 * per-feature hooks layer on top of this file.
 */
import { apiContract, tsrClient } from "@/lib/api";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import {
  FINANCE_FIELD_CONFIG_QUERY_KEY,
  FINANCE_INVOICES_QUERY_KEY,
  FINANCE_METRICS_QUERY_KEY,
  FINANCE_PAYMENTS_QUERY_KEY,
  FINANCE_PREFERENCES_QUERY_KEY,
  FINANCE_REPORT_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/finance/hooks/financeQueryKeys";
import { invalidateFinanceQueries } from "@/tenant/features/finance/hooks/invalidateFinanceQueries";

export function financeInvoicesListQueryOptions(query: Record<string, unknown> = {}) {
  return queryOptions({
    queryKey: [...FINANCE_INVOICES_QUERY_KEY, query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.finance.listInvoices({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        throw new Error("Failed to fetch finance invoices");
      }
      return response.body;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function financePaymentsListQueryOptions(query: Record<string, unknown> = {}) {
  return queryOptions({
    queryKey: [...FINANCE_PAYMENTS_QUERY_KEY, query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.finance.listPayments({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        throw new Error("Failed to fetch finance payments");
      }
      return response.body;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function useFinanceContractInvoices(query: Record<string, unknown>, enabled = true) {
  return tsrClient.finance.listInvoices.useQuery({
    queryKey: [...FINANCE_INVOICES_QUERY_KEY, query],
    queryData: { query },
    staleTime: 15_000,
    enabled,
  });
}

export function useFinanceContractPayments(query: Record<string, unknown>, enabled = true) {
  return tsrClient.finance.listPayments.useQuery({
    queryKey: [...FINANCE_PAYMENTS_QUERY_KEY, query],
    queryData: { query },
    staleTime: 15_000,
    enabled,
  });
}

export function useFinanceContractMetrics(enabled = true) {
  return tsrClient.finance.getMetrics.useQuery({
    queryKey: [...FINANCE_METRICS_QUERY_KEY],
    queryData: {},
    staleTime: 30_000,
    enabled,
  });
}

export function useFinanceContractReportAggregates(query: Record<string, unknown>, enabled = true) {
  return tsrClient.finance.getReportAggregates.useQuery({
    queryKey: [...FINANCE_REPORT_AGGREGATES_QUERY_KEY, query],
    queryData: { query },
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useFinanceContractFieldConfig(enabled = true) {
  return tsrClient.finance.getFieldConfig.useQuery({
    queryKey: FINANCE_FIELD_CONFIG_QUERY_KEY,
    queryData: {},
    staleTime: 30_000,
    enabled,
  });
}

export function useFinanceContractPreferences(enabled = true) {
  return tsrClient.finance.getPreferences.useQuery({
    queryKey: FINANCE_PREFERENCES_QUERY_KEY,
    queryData: {},
    staleTime: 30_000,
    enabled,
  });
}

export function useFinanceContractUpdateFieldConfig() {
  const queryClient = useQueryClient();
  return tsrClient.finance.updateFieldConfig.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FINANCE_FIELD_CONFIG_QUERY_KEY });
      invalidateFinanceQueries(queryClient);
    },
  });
}

export function useFinanceContractUpdatePreferences() {
  const queryClient = useQueryClient();
  return tsrClient.finance.updatePreferences.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FINANCE_PREFERENCES_QUERY_KEY });
      invalidateFinanceQueries(queryClient);
    },
  });
}

export function useFinanceContractCreateInvoice() {
  const queryClient = useQueryClient();
  return tsrClient.finance.createInvoice.useMutation({
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useFinanceContractUpdateInvoice() {
  const queryClient = useQueryClient();
  return tsrClient.finance.updateInvoice.useMutation({
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useFinanceContractDeleteInvoice() {
  const queryClient = useQueryClient();
  return tsrClient.finance.deleteInvoice.useMutation({
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useFinanceContractCreatePayment() {
  const queryClient = useQueryClient();
  return tsrClient.finance.createPayment.useMutation({
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useFinanceContractUpdatePayment() {
  const queryClient = useQueryClient();
  return tsrClient.finance.updatePayment.useMutation({
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useFinanceContractDeletePayment() {
  const queryClient = useQueryClient();
  return tsrClient.finance.deletePayment.useMutation({
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useFinanceContractBulkDeleteInvoices() {
  const queryClient = useQueryClient();
  return tsrClient.finance.bulkDeleteInvoices.useMutation({
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useFinanceContractBulkDeletePayments() {
  const queryClient = useQueryClient();
  return tsrClient.finance.bulkDeletePayments.useMutation({
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useFinanceContractBulkStatusInvoices() {
  const queryClient = useQueryClient();
  return tsrClient.finance.bulkStatusInvoices.useMutation({
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useFinanceContractRestoreInvoice() {
  const queryClient = useQueryClient();
  return tsrClient.finance.restoreInvoice.useMutation({
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useFinanceContractRestorePayment() {
  const queryClient = useQueryClient();
  return tsrClient.finance.restorePayment.useMutation({
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useFinanceContractBulkRestoreInvoices() {
  const queryClient = useQueryClient();
  return tsrClient.finance.bulkRestoreInvoices.useMutation({
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useFinanceContractBulkRestorePayments() {
  const queryClient = useQueryClient();
  return tsrClient.finance.bulkRestorePayments.useMutation({
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}
