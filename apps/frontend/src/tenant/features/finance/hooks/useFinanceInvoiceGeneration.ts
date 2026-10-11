import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { GenerateInvoicesBody, GenerateInvoicesResult } from "@mms/shared";
import { apiJson } from "@/lib/apiClient";
import {
  FINANCE_INVOICES_QUERY_KEY,
  FINANCE_METRICS_QUERY_KEY,
} from "@/tenant/features/finance/hooks/useFinanceApi";

export function useFinanceInvoiceGeneration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateInvoicesBody) =>
      apiJson<GenerateInvoicesResult>("/api/finance/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FINANCE_INVOICES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: FINANCE_METRICS_QUERY_KEY });
    },
  });
}
