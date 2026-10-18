import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { VoucherNumbering, VoucherNumberingUpdate } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";

export const VOUCHER_NUMBERING_QUERY_KEY = ["accounting", "voucher-numbering"] as const;

/**
 * Numbering format plus the next voucher number for `date`'s period. The
 * number is a preview — the server assigns it inside the save transaction.
 */
export function useVoucherNumbering(date?: string, enabled = true) {
  const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  return useQuery({
    queryKey: [...VOUCHER_NUMBERING_QUERY_KEY, validDate ?? "today"],
    queryFn: async ({ signal }) => {
      const response = await apiContract.accountingLedger.getVoucherNumbering({
        query: validDate ? { date: validDate } : {},
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to load voucher numbering",
          errorBody?.type,
        );
      }
      return (response.body as { numbering: VoucherNumbering }).numbering;
    },
    enabled,
  });
}

export function useSaveVoucherNumbering() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (update: VoucherNumberingUpdate) => {
      const response = await apiContract.accountingLedger.putVoucherNumbering({ body: update });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to save voucher numbering",
          errorBody?.type,
        );
      }
      return (response.body as { numbering: VoucherNumbering }).numbering;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: VOUCHER_NUMBERING_QUERY_KEY });
    },
  });
}
