import type {
  ObligationType,
  Mujtahid,
  MujtahidRep,
  WakalaType,
  ObligationDistribution,
  ObligationCollection,
  ObligationsCommandMetricsSnapshot,
  ObligationsReportQuery,
} from "@mms/shared";
import { OBLIGATIONS_MODULE_MANIFEST } from "@mms/shared";
import { serverMetricsQueryOptions, useServerMetrics } from "@/hooks/useServerMetrics";
import { useAuth } from "@/lib/contexts/AuthContext";
import { NotifiedMutationError } from "@/lib/notifiedMutationError";
import { tsrClient } from "@/lib/api";

export function obligationsCommandMetricsQueryOptions() {
  return serverMetricsQueryOptions<ObligationsCommandMetricsSnapshot>({
    moduleId: OBLIGATIONS_MODULE_MANIFEST.moduleId,
    apiPath: OBLIGATIONS_MODULE_MANIFEST.restBasePath,
  });
}
import {
  OBLIGATIONS_TYPES_QUERY_KEY,
  OBLIGATIONS_MUJTAHIDS_QUERY_KEY,
  OBLIGATIONS_REPS_QUERY_KEY,
  OBLIGATIONS_WAKALA_QUERY_KEY,
  OBLIGATIONS_DISTRIBUTIONS_QUERY_KEY,
  OBLIGATIONS_COLLECTIONS_QUERY_KEY,
  OBLIGATIONS_METRICS_QUERY_KEY,
  OBLIGATIONS_REPORT_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/obligations/hooks/obligationsQueryKeys";

export {
  OBLIGATIONS_TYPES_QUERY_KEY,
  OBLIGATIONS_MUJTAHIDS_QUERY_KEY,
  OBLIGATIONS_REPS_QUERY_KEY,
  OBLIGATIONS_WAKALA_QUERY_KEY,
  OBLIGATIONS_DISTRIBUTIONS_QUERY_KEY,
  OBLIGATIONS_COLLECTIONS_QUERY_KEY,
  OBLIGATIONS_METRICS_QUERY_KEY,
  OBLIGATIONS_REPORT_AGGREGATES_QUERY_KEY,
};
export { useObligationsMutations } from "@/tenant/features/obligations/hooks/useObligationsMutations";

/** @deprecated Prefer NotifiedMutationError — kept for form catch compatibility. */
export class NotifiedObligationsMutationError extends NotifiedMutationError {}

export function useObligationsTypes(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.obligations.listTypes.useQuery({
    queryKey: OBLIGATIONS_TYPES_QUERY_KEY,
    enabled: isAuthenticated && enabled,
    staleTime: 30_000,
  });
}

export function useObligationsTypesCollection(options?: { enabled?: boolean }): ObligationType[] {
  const query = useObligationsTypes(options);
  if (!query.data || query.data.status !== 200) return [];
  const body: unknown = query.data.body;
  if (Array.isArray(body)) return body as ObligationType[];
  return Array.isArray((body as { types?: ObligationType[] } | null)?.types)
    ? (body as { types: ObligationType[] }).types
    : [];
}

export function useObligationsMujtahids(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.obligations.listMujtahids.useQuery({
    queryKey: OBLIGATIONS_MUJTAHIDS_QUERY_KEY,
    enabled: isAuthenticated && enabled,
    staleTime: 30_000,
  });
}

export function useObligationsMujtahidsCollection(options?: { enabled?: boolean }): Mujtahid[] {
  const query = useObligationsMujtahids(options);
  if (!query.data || query.data.status !== 200) return [];
  const body: unknown = query.data.body;
  if (Array.isArray(body)) return body as Mujtahid[];
  return Array.isArray((body as { mujtahids?: Mujtahid[] } | null)?.mujtahids)
    ? (body as { mujtahids: Mujtahid[] }).mujtahids
    : [];
}

export function useObligationsReps(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.obligations.listReps.useQuery({
    queryKey: OBLIGATIONS_REPS_QUERY_KEY,
    enabled: isAuthenticated && enabled,
    staleTime: 30_000,
  });
}

export function useObligationsRepsCollection(options?: { enabled?: boolean }): MujtahidRep[] {
  const query = useObligationsReps(options);
  if (!query.data || query.data.status !== 200) return [];
  const body: unknown = query.data.body;
  if (Array.isArray(body)) return body as MujtahidRep[];
  return Array.isArray((body as { reps?: MujtahidRep[] } | null)?.reps)
    ? (body as { reps: MujtahidRep[] }).reps
    : [];
}

export function useObligationsWakala(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.obligations.listWakala.useQuery({
    queryKey: OBLIGATIONS_WAKALA_QUERY_KEY,
    enabled: isAuthenticated && enabled,
    staleTime: 30_000,
  });
}

export function useObligationsWakalaCollection(options?: { enabled?: boolean }): WakalaType[] {
  const query = useObligationsWakala(options);
  if (!query.data || query.data.status !== 200) return [];
  const body: unknown = query.data.body;
  if (Array.isArray(body)) return body as WakalaType[];
  return Array.isArray((body as { wakalaTypes?: WakalaType[] } | null)?.wakalaTypes)
    ? (body as { wakalaTypes: WakalaType[] }).wakalaTypes
    : [];
}

export function useObligationsDistributions(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.obligations.listDistributions.useQuery({
    queryKey: OBLIGATIONS_DISTRIBUTIONS_QUERY_KEY,
    enabled: isAuthenticated && enabled,
    staleTime: 30_000,
  });
}

export function useObligationsDistributionsCollection(options?: {
  enabled?: boolean;
}): ObligationDistribution[] {
  const query = useObligationsDistributions(options);
  if (!query.data || query.data.status !== 200) return [];
  const body: unknown = query.data.body;
  if (Array.isArray(body)) return body as ObligationDistribution[];
  return Array.isArray((body as { distributions?: ObligationDistribution[] } | null)?.distributions)
    ? (body as { distributions: ObligationDistribution[] }).distributions
    : [];
}

export function useObligationsCollections(options?: {
  enabled?: boolean;
  includeDeleted?: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const includeDeleted = options?.includeDeleted ?? false;
  const enabled = options?.enabled ?? true;
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.obligations.listCollections.useQuery({
    queryKey: [...OBLIGATIONS_COLLECTIONS_QUERY_KEY, { includeDeleted }],
    queryData: { query: { includeDeleted: includeDeleted ? "true" : undefined } },
    staleTime: 30_000,
  });
}

export function useObligationsCollectionsCollection(options?: {
  enabled?: boolean;
  includeDeleted?: boolean;
}): ObligationCollection[] {
  const query = useObligationsCollections(options);
  if (!query.data || query.data.status !== 200) return [];
  const body: unknown = query.data.body;
  if (Array.isArray(body)) return body as ObligationCollection[];
  return Array.isArray((body as { collections?: ObligationCollection[] } | null)?.collections)
    ? (body as { collections: ObligationCollection[] }).collections
    : [];
}

export function useObligationsMetrics(options?: { enabled?: boolean }) {
  return useServerMetrics<ObligationsCommandMetricsSnapshot>({
    moduleId: OBLIGATIONS_MODULE_MANIFEST.moduleId,
    apiPath: OBLIGATIONS_MODULE_MANIFEST.restBasePath,
    enabled: options?.enabled,
  });
}

export function useObligationsReportAggregates(
  query?: ObligationsReportQuery,
  options?: { enabled?: boolean },
) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.obligations.reportAggregates.useQuery({
    queryKey: [...OBLIGATIONS_REPORT_AGGREGATES_QUERY_KEY, query],
    queryData: { query: query ?? {} },
    enabled: isAuthenticated && enabled,
    staleTime: 5 * 60 * 1000,
  });
}
