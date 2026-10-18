import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { JournalEntry, JournalReversalRequest } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { invalidateAccountingQueries } from "@/tenant/features/accounting/hooks/invalidateAccountingQueries";

export interface JournalReversalResponse {
  entry: JournalEntry;
  original: { id: string; ref: string; date: string };
  priorPeriod: boolean;
  executedAt: string;
}

/**
 * Posts a server-built reversing journal. The server owns the lines, the link
 * to the original, the period checks and the duplicate guard; the client only
 * supplies the posting date, reason and remarks.
 */
export function useReverseJournalEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, request }: { id: string; request: JournalReversalRequest }) => {
      const response = await apiContract.accountingLedger.reverseJournalEntry({
        params: { id },
        body: request,
      });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to reverse journal entry",
          errorBody?.type,
        );
      }
      return response.body as JournalReversalResponse;
    },
    onSuccess: () => invalidateAccountingQueries(queryClient),
  });
}
