import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiClient";
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
      return apiJson<PlatformTelemetryData>("/api/platform/admin/system/telemetry", {
        signal,
      });
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
      const res = await apiJson<PlatformActivityTrendResponse>(
        "/api/platform/admin/system/activity-trend",
        {
          signal,
        },
      );
      return res.trend;
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
