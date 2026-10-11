import { useQuery } from "@tanstack/react-query";
import type { PlatformWorkspaceMetrics } from "@mms/shared";
import { apiJson } from "@/lib/apiClient";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { PLATFORM_WORKSPACE_METRICS_QUERY_KEY } from "@/platform/lib/platformQueryKeys";

export { PLATFORM_WORKSPACE_METRICS_QUERY_KEY } from "@/platform/lib/platformQueryKeys";

/** Fleet KPI counts — independent of directory pagination filters. */
export function usePlatformWorkspaceMetrics() {
  const { isPlatformAuthenticated, canWorkspaces } = usePlatformPermissions();

  const query = useQuery({
    queryKey: PLATFORM_WORKSPACE_METRICS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      return apiJson<PlatformWorkspaceMetrics>("/api/platform/workspaces/metrics", { signal });
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
