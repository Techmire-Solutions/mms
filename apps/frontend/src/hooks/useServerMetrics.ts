import { queryOptions, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { apiJson } from "@/lib/apiClient";
import { SUMMARY_STALE_TIME } from "@/lib/queryClient";

export interface ServerMetricsOptions {
  moduleId: string;
  apiPath: string;
  extraParam?: string;
}

export function serverMetricsQueryOptions<T>({
  moduleId,
  apiPath,
  extraParam,
}: ServerMetricsOptions) {
  const queryKey = extraParam
    ? ([moduleId, "metrics", extraParam] as const)
    : ([moduleId, "metrics"] as const);

  return queryOptions({
    queryKey,
    queryFn: async ({ signal }) => {
      const queryString = extraParam ? `?date=${encodeURIComponent(extraParam)}` : "";
      const response = await apiJson<{ metrics: T }>(`${apiPath}/metrics${queryString}`, {
        signal,
      });
      return response?.metrics ?? ({} as T);
    },
    staleTime: SUMMARY_STALE_TIME,
  });
}

export interface UseServerMetricsOptions extends ServerMetricsOptions {
  enabled?: boolean;
}

export function useServerMetrics<T>({
  moduleId,
  apiPath,
  extraParam,
  enabled = true,
}: UseServerMetricsOptions) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    ...serverMetricsQueryOptions<T>({ moduleId, apiPath, extraParam }),
    enabled: isAuthenticated && enabled,
  });
}
