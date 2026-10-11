import { USERS_MODULE_MANIFEST, type UsersListPageResult, type WorkspaceUser } from "@mms/shared";

const USERS_API = USERS_MODULE_MANIFEST.restBasePath;
const USERS_QUERY_KEY = [USERS_MODULE_MANIFEST.moduleId, "users"] as const;
export const USERS_LIST_QUERY_KEY = [...USERS_QUERY_KEY, "list"] as const;
export const USERS_METRICS_QUERY_KEY = [USERS_MODULE_MANIFEST.moduleId, "metrics"] as const;
export const ACTIVITY_LOGS_QUERY_KEY = [USERS_MODULE_MANIFEST.moduleId, "logs", "list"] as const;

export interface UsersPaginatedParams {
  page: number;
  limit?: number;
  search?: string;
  status?: string;
  role?: string;
  sortField?: string;
  sortDir?: "asc" | "desc";
  includeDeleted?: boolean;
  enabled?: boolean;
}

export function buildUsersPageUrl(params: UsersPaginatedParams): string {
  const queryParams = new URLSearchParams();
  queryParams.set("page", String(params.page));
  queryParams.set("limit", String(params.limit ?? USERS_MODULE_MANIFEST.defaultPageSize));
  if (params.search?.trim()) queryParams.set("search", params.search.trim());
  if (params.status?.trim()) queryParams.set("status", params.status.trim());
  if (params.role?.trim() && params.role !== "all") queryParams.set("role", params.role.trim());
  if (params.sortField) queryParams.set("sortField", params.sortField);
  if (params.sortDir) queryParams.set("sortDir", params.sortDir);
  if (params.includeDeleted) queryParams.set("includeDeleted", "true");
  return `${USERS_API}?${queryParams.toString()}`;
}

export function usersPaginatedQueryKey(params: UsersPaginatedParams) {
  return [...USERS_LIST_QUERY_KEY, "page", params] as const;
}

export function usersListQueryKeyParams(params: UsersPaginatedParams) {
  return {
    ...(params.search?.trim() ? { search: params.search.trim() } : {}),
    ...(params.status?.trim() && params.status !== "all" ? { status: params.status.trim() } : {}),
    ...(params.role?.trim() && params.role !== "all" ? { role: params.role.trim() } : {}),
    ...(params.sortField?.trim() ? { sortField: params.sortField.trim() } : {}),
    ...(params.sortDir ? { sortDir: params.sortDir } : {}),
    ...(params.includeDeleted ? { includeDeleted: true } : {}),
    page: params.page,
    limit: params.limit ?? USERS_MODULE_MANIFEST.defaultPageSize,
  };
}

export function sameUsersListFilters(
  previous: ReturnType<typeof usersListQueryKeyParams> | undefined,
  next: ReturnType<typeof usersListQueryKeyParams>,
): boolean {
  if (!previous) return false;
  return (
    previous.search === next.search &&
    previous.status === next.status &&
    previous.role === next.role &&
    previous.sortField === next.sortField &&
    previous.sortDir === next.sortDir &&
    previous.includeDeleted === next.includeDeleted &&
    previous.limit === next.limit
  );
}

export type { UsersListPageResult, WorkspaceUser };
