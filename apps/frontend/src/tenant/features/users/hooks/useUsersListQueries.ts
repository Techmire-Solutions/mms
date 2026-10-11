import { USERS_MODULE_MANIFEST } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { tsrClient, apiContract } from "@/lib/api";
import {
  sameUsersListFilters,
  usersListQueryKeyParams,
  usersPaginatedQueryKey,
  type UsersListPageResult,
  type UsersPaginatedParams,
} from "@/tenant/features/users/hooks/usersQueryKeys";

export function useUsersPaginated(params: UsersPaginatedParams) {
  const { isAuthenticated } = useAuth();
  const enabled = params.enabled ?? true;

  const query = tsrClient.users.list.useQuery({
    queryKey: usersPaginatedQueryKey(params),
    queryData: { query: usersListQueryKeyParams(params) },
    enabled: isAuthenticated && enabled,
    staleTime: 15_000,
    placeholderData: (previousData: unknown, previousQuery: unknown) => {
      const previousParams = (previousQuery as { queryKey?: unknown[] } | null)?.queryKey?.[3] as
        ReturnType<typeof usersListQueryKeyParams> | undefined;
      const keyParams = usersListQueryKeyParams(params);
      return sameUsersListFilters(previousParams, keyParams) ? previousData : undefined;
    },
  });
  const isError = query.isError || (query.data != null && query.data.status !== 200);
  const data = query.data?.status === 200 ? (query.data.body as UsersListPageResult) : undefined;

  return { ...query, data, isError };
}

/** Fetches all pages matching Work filters (non-Work consumers / export). */
export async function fetchAllUsersForQuery(
  params: Omit<UsersPaginatedParams, "page" | "enabled"> = {},
  onProgress?: (fetched: number, total: number) => void,
): Promise<UsersListPageResult["users"]> {
  const limit = USERS_MODULE_MANIFEST.maxPageSize;
  const all: UsersListPageResult["users"] = [];
  let page = 1;
  let total = 0;

  for (;;) {
    const response = await apiContract.users.list({
      query: { ...params, page, limit },
    });
    const usersPage = response.body as UsersListPageResult;
    all.push(...usersPage.users);
    total = usersPage.total;
    onProgress?.(all.length, total);
    if (!usersPage.hasMore) break;
    if (page >= 200) {
      throw new Error("User export exceeds the 100,000-record safety limit; narrow the filters.");
    }
    page += 1;
  }

  return all;
}

export type { UsersPaginatedParams };
