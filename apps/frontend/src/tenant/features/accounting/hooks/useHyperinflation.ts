import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HyperinflationSettings, Ias29Run, PriceIndexPoint } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { invalidateAccountingQueries } from "@/tenant/features/accounting/hooks/invalidateAccountingQueries";

const SETTINGS_KEY = ["accounting", "ias29", "settings"] as const;
const INDICES_KEY = ["accounting", "ias29", "priceIndices"] as const;
const RUNS_KEY = ["accounting", "ias29", "runs"] as const;

function assertOk(response: { status: number; body: unknown }, context: string): void {
  if (response.status >= 200 && response.status < 300) return;
  const errorBody = response.body as { message?: string; type?: string } | undefined;
  throw new ApiError(response.status, errorBody?.message ?? context, errorBody?.type);
}

export function useHyperinflationSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.accountingFx.getHyperinflationSettings({
        signal,
        fetchOptions: { signal },
      });
      assertOk(response, "Failed to load hyperinflation settings");
      return (response.body as { settings: HyperinflationSettings }).settings;
    },
  });
}

export function useSaveHyperinflationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: HyperinflationSettings) => {
      const response = await apiContract.accountingFx.putHyperinflationSettings({ body: settings });
      assertOk(response, "Failed to save hyperinflation settings");
      return (response.body as { settings: HyperinflationSettings }).settings;
    },
    onSuccess: (settings) => queryClient.setQueryData(SETTINGS_KEY, settings),
  });
}

export function usePriceIndices() {
  return useQuery({
    queryKey: INDICES_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.accountingFx.listPriceIndices({ signal, fetchOptions: { signal } });
      assertOk(response, "Failed to load price indices");
      return (response.body as { points: PriceIndexPoint[] }).points;
    },
  });
}

export function useSavePriceIndices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (points: PriceIndexPoint[]) => {
      const response = await apiContract.accountingFx.putPriceIndices({ body: { points } });
      assertOk(response, "Failed to save price indices");
      return (response.body as { points: PriceIndexPoint[] }).points;
    },
    onSuccess: (points) => queryClient.setQueryData(INDICES_KEY, points),
  });
}

export function useIas29Runs() {
  return useQuery({
    queryKey: RUNS_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.accountingFx.listIas29Restatements({
        signal,
        fetchOptions: { signal },
      });
      assertOk(response, "Failed to load IAS 29 restatements");
      return (response.body as { runs: Ias29Run[] }).runs;
    },
  });
}

/** Preview is a read: it computes restated figures and posts nothing. */
export function usePreviewIas29() {
  return useMutation({
    mutationFn: async (restatementDate: string) => {
      const response = await apiContract.accountingFx.previewIas29Restatement({ body: { restatementDate } });
      assertOk(response, "Failed to preview IAS 29 restatement");
      return (response.body as { run: Ias29Run }).run;
    },
  });
}

/** Money mutation: posts the restatement and its reversal, then refreshes ledgers and reports. */
export function usePostIas29() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (restatementDate: string) => {
      const response = await apiContract.accountingFx.postIas29Restatement({ body: { restatementDate } });
      assertOk(response, "Failed to post IAS 29 restatement");
      return (response.body as { run: Ias29Run }).run;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RUNS_KEY });
      invalidateAccountingQueries(queryClient);
    },
  });
}
