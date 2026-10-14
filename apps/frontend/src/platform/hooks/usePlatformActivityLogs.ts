import { useQuery } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";

export interface PlatformActivityLogItem {
  id: string;
  userId: string | null;
  userEmail: string;
  action: string;
  targetResource: string | null;
  targetId: string | null;
  ipAddress: string | null;
  metadataMessage: string | null;
  createdAt: string;
}

export interface PlatformActivityLogsResponse {
  logs: PlatformActivityLogItem[];
}

import { PLATFORM_ACTIVITY_LOGS_QUERY_KEY } from "@/platform/lib/platformQueryKeys";

export { PLATFORM_ACTIVITY_LOGS_QUERY_KEY } from "@/platform/lib/platformQueryKeys";

export function usePlatformActivityLogs(): {
  data: PlatformActivityLogItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
} {
  const { isPlatformAuthenticated, canSystem } = usePlatformPermissions();

  const query = useQuery({
    queryKey: PLATFORM_ACTIVITY_LOGS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.platform.getActivityLogs({
        query: {},
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to load platform activity logs",
          errorBody?.type,
        );
      }
      return (response.body as { logs: PlatformActivityLogItem[] }).logs;
    },
    enabled: isPlatformAuthenticated && canSystem,
    staleTime: 30_000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
