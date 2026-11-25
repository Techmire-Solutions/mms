import { z } from "zod";
import type { WorkspaceUser } from "./userEntityTypes.js";
import { baseListQuerySchema, LIST_PAGE_MAX_LIMIT } from "../core/apiSchemas.js";
import { compareByField, paginateArray } from "../core/utils.js";

export interface UsersListQuery {
  page?: number;
  limit?: number;
  search?: string;
  /** Comma-separated status values (e.g. `active,suspended`). */
  status?: string;
  /** Workspace role id filter. */
  role?: string;
  sortField?: string;
  sortDir?: "asc" | "desc" | "";
  /** When true, SQL list returns deleted-only rows (Work trash). */
  includeDeleted?: boolean;
  /** Comma-separated ids for bounded relationship/actor resolution. */
  ids?: string;
}

/** Validates Users Work list query received over HTTP. */
export const usersListQuerySchema = baseListQuerySchema.extend({
  status: z.string().max(200).optional(),
  role: z.string().max(64).optional(),
  ids: z.string().max(10_000).optional(),
});

export type UsersListQueryParsed = z.infer<typeof usersListQuerySchema>;

export interface UsersListPageResult {
  users: WorkspaceUser[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export function userMatchesSearch(user: WorkspaceUser, search: string): boolean {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return true;
  return (
    (user.name ?? "").toLowerCase().includes(normalizedSearch) ||
    (user.email ?? "").toLowerCase().includes(normalizedSearch) ||
    (user.loginEmail ?? "").toLowerCase().includes(normalizedSearch)
  );
}

export function filterUsersForQuery(
  users: WorkspaceUser[],
  query: UsersListQuery,
): WorkspaceUser[] {
  let rows = users;
  if (query.ids?.trim()) {
    const ids = new Set(
      query.ids
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    );
    rows = rows.filter((user) => ids.has(String(user.id)));
  }
  if (query.role?.trim() && query.role !== "all") {
    rows = rows.filter((user) => user.role === query.role);
  }
  if (query.status?.trim()) {
    const statuses = new Set(
      query.status
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    if (statuses.size > 0) {
      rows = rows.filter((user) => statuses.has(String(user.status ?? "active")));
    }
  }
  if (query.search?.trim()) {
    const search = query.search.trim().toLowerCase();
    rows = rows.filter((user) => userMatchesSearch(user, search));
  }
  return rows;
}

/** Paginates an in-memory user list (tests / fallback). */
export function paginateUsers(users: WorkspaceUser[], query: UsersListQuery): UsersListPageResult {
  let rows = filterUsersForQuery(users, query);

  const sortField = query.sortField?.trim();
  if (sortField) {
    const sortDirection = query.sortDir === "desc" ? "desc" : "asc";
    rows = [...rows].sort((left, right) => compareByField(left, right, sortField, sortDirection));
  }

  const result = paginateArray(rows, query.page ?? 1, query.limit ?? 50, LIST_PAGE_MAX_LIMIT);
  return {
    users: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
    hasMore: result.hasMore,
  };
}
