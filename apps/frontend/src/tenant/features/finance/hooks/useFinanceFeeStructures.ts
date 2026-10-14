import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FeeStructure, FeeStructureInsert } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";

export const FINANCE_FEE_STRUCTURES_QUERY_KEY = ["finance", "fee-structures"] as const;

/** Throws on any non-2xx (preserves the old `apiJson` throw-on-!ok). */
function assertOk(response: { status: number; body: unknown }, context: string): void {
  if (response.status >= 200 && response.status < 300) return;
  const errorBody = response.body as { message?: string; type?: string } | undefined;
  throw new ApiError(response.status, errorBody?.message ?? context, errorBody?.type);
}

export function useFinanceFeeStructures(enabled = true) {
  return useQuery({
    queryKey: FINANCE_FEE_STRUCTURES_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.financeOps.listFeeStructures({
        signal,
        fetchOptions: { signal },
      });
      assertOk(response, "Failed to load fee structures");
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
      assertOk(response, "Failed to save fee structure");
      return response.body as { structure: FeeStructure };
    },
    onSuccess: () => invalidate(),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiContract.financeOps.deleteFeeStructure({ params: { id } });
      assertOk(response, "Failed to delete fee structure");
      return response.body as { success: boolean };
    },
    onSuccess: () => invalidate(),
  });

  return { save, remove };
}
