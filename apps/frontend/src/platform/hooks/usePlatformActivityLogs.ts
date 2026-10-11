import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiClient";
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
      const res = await apiJson<{ logs: PlatformActivityLogItem[] }>(
        "/api/platform/admin/system/activity-logs",
        {
          signal,
        },
      );
      return res.logs;
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
