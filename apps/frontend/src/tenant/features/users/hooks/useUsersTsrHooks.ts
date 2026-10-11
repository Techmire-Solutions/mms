/**
 * Phase 7: Contract-driven query/mutation hooks for the Users module.
 */
import { apiContract, tsrClient } from "@/lib/api";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { USERS_LIST_QUERY_KEY } from "@/tenant/features/users/hooks/usersQueryKeys";
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
