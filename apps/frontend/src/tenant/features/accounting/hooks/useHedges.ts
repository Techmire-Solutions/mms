import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HedgeRelationship, HedgeRelationshipCreate } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { invalidateAccountingQueries } from "@/tenant/features/accounting/hooks/invalidateAccountingQueries";
import { assertContractOk } from "@/lib/apiContractError";

const HEDGES_KEY = ["accounting", "hedges"] as const;

const hedgeOf = (response: { body: unknown }) =>
  (response.body as { hedge: HedgeRelationship }).hedge;

export function useHedges() {
  return useQuery({
    queryKey: HEDGES_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.accountingHedges.listHedges({
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to load hedges");
      return (response.body as { hedges: HedgeRelationship[] }).hedges;
    },
  });
}

/** Every hedge write posts to the ledger, so all of them refresh hedges, ledgers and reports. */
function useHedgeMutation<TInput>(run: (input: TInput) => Promise<HedgeRelationship>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: HEDGES_KEY });
      invalidateAccountingQueries(queryClient);
    },
  });
}

export function useCreateHedge() {
  return useHedgeMutation(async (body: HedgeRelationshipCreate) => {
    const response = await apiContract.accountingHedges.createHedge({ body });
    assertContractOk(response, "Failed to designate the hedge");
    return hedgeOf(response);
  });
}

export function usePostHedgeValuation() {
  return useHedgeMutation(async ({ id, valuationDate }: { id: string; valuationDate: string }) => {
    const response = await apiContract.accountingHedges.postHedgeValuation({
      params: { id },
      body: { valuationDate },
    });
    assertContractOk(response, "Failed to post the hedge valuation");
    return hedgeOf(response);
  });
}

export function useSettleHedge() {
  return useHedgeMutation(
    async ({
      id,
      ...body
    }: {
      id: string;
      settlementDate: string;
      settlementRate: string;
      cashAccountId: string;
    }) => {
      const response = await apiContract.accountingHedges.settleHedge({ params: { id }, body });
      assertContractOk(response, "Failed to settle the hedge");
      return hedgeOf(response);
    },
  );
}

export function useReclassifyHedge() {
  return useHedgeMutation(
    async ({ id, ...body }: { id: string; date: string; targetAccountId: string }) => {
      const response = await apiContract.accountingHedges.reclassifyHedge({ params: { id }, body });
      assertContractOk(response, "Failed to reclassify the hedge reserve");
      return hedgeOf(response);
    },
  );
}
