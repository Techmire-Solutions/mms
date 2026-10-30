import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FeeStructure, FeeStructureInsert } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { FINANCE_FEE_STRUCTURES_QUERY_KEY } from "./financeQueryKeys";
import { assertContractOk } from "@/lib/apiContractError";

// Key is declared in `financeQueryKeys` so the module invalidator can cover it.
export { FINANCE_FEE_STRUCTURES_QUERY_KEY };

export function useFinanceFeeStructures(enabled = true) {
  return useQuery({
    queryKey: FINANCE_FEE_STRUCTURES_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.financeOps.listFeeStructures({
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to load fee structures");
      return (response.body as { structures: FeeStructure[] }).structures;
    },
    enabled,
  });
}

export function useFinanceFeeStructureMutations() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: FINANCE_FEE_STRUCTURES_QUERY_KEY });

  const save = useMutation({
    mutationFn: async (structure: FeeStructureInsert) => {
      const response = await apiContract.financeOps.putFeeStructure({ body: structure });
      assertContractOk(response, "Failed to save fee structure");
      return response.body as { structure: FeeStructure };
    },
    onSuccess: () => invalidate(),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiContract.financeOps.deleteFeeStructure({ params: { id } });
      assertContractOk(response, "Failed to delete fee structure");
      return response.body as { success: boolean };
    },
    onSuccess: () => invalidate(),
  });

  return { save, remove };
}
