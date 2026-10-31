import { useQuery } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import type { Account, JournalEntry } from "@/lib/data/accountingData";

export interface ObligationVoucherResult {
  entry: JournalEntry;
  accounts: Account[];
}

export function useObligationVoucher(collectionId: string | null | undefined) {
  return useQuery<ObligationVoucherResult | null>({
    queryKey: ["obligation-voucher", collectionId],
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
