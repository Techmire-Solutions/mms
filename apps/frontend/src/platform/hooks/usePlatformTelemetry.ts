import { useQuery } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";

export interface PlatformTelemetryData {
  platformDb?: {
    engine: string;
    totalCount: number;
    idleCount: number;
    waitingCount: number;
    activeCount: number;
    utilizationRate: number;
    latencyMs: number;
    hasReplica: boolean;
  };
  tenantDb?: {
    rlsIsolation: "enforced";
    activeTenantsCount: number;
    totalTenantTransactions: number;
    tenantCapLimit: number;
    tenantBudgetPercent: number;
    activeTenants: { tenant: string; count: number }[];
  };
  dbPool: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
    activeCount: number;
    utilizationRate: number;
  };
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    externalMb: number;
  };
  latencyMs: number;
  uptimeSeconds: number;
}

export interface PlatformActivityTrendItem {
  month: string;
  yearMonth: string;
  tenants: number;
  ops: number;
}

export interface PlatformActivityTrendResponse {
  trend: PlatformActivityTrendItem[];
}

export const PLATFORM_TELEMETRY_QUERY_KEY = ["platform", "telemetry"] as const;
export const PLATFORM_ACTIVITY_TREND_QUERY_KEY = ["platform", "activity-trend"] as const;

export interface UsePlatformTelemetryOptions {
  refetchInterval?: number | false;
}

export function usePlatformTelemetry(options?: UsePlatformTelemetryOptions): {
  data: PlatformTelemetryData | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  dataUpdatedAt: number;
  refetch: () => Promise<unknown>;
} {
  const { isPlatformAuthenticated, canSystem } = usePlatformPermissions();

  const query = useQuery({
    queryKey: PLATFORM_TELEMETRY_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.platform.getTelemetry({ signal, fetchOptions: { signal } });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to load platform telemetry",
          errorBody?.type,
        );
      }
      return response.body as PlatformTelemetryData;
    },
    enabled: isPlatformAuthenticated && canSystem,
    refetchInterval: options?.refetchInterval !== undefined ? options.refetchInterval : 30_000,
    staleTime: 15_000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    dataUpdatedAt: query.dataUpdatedAt,
    refetch: query.refetch,
  };
}

export function usePlatformActivityTrend(): {
  data: PlatformActivityTrendItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
} {
  const { isPlatformAuthenticated, canSystem } = usePlatformPermissions();

  const query = useQuery({
    queryKey: PLATFORM_ACTIVITY_TREND_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.platform.getActivityTrend({
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to load platform activity trend",
          errorBody?.type,
        );
      }
      return (response.body as PlatformActivityTrendResponse).trend;
    },
    enabled: isPlatformAuthenticated && canSystem,
    staleTime: 60_000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
