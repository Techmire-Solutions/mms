import type {
  Denomination,
  StockBatch,
  Distribution,
  Redemption,
  HasanatCommandMetricsSnapshot,
  HasanatReportComparisonQuery,
} from "@mms/shared";
import { HASANAT_MODULE_MANIFEST, normalizeHasanatReportComparisonQuery } from "@mms/shared";
import { serverMetricsQueryOptions, useServerMetrics } from "@/hooks/useServerMetrics";
import { useAuth } from "@/lib/contexts/AuthContext";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import { tsrClient } from "@/lib/api";

export const HASANAT_DENOMS_QUERY_KEY = ["hasanat", "denoms", "list"] as const;
export const HASANAT_BATCHES_QUERY_KEY = ["hasanat", "batches", "list"] as const;
export const HASANAT_DISTRIBUTIONS_QUERY_KEY = ["hasanat", "distributions", "list"] as const;
export const HASANAT_REDEMPTIONS_QUERY_KEY = ["hasanat", "redemptions", "list"] as const;
export const HASANAT_METRICS_QUERY_KEY = ["hasanat", "metrics"] as const;
export const HASANAT_REPORT_AGGREGATES_QUERY_KEY = [
  HASANAT_MODULE_MANIFEST.collectionKey,
  "report-aggregates",
] as const;
export const HASANAT_API = HASANAT_MODULE_MANIFEST.restBasePath;

export function hasanatCommandMetricsQueryOptions() {
  return serverMetricsQueryOptions<HasanatCommandMetricsSnapshot>({
    moduleId: HASANAT_MODULE_MANIFEST.moduleId,
    apiPath: HASANAT_MODULE_MANIFEST.restBasePath,
  });
}

export function useHasanatDenoms(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const canRead = can("hasanat.read");
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.hasanat.listDenoms.useQuery({
    queryKey: HASANAT_DENOMS_QUERY_KEY,
    enabled: isAuthenticated && canRead && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}

export function useHasanatDenomsCollection(options?: { enabled?: boolean }): Denomination[] {
  const query = useHasanatDenoms(options);
  if (!query.data || query.data.status !== 200) return [];
  const body = query.data.body;
  if (Array.isArray(body)) return body as Denomination[];
  if (body && typeof body === "object" && "denoms" in body && Array.isArray(body.denoms)) {
    return body.denoms as Denomination[];
  }
  return [];
}

export function useHasanatBatches(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const canRead = can("hasanat.read");
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.hasanat.listBatches.useQuery({
    queryKey: HASANAT_BATCHES_QUERY_KEY,
    enabled: isAuthenticated && canRead && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}

export function useHasanatBatchesCollection(options?: { enabled?: boolean }): StockBatch[] {
  const query = useHasanatBatches(options);
  if (!query.data || query.data.status !== 200) return [];
  const body = query.data.body;
  if (Array.isArray(body)) return body as StockBatch[];
  if (body && typeof body === "object" && "batches" in body && Array.isArray(body.batches)) {
    return body.batches as StockBatch[];
  }
  return [];
}

export function useHasanatDistributions(options?: { enabled?: boolean; includeDeleted?: boolean }) {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const canRead = can("hasanat.read");
  const includeDeleted = options?.includeDeleted ?? false;
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.hasanat.listDistributions.useQuery({
    queryKey: [...HASANAT_DISTRIBUTIONS_QUERY_KEY, { includeDeleted }],
    queryData: { query: { includeDeleted: includeDeleted ? "true" : "false" } },
    enabled: isAuthenticated && canRead && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}

export function useHasanatDistributionsCollection(options?: {
  enabled?: boolean;
  includeDeleted?: boolean;
}): Distribution[] {
  const query = useHasanatDistributions(options);
  if (!query.data || query.data.status !== 200) return [];
  const body = query.data.body;
  if (Array.isArray(body)) return body as Distribution[];
  if (
    body &&
    typeof body === "object" &&
    "distributions" in body &&
    Array.isArray(body.distributions)
  ) {
    return body.distributions as Distribution[];
  }
  return [];
}

export function useHasanatReportAggregates(options?: {
  enabled?: boolean;
  comparison?: HasanatReportComparisonQuery;
}) {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const canRead = can("hasanat.read");
  const enabled = options?.enabled ?? true;
  const comparison = normalizeHasanatReportComparisonQuery(options?.comparison);

  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.hasanat.reportAggregates.useQuery({
    queryKey: [...HASANAT_REPORT_AGGREGATES_QUERY_KEY, comparison ?? null],
    queryData: {
      query: {
        sessionIds: comparison?.sessionIds?.length ? comparison.sessionIds.join(",") : undefined,
        rangeAFrom: comparison?.rangeAFrom,
        rangeATo: comparison?.rangeATo,
        rangeBFrom: comparison?.rangeBFrom,
        rangeBTo: comparison?.rangeBTo,
      },
    },
    enabled: isAuthenticated && canRead && enabled,
    staleTime: 30_000,
  });
}

export function useHasanatRedemptions(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const canRead = can("hasanat.read");
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.hasanat.listRedemptions.useQuery({
    queryKey: HASANAT_REDEMPTIONS_QUERY_KEY,
    enabled: isAuthenticated && canRead && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}

export function useHasanatRedemptionsCollection(options?: { enabled?: boolean }): Redemption[] {
  const query = useHasanatRedemptions(options);
  if (!query.data || query.data.status !== 200) return [];
  const body: unknown = query.data.body;
  if (Array.isArray(body)) return body as Redemption[];
  return (body as { redemptions?: Redemption[] } | null)?.redemptions ?? [];
}

export function useHasanatMetrics(options?: { enabled?: boolean }) {
  const { can } = usePermissions();
  const canRead = can("hasanat.read");
  return useServerMetrics<HasanatCommandMetricsSnapshot>({
    moduleId: HASANAT_MODULE_MANIFEST.moduleId,
    apiPath: HASANAT_MODULE_MANIFEST.restBasePath,
    enabled: canRead && (options?.enabled ?? true),
  });
}
