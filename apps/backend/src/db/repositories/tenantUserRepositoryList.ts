import { and, eq, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import {
  dedupeTrimmedIds,
  isQueryFlagTrue,
  MODULE_METRICS_DEFAULT_PERIOD_DAYS,
  toSqlSearchPattern,
  type UsersCommandMetricsSnapshot,
  type UsersListQuery,
} from "@mms/shared";
import { tenantUsers } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { runListPage } from "./listPageHelper.js";
import { rowToTenantUser, type TenantUserRow } from "./tenantUserRepository.js";

// List-page projection excludes bcrypt passwordHash so credential hashes are never pulled.
const TENANT_USER_LIST_COLUMNS = {
  id: tenantUsers.id,
  workspaceSubdomain: tenantUsers.workspaceSubdomain,
  loginEmail: tenantUsers.loginEmail,
  name: tenantUsers.name,
  role: tenantUsers.role,
  contactId: tenantUsers.contactId,
  emailVerifiedAt: tenantUsers.emailVerifiedAt,
  pendingLoginEmail: tenantUsers.pendingLoginEmail,
  mustChangePassword: tenantUsers.mustChangePassword,
  createdAt: tenantUsers.createdAt,
  updatedAt: tenantUsers.updatedAt,
  deletedAt: tenantUsers.deletedAt,
  deletedBy: tenantUsers.deletedBy,
  profileJson: tenantUsers.profileJson,
} as const;

const USER_SORT_FIELDS = new Set([
  "name",
  "email",
  "role",
  "status",
  "createdDate",
  "lastLogin",
  "createdAt",
]);

function statusExpr(): SQL {
  return sql`lower(trim(COALESCE(${tenantUsers.profileJson}->>'status', 'active')))`;
}

function buildSearchSql(search: string): SQL | null {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return null;
  const pattern = toSqlSearchPattern(normalized);
  return sql`(
    lower(${tenantUsers.name}) LIKE ${pattern}
    OR lower(${tenantUsers.loginEmail}) LIKE ${pattern}
  )`;
}

function buildOrderBy(
  sortField: string | undefined,
  sortDir: "asc" | "desc" | "" | undefined,
): SQL {
  const dir = sortDir === "desc" ? "desc" : "asc";
  const field = sortField?.trim();
  if (!field || !USER_SORT_FIELDS.has(field)) {
    return sql`${tenantUsers.name} asc`;
  }
  if (field === "name") {
    return dir === "desc"
      ? sql`lower(${tenantUsers.name}) desc nulls last`
      : sql`lower(${tenantUsers.name}) asc nulls last`;
  }
  if (field === "email") {
    return dir === "desc"
      ? sql`lower(${tenantUsers.loginEmail}) desc nulls last`
      : sql`lower(${tenantUsers.loginEmail}) asc nulls last`;
  }
  if (field === "role") {
    return dir === "desc"
      ? sql`lower(${tenantUsers.role}) desc nulls last`
      : sql`lower(${tenantUsers.role}) asc nulls last`;
  }
  if (field === "status") {
    const statusSort = statusExpr();
    return dir === "desc" ? sql`${statusSort} desc nulls last` : sql`${statusSort} asc nulls last`;
  }
  if (field === "createdDate" || field === "createdAt") {
    return dir === "desc"
      ? sql`${tenantUsers.createdAt} desc nulls last`
      : sql`${tenantUsers.createdAt} asc nulls last`;
  }
  if (field === "lastLogin") {
    const lastLoginSort = sql`NULLIF(trim(COALESCE(${tenantUsers.profileJson}->>'lastLogin', '')), '')`;
    return dir === "desc"
      ? sql`${lastLoginSort} desc nulls last`
      : sql`${lastLoginSort} asc nulls last`;
  }
  return sql`${tenantUsers.name} asc`;
}

function buildListConditions(
  subdomain: string,
  query: UsersListQuery & { includeDeleted?: boolean },
): SQL[] {
  const conditions: SQL[] = [eq(tenantUsers.workspaceSubdomain, subdomain)];

  if (isQueryFlagTrue(query.includeDeleted)) {
    conditions.push(isNotNull(tenantUsers.deletedAt));
  } else {
    conditions.push(isNull(tenantUsers.deletedAt));
  }

  const ids = dedupeTrimmedIds(query.ids);
  if (ids.length > 0) {
    conditions.push(inArray(tenantUsers.id, ids));
  }

  if (query.role?.trim() && query.role !== "all") {
    conditions.push(eq(tenantUsers.role, query.role.trim()));
  }

  const rawStatuses = dedupeTrimmedIds(query.status);
  if (rawStatuses.length > 0) {
    const statuses = rawStatuses.map((status) => status.toLowerCase());
    conditions.push(
      sql`${statusExpr()} IN (${sql.join(
        statuses.map((status) => sql`${status}`),
        sql`, `,
      )})`,
    );
  }

  const search = query.search?.trim();
  if (search) {
    const searchSql = buildSearchSql(search);
    if (searchSql) conditions.push(searchSql);
  }

  return conditions;
}

/**
 * SQL-filtered workspace users Work list page (typed columns + profile_json status).
 * Search/filter does not join contacts.
 */
export async function listTenantUsersPage(
  tenant: string,
  query: UsersListQuery & { includeDeleted?: boolean; afterId?: string; skipCount?: boolean },
): Promise<{
  rows: TenantUserRow[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}> {
  const subdomain = tenant.trim().toLowerCase();

  return withTenantRead(subdomain, async (tx) => {
    const result = await runListPage(tx, tenantUsers, {
      conditions: buildListConditions(subdomain, query),
      orderBy: buildOrderBy(query.sortField, query.sortDir),
      page: query.page,
      limit: query.limit,
      afterId: query.afterId,
      skipCount: query.skipCount,
      defaultPageSize: 50,
      columns: TENANT_USER_LIST_COLUMNS,
      rowMapper: (row) => rowToTenantUser(row as typeof tenantUsers.$inferSelect),
    });

    return {
      rows: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    };
  });
}

export async function countTenantUsersActive(tenant: string): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantUsers)
      .where(and(eq(tenantUsers.workspaceSubdomain, subdomain), isNull(tenantUsers.deletedAt)));
    return Number(rows[0]?.count ?? 0);
  });
}

