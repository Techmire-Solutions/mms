import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiClient";
import { invalidateAccountingQueries } from "@/tenant/features/accounting/hooks/invalidateAccountingQueries";
import { ACCOUNTING_POSTING_RULES_QUERY_KEY } from "@/tenant/features/accounting/hooks/useAccountingLedgerOps";
import { ACCOUNTING_PREFERENCES_QUERY_KEY } from "@/tenant/features/accounting/hooks/useAccountingSetupConfig";

export interface SeedDefaultChartResult {
  success: boolean;
  count: number;
  /** Which still-empty settings the seed filled with seeded accounts. */
  defaultsApplied: { retainedEarnings: boolean; cashAccount: boolean };
}

/** Seeds the default Chart of Accounts; the server refuses (409) when any account already exists. */
export function useSeedDefaultChart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiJson<SeedDefaultChartResult>("/api/accounting/accounts/seed-default", { method: "POST" }),
    onSettled: () => {
      invalidateAccountingQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: ACCOUNTING_POSTING_RULES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ACCOUNTING_PREFERENCES_QUERY_KEY });
    },
  });
}
