import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { VoucherNumbering, VoucherNumberingUpdate } from "@mms/shared";
import { apiJson } from "@/lib/apiClient";

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
      const search = validDate ? `?${new URLSearchParams({ date: validDate })}` : "";
      const body = await apiJson<{ numbering: VoucherNumbering }>(
        `/api/accounting/voucher-numbering${search}`,
        { signal },
      );
      return body.numbering;
    },
    enabled,
  });
}

export function useSaveVoucherNumbering() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (update: VoucherNumberingUpdate) => {
      const body = await apiJson<{ numbering: VoucherNumbering }>(
        "/api/accounting/voucher-numbering",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(update),
        },
      );
      return body.numbering;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: VOUCHER_NUMBERING_QUERY_KEY });
    },
  });
}
