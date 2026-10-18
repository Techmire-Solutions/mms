import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import type {
  AuditRetentionRegime,
  AuditActionType,
  AuditAnomalyReport,
  AuditListResponse,
  AuditVerificationResult,
  AuditExportPayload,
  AuditMerkleRootsResponse,
  AuditErasureResponse,
} from "@mms/shared";

export const AUDIT_EVENTS_QUERY_KEY = ["audit", "events"] as const;
export const AUDIT_MERKLE_ROOTS_QUERY_KEY = ["audit", "merkle-roots"] as const;
export const AUDIT_ANOMALIES_QUERY_KEY = ["audit", "anomalies"] as const;

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

/** Throws an `ApiError` on a non-200 contract envelope (preserves the old throw-on-!ok). */
function assertOk(response: { status: number; body: unknown }, context: string): void {
  if (response.status === 200) return;
  const errorBody = response.body as { message?: string; type?: string } | undefined;
  throw new ApiError(response.status, errorBody?.message ?? context, errorBody?.type);
}

export function auditEventsQueryOptions(filters: AuditListFilters = {}) {
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
      assertOk(response, "Failed to load audit events");
      return response.body as AuditListResponse;
    },
    staleTime: 30_000,
  });
}

export function useAuditEventsQuery(filters: AuditListFilters = {}) {
  return useQuery(auditEventsQueryOptions(filters));
}

export function useAuditMerkleRootsQuery() {
  return useQuery({
    queryKey: AUDIT_MERKLE_ROOTS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.audit.listMerkleRoots({
        signal,
        fetchOptions: { signal },
      });
      assertOk(response, "Failed to load Merkle roots");
      return response.body as AuditMerkleRootsResponse;
    },
    staleTime: 60_000,
  });
}

export function useAuditVerifyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiContract.audit.verifyChain({});
      assertOk(response, "Audit verification failed");
      return response.body as AuditVerificationResult;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUDIT_EVENTS_QUERY_KEY });
    },
  });
}

export function useAuditErasureMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: ExecuteErasureParams) => {
      const response = await apiContract.audit.executeErasure({ body: params });
      assertOk(response, "Audit erasure failed");
      return response.body as AuditErasureResponse;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUDIT_EVENTS_QUERY_KEY });
    },
  });
}

export function useAuditAnomaliesQuery(windowHours = 24) {
  return useQuery({
    queryKey: [...AUDIT_ANOMALIES_QUERY_KEY, windowHours] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.audit.getAnomalies({
        query: { windowHours },
        signal,
        fetchOptions: { signal },
      });
      assertOk(response, "Failed to load audit anomalies");
      return response.body as AuditAnomalyReport;
    },
    staleTime: 60_000,
  });
}
