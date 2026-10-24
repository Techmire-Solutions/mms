import type {
  WorkspaceUser,
  ActivityLog,
  UsersCommandMetricsSnapshot,
  SystemUser,
} from "@mms/shared";
import { USERS_MODULE_MANIFEST, normalizeWorkspaceUser } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { serverMetricsQueryOptions, useServerMetrics } from "@/hooks/useServerMetrics";
import {
  ACTIVITY_LOGS_QUERY_KEY,
  USERS_LIST_QUERY_KEY,
  USERS_METRICS_QUERY_KEY,
} from "./usersQueryKeys";
import { apiContract, tsrClient } from "@/lib/api";

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

  const query = tsrClient.users.list.useQuery({
    queryKey: [...USERS_LIST_QUERY_KEY, "resolve", idsKey] as const,
    queryData: {
      query: {
        ids: idsKey,
        page: 1,
        limit: Math.max(1, Math.min(normalizedIds.length, USERS_MODULE_MANIFEST.maxPageSize)),
      },
    },
    staleTime: 30_000,
    enabled: isAuthenticated && enabled && normalizedIds.length > 0,
  });

  const responseData: unknown = query.data?.status === 200 ? query.data.body : undefined;
  const users = Array.isArray(responseData)
    ? responseData
    : ((responseData as { users?: unknown[] } | null)?.users ?? []);
  return {
    ...query,
    data: users.map((user) =>
      normalizeWorkspaceUser(user as Partial<SystemUser> & { roles?: string[]; role?: string }),
    ) as WorkspaceUser[],
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
  const enabled = options?.enabled ?? true;
  return tsrClient.users.activity.useQuery({
    queryKey: ACTIVITY_LOGS_QUERY_KEY,
    enabled,
    staleTime: 15_000,
  });
}

export function useActivityLogsCollection(options?: { enabled?: boolean }): ActivityLog[] {
  const query = useActivityLogs(options);
  return extractActivityLogs(query.data);
}

// --- Contract-driven list queryOptions & mutation hooks ----------------------

import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { invalidateUsersQueries } from "@/tenant/features/users/hooks/invalidateUsersQueries";

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
      if (response.status !== 200) {
        throw new Error("Failed to fetch users");
      }
      return response.body;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function useUsersContractList(query: Record<string, unknown>, enabled = true) {
  return tsrClient.users.list.useQuery({
    queryKey: [...USERS_LIST_QUERY_KEY, "contract", query],
    queryData: { query },
    staleTime: 15_000,
    enabled,
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
