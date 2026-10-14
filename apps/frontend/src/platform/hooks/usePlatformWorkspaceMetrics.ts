import { useQuery } from "@tanstack/react-query";
import type { PlatformWorkspaceMetrics } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { PLATFORM_WORKSPACE_METRICS_QUERY_KEY } from "@/platform/lib/platformQueryKeys";

export { PLATFORM_WORKSPACE_METRICS_QUERY_KEY } from "@/platform/lib/platformQueryKeys";

/** Fleet KPI counts — independent of directory pagination filters. */
export function usePlatformWorkspaceMetrics() {
  const { isPlatformAuthenticated, canWorkspaces } = usePlatformPermissions();

  const query = useQuery({
    queryKey: PLATFORM_WORKSPACE_METRICS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.platform.getWorkspaceMetrics({
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to load workspace metrics",
          errorBody?.type,
        );
      }
      return response.body as PlatformWorkspaceMetrics;
    },
    enabled: isPlatformAuthenticated && canWorkspaces,
    staleTime: 60_000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
