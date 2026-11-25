import {
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
  keepPreviousData,
} from "@tanstack/react-query";
import { apiContract } from "@mms/fe-core/api/tsRest";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import type {
  AuditRetentionRegime,
  AuditActionType,
  AuditAnomalyReport,
  AuditListResponse,
  AuditVerificationResult,
  AuditExportPayload,
  AuditMerkleRootsResponse,
  AuditErasureResponse,
} from "@mms/contracts";
import { assertContractOk } from "@mms/fe-core/api/contractError";

/**
 * Audit cache keys carry the `auth` segment so `canPersistQuery` keeps them out
 * of IndexedDB persistence — audit rows are session-sensitive and must never be
 * restored from browser storage on re-login.
 */
export const AUDIT_EVENTS_QUERY_KEY = ["auth", "audit", "events"] as const;
export const AUDIT_MERKLE_ROOTS_QUERY_KEY = ["auth", "audit", "merkle-roots"] as const;
export const AUDIT_ANOMALIES_QUERY_KEY = ["auth", "audit", "anomalies"] as const;

export interface AuditListFilters {
  limit?: number;
  offset?: number;
  tableName?: string;
  recordId?: string;
  actionType?: AuditActionType;
}

export type {
  AuditListResponse,
  AuditVerificationResult,
  AuditExportPayload,
  AuditMerkleRootsResponse,
  AuditErasureResponse,
};

export interface ExecuteErasureParams {
  subjectId: string;
  regime: AuditRetentionRegime;
  erasureType: "CRYPTO_SHRED" | "REDACT_APPEND";
  reason?: string;
}

export interface AuditEventsQueryOptions {
  /** Gates the query on the caller's session (default: enabled). */
  enabled?: boolean;
}

export function auditEventsQueryOptions(
  filters: AuditListFilters = {},
  options: AuditEventsQueryOptions = {},
) {
  const query = {
    ...(filters.limit ? { limit: filters.limit } : {}),
    ...(filters.offset ? { offset: filters.offset } : {}),
    ...(filters.tableName ? { tableName: filters.tableName } : {}),
    ...(filters.recordId ? { recordId: filters.recordId } : {}),
    ...(filters.actionType ? { actionType: filters.actionType } : {}),
  };

  return queryOptions({
    queryKey: [...AUDIT_EVENTS_QUERY_KEY, filters] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.audit.listEvents({
        query,
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to load audit events");
      return response.body as AuditListResponse;
    },
    staleTime: 30_000,
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useAuditEventsQuery(filters: AuditListFilters = {}) {
  const { isAuthenticated } = useAuth();
  return useQuery(auditEventsQueryOptions(filters, { enabled: isAuthenticated }));
}

export function useAuditMerkleRootsQuery() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: AUDIT_MERKLE_ROOTS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.audit.listMerkleRoots({
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to load Merkle roots");
      return response.body as AuditMerkleRootsResponse;
    },
    staleTime: 60_000,
    enabled: isAuthenticated,
  });
}

export function useAuditVerifyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiContract.audit.verifyChain({});
      assertContractOk(response, "Audit verification failed");
      return response.body as AuditVerificationResult;
    },
    // Returned (not `void`ed) so `mutateAsync` resolves only once the audit
    // caches have been refreshed — callers can close panels on completion.
    onSettled: () => queryClient.invalidateQueries({ queryKey: AUDIT_EVENTS_QUERY_KEY }),
  });
}

export function useAuditErasureMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: ExecuteErasureParams) => {
      const response = await apiContract.audit.executeErasure({ body: params });
      assertContractOk(response, "Audit erasure failed");
      return response.body as AuditErasureResponse;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: AUDIT_EVENTS_QUERY_KEY }),
  });
}

export function useAuditAnomaliesQuery(windowHours = 24) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [...AUDIT_ANOMALIES_QUERY_KEY, windowHours] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.audit.getAnomalies({
        query: { windowHours },
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to load audit anomalies");
      return response.body as AuditAnomalyReport;
    },
    staleTime: 60_000,
    enabled: isAuthenticated,
  });
}
