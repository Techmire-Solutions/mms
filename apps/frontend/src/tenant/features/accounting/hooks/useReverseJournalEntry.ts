import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { JournalEntry, JournalReversalRequest } from "@mms/shared";
import { apiJson } from "@/lib/apiClient";
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
    mutationFn: ({ id, request }: { id: string; request: JournalReversalRequest }) =>
      apiJson<JournalReversalResponse>(
        `/api/accounting/entries/${encodeURIComponent(id)}/reverse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        },
      ),
    onSuccess: () => invalidateAccountingQueries(queryClient),
  });
}
