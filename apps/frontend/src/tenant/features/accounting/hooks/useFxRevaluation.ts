import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FxReport, FxRevaluationRun } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { invalidateAccountingQueries } from "@/tenant/features/accounting/hooks/invalidateAccountingQueries";
import { assertContractOk } from "@/lib/apiContractError";

const RUNS_KEY = ["accounting", "fx", "revaluations"] as const;

export function useFxRevaluationRuns(enabled = true) {
  return useQuery({
    queryKey: RUNS_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.accountingFx.listFxRevaluations({
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to load FX revaluations");
      return (response.body as { runs: FxRevaluationRun[] }).runs;
    },
    enabled,
  });
}

/** Preview is a read: it computes figures at the closing rate and posts nothing. */
export function usePreviewFxRevaluation() {
  return useMutation({
    mutationFn: async (revaluationDate: string) => {
      const response = await apiContract.accountingFx.previewFxRevaluation({
        body: { revaluationDate },
      });
      assertContractOk(response, "Failed to preview FX revaluation");
      return (response.body as { run: FxRevaluationRun }).run;
    },
  });
}

/** Money mutation: posts the revaluation and its reversal, then refreshes ledgers and reports. */
export function usePostFxRevaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (revaluationDate: string) => {
      const response = await apiContract.accountingFx.postFxRevaluation({
        body: { revaluationDate },
      });
      assertContractOk(response, "Failed to post FX revaluation");
      return (response.body as { run: FxRevaluationRun }).run;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RUNS_KEY });
      invalidateAccountingQueries(queryClient);
    },
  });
}

/** IAS 21 FX report for a period: exposure at `asOf` closing rates, realized FX, posted revaluations. */
export function useFxReport(from: string, asOf: string, enabled = true) {
  return useQuery({
    queryKey: ["accounting", "fx", "report", from, asOf] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.accountingFx.getFxReport({
        query: { from, asOf },
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to load the FX report");
      return (response.body as { report: FxReport }).report;
    },
    enabled: enabled && Boolean(from && asOf) && from <= asOf,
  });
}
