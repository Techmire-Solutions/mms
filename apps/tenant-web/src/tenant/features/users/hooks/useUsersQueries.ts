import { keepPreviousData, queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  WorkspaceUser,
  ActivityLog,
  UsersCommandMetricsSnapshot,
  SystemUser,
} from "@mms/contracts";
import { USERS_MODULE_MANIFEST, normalizeWorkspaceUser } from "@mms/contracts";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import { serverMetricsQueryOptions, useServerMetrics } from "@mms/fe-core/hooks";
import {
  ACTIVITY_LOGS_QUERY_KEY,
  USERS_LIST_QUERY_KEY,
  USERS_METRICS_QUERY_KEY,
} from "./usersQueryKeys";
import { apiContract, tsrClient } from "@mms/fe-core/api/tsRest";
import { invalidateUsersQueries } from "@/tenant/features/users/hooks/invalidateUsersQueries";
import { assertContractOk } from "@mms/fe-core/api/contractError";

export { USERS_LIST_QUERY_KEY, USERS_METRICS_QUERY_KEY, ACTIVITY_LOGS_QUERY_KEY };

const USERS_API = USERS_MODULE_MANIFEST.restBasePath;

export function usersCommandMetricsQueryOptions() {
  return serverMetricsQueryOptions<UsersCommandMetricsSnapshot>({
    moduleId: USERS_MODULE_MANIFEST.moduleId,
    apiPath: USERS_API,
  });
}

/** Resolve only the users referenced by another collection. */
export function useUsersByIds(
  ids: Array<string | number | null | undefined>,
  options?: { enabled?: boolean },
) {
  const { isAuthenticated } = useAuth();
  const normalizedIds = Array.from(
    new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean)),
  ).sort();
  const idsKey = normalizedIds.join(",");
  const enabled = options?.enabled ?? true;

  // The list endpoint paginates every `ids` filter at `maxPageSize`, so a single
  // request silently truncated batches larger than one page. Fetch in
  // `maxPageSize` chunks and merge (mirrors `useContactsByIds`).
  const query = useQuery({
    queryKey: [...USERS_LIST_QUERY_KEY, "resolve", idsKey] as const,
    queryFn: async ({ signal }) => {
      const chunkSize = USERS_MODULE_MANIFEST.maxPageSize;
      const resolved: WorkspaceUser[] = [];
      for (let index = 0; index < normalizedIds.length; index += chunkSize) {
        const chunk = normalizedIds.slice(index, index + chunkSize);
        const response = await apiContract.users.list({
          query: { ids: chunk.join(","), page: 1, limit: chunk.length },
          signal,
          fetchOptions: { signal },
        });
        if (response.status !== 200) continue;
        const body: unknown = response.body;
        const rows = Array.isArray(body)
          ? body
          : ((body as { users?: unknown[] } | null)?.users ?? []);
        resolved.push(
          ...rows.map((user) =>
            normalizeWorkspaceUser(
              user as Partial<SystemUser> & { roles?: string[]; role?: string },
            ),
          ),
        );
      }
      return resolved;
    },
    staleTime: 30_000,
    enabled: isAuthenticated && enabled && normalizedIds.length > 0,
  });

  return {
    ...query,
    data: (query.data ?? []) as WorkspaceUser[],
  };
}

export function useUsersMetrics(options?: { enabled?: boolean }) {
  return useServerMetrics<UsersCommandMetricsSnapshot>({
    moduleId: USERS_MODULE_MANIFEST.moduleId,
    apiPath: USERS_API,
    enabled: options?.enabled,
  });
}

export function extractActivityLogs(queryData: unknown): ActivityLog[] {
  if (!queryData || typeof queryData !== "object") return [];
  const status = (queryData as { status?: number }).status;
  if (status !== undefined && status !== 200) return [];
  const body: unknown = (queryData as { body?: unknown }).body ?? queryData;
  if (Array.isArray(body)) return body as ActivityLog[];
  return Array.isArray((body as { logs?: ActivityLog[] } | null)?.logs)
    ? (body as { logs: ActivityLog[] }).logs
    : [];
}

export function useActivityLogs(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  return tsrClient.users.activity.useQuery({
    queryKey: ACTIVITY_LOGS_QUERY_KEY,
    enabled: isAuthenticated && enabled,
    staleTime: 15_000,
  });
}

export function useActivityLogsCollection(options?: { enabled?: boolean }): ActivityLog[] {
  const query = useActivityLogs(options);
  return extractActivityLogs(query.data);
}

// --- Contract-driven list queryOptions & mutation hooks ----------------------

export function usersListQueryOptions(
  query: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
    includeDeleted?: boolean;
    [key: string]: unknown;
  } = {},
) {
  return queryOptions({
    queryKey: [...USERS_LIST_QUERY_KEY, "contract", query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.users.list({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to fetch users");
      return response.body;
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useUsersContractList(query: Record<string, unknown>, enabled = true) {
  const { isAuthenticated } = useAuth();
  return tsrClient.users.list.useQuery({
    queryKey: [...USERS_LIST_QUERY_KEY, "contract", query],
    queryData: { query },
    staleTime: 15_000,
    enabled: isAuthenticated && enabled,
  });
}

export function useUsersContractCreate() {
  const queryClient = useQueryClient();
  return tsrClient.users.create.useMutation({
    onSuccess: () => invalidateUsersQueries(queryClient),
  });
}

export function useUsersContractUpdate() {
  const queryClient = useQueryClient();
  return tsrClient.users.update.useMutation({
    onSuccess: () => invalidateUsersQueries(queryClient),
  });
}

export function useUsersContractInvite() {
  const queryClient = useQueryClient();
  return tsrClient.users.invite.useMutation({
    onSuccess: () => invalidateUsersQueries(queryClient),
  });
}

export function useUsersContractBulkUpdate() {
  const queryClient = useQueryClient();
  return tsrClient.users.bulkUpdate.useMutation({
    onSuccess: () => invalidateUsersQueries(queryClient),
  });
}

export function useUsersContractBulkDelete() {
  const queryClient = useQueryClient();
  return tsrClient.users.bulkDelete.useMutation({
    onSuccess: () => invalidateUsersQueries(queryClient),
  });
}

export function useUsersContractBulkRestore() {
  const queryClient = useQueryClient();
  return tsrClient.users.bulkRestore.useMutation({
    onSuccess: () => invalidateUsersQueries(queryClient),
  });
}

export function useUsersContractDelete() {
  const queryClient = useQueryClient();
  return tsrClient.users.delete.useMutation({
    onSuccess: () => invalidateUsersQueries(queryClient),
  });
}

export function useUsersContractRestore() {
  const queryClient = useQueryClient();
  return tsrClient.users.restore.useMutation({
    onSuccess: () => invalidateUsersQueries(queryClient),
  });
}

export function useUsersContractVerifyEmail() {
  const queryClient = useQueryClient();
  return tsrClient.users.verifyEmail.useMutation({
    onSuccess: () => invalidateUsersQueries(queryClient),
  });
}
