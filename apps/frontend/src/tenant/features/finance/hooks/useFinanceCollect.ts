import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CollectInvoicesBody,
  CollectInvoicesResult,
  CreditNote,
  CreditNoteInsert,
  Invoice,
  RemindInvoicesBody,
  RemindInvoicesResult,
} from "@mms/shared";
import { apiJson } from "@/lib/apiClient";
import {
  FINANCE_INVOICES_QUERY_KEY,
  FINANCE_METRICS_QUERY_KEY,
} from "@/tenant/features/finance/hooks/useFinanceApi";

const CREDIT_NOTES_KEY = ["finance", "credit-notes"] as const;

function invalidateFinance(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: FINANCE_INVOICES_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: FINANCE_METRICS_QUERY_KEY });
}

export function useFinanceCollectMutations() {
  const queryClient = useQueryClient();
  const collect = useMutation({
    mutationFn: (body: CollectInvoicesBody = {}) =>
      apiJson<CollectInvoicesResult>("/api/finance/invoices/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateFinance(queryClient),
  });
  const remind = useMutation({
    mutationFn: (body: RemindInvoicesBody = {}) =>
      apiJson<RemindInvoicesResult>("/api/finance/invoices/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateFinance(queryClient),
  });
  const cancel = useMutation({
    mutationFn: (invoiceId: string) =>
      apiJson<{ invoice: Invoice }>(`/api/finance/invoices/${invoiceId}/cancel`, {
        method: "POST",
      }),
    onSuccess: () => invalidateFinance(queryClient),
  });
  const credit = useMutation({
    mutationFn: (body: CreditNoteInsert) =>
      apiJson<{ note: CreditNote }>("/api/finance/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, body) => {
      invalidateFinance(queryClient);
      void queryClient.invalidateQueries({ queryKey: [...CREDIT_NOTES_KEY, body.invoiceId] });
    },
  });
  return { collect, remind, cancel, credit };
}

export function useFinanceCreditNotes(invoiceId: string | undefined) {
  return useQuery({
    queryKey: [...CREDIT_NOTES_KEY, invoiceId],
    queryFn: async ({ signal }) => {
      const body = await apiJson<{ notes: CreditNote[] }>(
        `/api/finance/credit-notes?invoiceId=${encodeURIComponent(invoiceId ?? "")}`,
        { signal },
      );
      return body.notes;
    },
    enabled: Boolean(invoiceId),
  });
}
