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
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { invalidateFinanceQueries } from "@/tenant/features/finance/hooks/invalidateFinanceQueries";

const CREDIT_NOTES_KEY = ["finance", "credit-notes"] as const;

/** Throws on any non-2xx (preserves the old `apiJson` throw-on-!ok). */
function assertOk(response: { status: number; body: unknown }, context: string): void {
  if (response.status >= 200 && response.status < 300) return;
  const errorBody = response.body as { message?: string; type?: string } | undefined;
  throw new ApiError(response.status, errorBody?.message ?? context, errorBody?.type);
}

function invalidateFinance(queryClient: ReturnType<typeof useQueryClient>): void {
  invalidateFinanceQueries(queryClient);
}

export function useFinanceCollectMutations() {
  const queryClient = useQueryClient();
  const collect = useMutation({
    mutationFn: async (body: CollectInvoicesBody = {}) => {
      const response = await apiContract.financeOps.collectInvoices({ body });
      assertOk(response, "Failed to collect invoices");
      return response.body as CollectInvoicesResult;
    },
    onSuccess: () => invalidateFinance(queryClient),
  });
  const remind = useMutation({
    mutationFn: async (body: RemindInvoicesBody = {}) => {
      const response = await apiContract.financeOps.remindInvoices({ body });
      assertOk(response, "Failed to remind invoices");
      return response.body as RemindInvoicesResult;
    },
    onSuccess: () => invalidateFinance(queryClient),
  });
  const cancel = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await apiContract.financeOps.cancelInvoice({ params: { id: invoiceId } });
      assertOk(response, "Failed to cancel invoice");
      return response.body as { invoice: Invoice };
    },
    onSuccess: () => invalidateFinance(queryClient),
  });
  const credit = useMutation({
    mutationFn: async (body: CreditNoteInsert) => {
      const response = await apiContract.financeOps.createCreditNote({ body });
      assertOk(response, "Failed to create credit note");
      return response.body as { note: CreditNote };
    },
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
      const response = await apiContract.financeOps.listCreditNotes({
        query: { invoiceId: invoiceId ?? "" },
        signal,
        fetchOptions: { signal },
      });
      assertOk(response, "Failed to load credit notes");
      return (response.body as { notes: CreditNote[] }).notes;
    },
    enabled: Boolean(invoiceId),
  });
}