/** SQL aggregates for Users command-centre metrics (active rows only). */
export async function aggregateUsersCommandMetrics(
  tenant: string,
  _periodDays: number = MODULE_METRICS_DEFAULT_PERIOD_DAYS,
): Promise<UsersCommandMetricsSnapshot> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) FILTER (WHERE ${statusExpr()} = 'active')::int`,
        suspended: sql<number>`count(*) FILTER (WHERE ${statusExpr()} = 'suspended')::int`,
        admins: sql<number>`count(*) FILTER (WHERE lower(${tenantUsers.role}) = 'admin')::int`,
        twoFaEnabled: sql<number>`count(*) FILTER (WHERE COALESCE((${tenantUsers.profileJson}->>'twoFactorEnabled')::boolean, false))::int`,
        activeSessions: sql<number>`COALESCE(sum(COALESCE((${tenantUsers.profileJson}->>'activeSessions')::int, 0)), 0)::int`,
      })
      .from(tenantUsers)
      .where(and(eq(tenantUsers.workspaceSubdomain, subdomain), isNull(tenantUsers.deletedAt)));

    const row = rows[0];
    return {
      total: Number(row?.total ?? 0),
      active: Number(row?.active ?? 0),
      suspended: Number(row?.suspended ?? 0),
      admins: Number(row?.admins ?? 0),
      twoFaEnabled: Number(row?.twoFaEnabled ?? 0),
      activeSessions: Number(row?.activeSessions ?? 0),
    };
  });
}
