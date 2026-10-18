import { USERS_MODULE_MANIFEST, type UsersListPageResult, type WorkspaceUser } from "@mms/shared";
import { createModuleListQueryBuilders } from "@/lib/query/createModuleListQueryBuilders";

const USERS_API = USERS_MODULE_MANIFEST.restBasePath;
const USERS_QUERY_KEY = [USERS_MODULE_MANIFEST.collectionKey] as const;
export const USERS_LIST_QUERY_KEY = [...USERS_QUERY_KEY, "list"] as const;
export const USERS_METRICS_QUERY_KEY = [...USERS_QUERY_KEY, "metrics"] as const;
export const ACTIVITY_LOGS_QUERY_KEY = [...USERS_QUERY_KEY, "logs", "list"] as const;

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

const builders = createModuleListQueryBuilders<UsersPaginatedParams>({
  resolveApiPath: () => USERS_API,
  resolveQueryKey: () => USERS_LIST_QUERY_KEY,
  defaultPageSize: USERS_MODULE_MANIFEST.defaultPageSize,
  // Users omits filters equal to their default (the key params double as the request query).
  keyStyle: "omit",
  fields: [
    { name: "search", kind: "text", keyDefault: "" },
    { name: "status", kind: "enum", keyDefault: "", allValue: "all" },
    { name: "role", kind: "enum", keyDefault: "", allValue: "all" },
    { name: "sortField", kind: "text", keyDefault: "" },
    { name: "sortDir", kind: "text", keyDefault: "" },
    { name: "includeDeleted", kind: "boolean", keyDefault: false },
  ],
});

export const buildUsersPageUrl = builders.buildPageUrl;
export const usersPaginatedQueryKey = builders.paginatedQueryKey;
export const usersListQueryKeyParams = builders.listQueryKeyParams;
export const sameUsersListFilters = builders.sameListFilters;

export type { UsersListPageResult, WorkspaceUser };
