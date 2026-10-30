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
import { apiContract, tsrClient } from "@/lib/api";
import {
  HASANAT_DENOMS_QUERY_KEY,
  HASANAT_BATCHES_QUERY_KEY,
  HASANAT_DISTRIBUTIONS_QUERY_KEY,
  HASANAT_REDEMPTIONS_QUERY_KEY,
  HASANAT_METRICS_QUERY_KEY,
  HASANAT_REPORT_AGGREGATES_QUERY_KEY,
} from "./hasanatQueryKeys";
export {
  HASANAT_DENOMS_QUERY_KEY,
  HASANAT_BATCHES_QUERY_KEY,
  HASANAT_DISTRIBUTIONS_QUERY_KEY,
  HASANAT_REDEMPTIONS_QUERY_KEY,
  HASANAT_METRICS_QUERY_KEY,
  HASANAT_REPORT_AGGREGATES_QUERY_KEY,
};
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

// --- Contract-driven list queryOptions & mutation hooks ----------------------

import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { invalidateHasanatQueries } from "@/tenant/features/hasanat/hooks/invalidateHasanatQueries";
import { assertContractOk } from "@/lib/apiContractError";

export function hasanatListQueryOptions(query: Record<string, unknown> = {}) {
  return queryOptions({
    queryKey: [...HASANAT_DISTRIBUTIONS_QUERY_KEY, "contract-list", query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.hasanat.listDistributions({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to fetch hasanat distributions");
      return response.body;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function useHasanatContractList(query: Record<string, unknown> = {}, enabled = true) {
  const { can } = usePermissions();
  return tsrClient.hasanat.listDistributions.useQuery({
    queryKey: [...HASANAT_DISTRIBUTIONS_QUERY_KEY, "contract-list", query],
    queryData: { query },
    staleTime: 15_000,
    enabled: can("hasanat.read") && enabled,
  });
}

export function useHasanatContractDenoms(enabled = true) {
  const { can } = usePermissions();
  return tsrClient.hasanat.listDenoms.useQuery({
    queryKey: [...HASANAT_DENOMS_QUERY_KEY, "contract-list"],
    queryData: { query: {} },
    staleTime: 30_000,
    enabled: can("hasanat.read") && enabled,
  });
}

export function useHasanatContractBatches(enabled = true) {
  const { can } = usePermissions();
  return tsrClient.hasanat.listBatches.useQuery({
    queryKey: [...HASANAT_BATCHES_QUERY_KEY, "contract-list"],
    queryData: { query: {} },
    staleTime: 30_000,
    enabled: can("hasanat.read") && enabled,
  });
}

export function useHasanatContractRedemptions(enabled = true) {
  const { can } = usePermissions();
  return tsrClient.hasanat.listRedemptions.useQuery({
    queryKey: [...HASANAT_REDEMPTIONS_QUERY_KEY, "contract-list"],
    queryData: { query: {} },
    staleTime: 30_000,
    enabled: can("hasanat.read") && enabled,
  });
}

export function useHasanatContractBulkDelete() {
  const queryClient = useQueryClient();
  return tsrClient.hasanat.bulkDeleteDistributions.useMutation({
    onSuccess: () => invalidateHasanatQueries(queryClient),
  });
}

export function useHasanatContractBulkRestore() {
  const queryClient = useQueryClient();
  return tsrClient.hasanat.bulkRestoreDistributions.useMutation({
    onSuccess: () => invalidateHasanatQueries(queryClient),
  });
}

export function useHasanatContractDeleteDistribution() {
  const queryClient = useQueryClient();
  return tsrClient.hasanat.deleteDistribution.useMutation({
    onSuccess: () => invalidateHasanatQueries(queryClient),
  });
}

export function useHasanatContractRestoreDistribution() {
  const queryClient = useQueryClient();
  return tsrClient.hasanat.restoreDistribution.useMutation({
    onSuccess: () => invalidateHasanatQueries(queryClient),
  });
}
