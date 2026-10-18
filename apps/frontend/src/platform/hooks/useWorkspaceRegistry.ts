import { useQuery } from "@tanstack/react-query";
import type { PublicWorkspaceSummary } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { useTenant } from "@/lib/contexts/TenantContext";
import { WORKSPACE_REGISTRY_QUERY_KEY } from "@/platform/lib/platformQueryKeys";

export { WORKSPACE_REGISTRY_QUERY_KEY } from "@/platform/lib/platformQueryKeys";

/** Apex-only list of registered madrasa workspaces (TanStack Query). */
export function useWorkspaceRegistry(options?: { enabled?: boolean }): {
  data: PublicWorkspaceSummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
} {
  const { isApex } = useTenant();

  const query = useQuery({
    queryKey: WORKSPACE_REGISTRY_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.workspace.registry({ signal, fetchOptions: { signal } });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to load workspace registry",
          errorBody?.type,
        );
      }
      return (response.body as { workspaces: PublicWorkspaceSummary[] }).workspaces;
    },
    enabled: options?.enabled ?? isApex,
    staleTime: 60_000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
