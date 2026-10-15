import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { GenerateInvoicesBody, GenerateInvoicesResult } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { invalidateFinanceQueries } from "@/tenant/features/finance/hooks/invalidateFinanceQueries";

export function useFinanceInvoiceGeneration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: GenerateInvoicesBody) => {
      const response = await apiContract.financeOps.generateInvoices({ body });
      if (response.status < 200 || response.status >= 300) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to generate invoices",
          errorBody?.type,
        );
      }
      return response.body as GenerateInvoicesResult;
    },
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}
