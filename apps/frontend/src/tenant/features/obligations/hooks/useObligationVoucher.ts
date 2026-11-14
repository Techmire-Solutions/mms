import { useQuery } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import type { Account, JournalEntry } from "@/lib/data/accountingData";
import { OBLIGATIONS_VOUCHER_QUERY_KEY } from "@/tenant/features/obligations/hooks/obligationsQueryKeys";

export interface ObligationVoucherResult {
  entry: JournalEntry;
  accounts: Account[];
}

export function useObligationVoucher(collectionId: string | null | undefined) {
  return useQuery<ObligationVoucherResult | null>({
    queryKey: [...OBLIGATIONS_VOUCHER_QUERY_KEY, collectionId],
    queryFn: async () => {
      if (!collectionId) return null;
      const res = await apiContract.obligations.getCollectionVoucher({
        params: { id: collectionId },
      });
      if (res.status === 200) {
        return res.body as unknown as ObligationVoucherResult;
      }
      if (res.status === 404) return null;
      throw new Error("Failed to load accounting voucher");
    },
    enabled: Boolean(collectionId),
    staleTime: 30_000,
  });
}
