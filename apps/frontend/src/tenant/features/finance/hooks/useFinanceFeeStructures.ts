import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FeeStructure, FeeStructureInsert } from "@mms/shared";
import { apiJson } from "@/lib/apiClient";

export const FINANCE_FEE_STRUCTURES_QUERY_KEY = ["finance", "fee-structures"] as const;

export function useFinanceFeeStructures(enabled = true) {
  return useQuery({
    queryKey: FINANCE_FEE_STRUCTURES_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const body = await apiJson<{ structures: FeeStructure[] }>("/api/finance/fee-structures", {
        signal,
      });
      return body.structures;
    },
    enabled,
  });
}

export function useFinanceFeeStructureMutations() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: FINANCE_FEE_STRUCTURES_QUERY_KEY });

  const save = useMutation({
    mutationFn: (structure: FeeStructureInsert) =>
      apiJson<{ structure: FeeStructure }>("/api/finance/fee-structures", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(structure),
      }),
    onSuccess: () => invalidate(),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiJson<{ success: boolean }>(`/api/finance/fee-structures/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate(),
  });

  return { save, remove };
}
