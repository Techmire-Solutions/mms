import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiClient";
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

export function auditEventsQueryOptions(filters: AuditListFilters = {}) {
  const params = new URLSearchParams();
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));
  if (filters.tableName) params.set("tableName", filters.tableName);
  if (filters.recordId) params.set("recordId", filters.recordId);
  if (filters.actionType) params.set("actionType", filters.actionType);

  const queryStr = params.toString();
  const path = `/api/audit/events${queryStr ? `?${queryStr}` : ""}`;

  return queryOptions({
    queryKey: [...AUDIT_EVENTS_QUERY_KEY, filters] as const,
    queryFn: ({ signal }) => apiJson<AuditListResponse>(path, { signal }),
    staleTime: 30_000,
  });
}

export function useAuditEventsQuery(filters: AuditListFilters = {}) {
  return useQuery(auditEventsQueryOptions(filters));
}

export function useAuditMerkleRootsQuery() {
  return useQuery({
    queryKey: AUDIT_MERKLE_ROOTS_QUERY_KEY,
    queryFn: ({ signal }) =>
      apiJson<AuditMerkleRootsResponse>("/api/audit/merkle-roots", { signal }),
    staleTime: 60_000,
  });
}

export function useAuditVerifyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiJson<AuditVerificationResult>("/api/audit/verify", {
        method: "POST",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUDIT_EVENTS_QUERY_KEY });
    },
  });
}

export function useAuditErasureMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: ExecuteErasureParams) =>
      apiJson<AuditErasureResponse>("/api/audit/erasure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUDIT_EVENTS_QUERY_KEY });
    },
  });
}

export function useAuditAnomaliesQuery(windowHours = 24) {
  return useQuery({
    queryKey: [...AUDIT_ANOMALIES_QUERY_KEY, windowHours] as const,
    queryFn: ({ signal }) =>
      apiJson<AuditAnomalyReport>(`/api/audit/anomalies?windowHours=${windowHours}`, { signal }),
    staleTime: 60_000,
  });
}
