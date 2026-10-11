import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  dedupeTrimmedIds,
  isQueryFlagTrue,
  toSqlSearchPattern,
  type SessionsCommandMetricsSnapshot,
  type SessionsListPageResult,
  type SessionsListQuery,
} from "@mms/shared";
import { sessions } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { runListPage } from "./listPageHelper.js";
import { findSessionsSummaryByIds } from "./sessionRepository.js";

const SESSION_SORT_FIELDS = new Set([
  "name",
  "type",
  "status",
  "baseFee",
  "startDate",
  "endDate",
  "updatedAt",
]);

function buildSearchSql(search: string): SQL | null {
  const normalized = search.trim();
  if (!normalized) return null;
  const pattern = toSqlSearchPattern(normalized);
  return or(
    ilike(sessions.name, pattern),
    ilike(sessions.type, pattern),
    ilike(sessions.description, pattern),
  )!;
}

function buildOrderBy(
  sortField: string | undefined,
  sortDir: "asc" | "desc" | "" | undefined,
): SQL {
  const dir = sortDir === "desc" ? "desc" : "asc";
  const field = sortField?.trim();
  if (!field || !SESSION_SORT_FIELDS.has(field)) {
    return sql`${sessions.id} asc`;
  }
  if (field === "updatedAt") {
    return dir === "desc"
      ? sql`${sessions.updatedAt} desc nulls last`
      : sql`${sessions.updatedAt} asc nulls last`;
  }
  if (field === "name") {
    return dir === "desc" ? desc(sessions.name) : asc(sessions.name);
  }
  if (field === "status") {
    return dir === "desc" ? desc(sessions.status) : asc(sessions.status);
  }
  if (field === "type") {
    return dir === "desc" ? desc(sessions.type) : asc(sessions.type);
  }
  if (field === "baseFee") {
    return dir === "desc" ? desc(sessions.baseFee) : asc(sessions.baseFee);
  }
  if (field === "startDate") {
    return dir === "desc" ? desc(sessions.startDate) : asc(sessions.startDate);
  }
  if (field === "endDate") {
    return dir === "desc" ? desc(sessions.endDate) : asc(sessions.endDate);
  }
  return sql`${sessions.id} asc`;
}

function buildListConditions(subdomain: string, query: SessionsListQuery): SQL[] {
  const conditions: SQL[] = [eq(sessions.workspaceSubdomain, subdomain)];

  if (isQueryFlagTrue(query.includeDeleted)) {
    conditions.push(isNotNull(sessions.deletedAt));
  } else {
    conditions.push(isNull(sessions.deletedAt));
  }

  const rawStatuses = dedupeTrimmedIds(query.status);
  if (rawStatuses.length > 0) {
    const statuses = rawStatuses.map((status) => status.toLowerCase());
    conditions.push(inArray(sql`lower(${sessions.status})`, statuses));
  }

  const rawTypes = dedupeTrimmedIds(query.type);
  if (rawTypes.length > 0) {
    const types = rawTypes.map((type) => type.toLowerCase());
    conditions.push(inArray(sql`lower(${sessions.type})`, types));
  }

  const search = query.search?.trim();
  if (search) {
    const searchSql = buildSearchSql(search);
    if (searchSql) conditions.push(searchSql);
  }

  return conditions;
}

/**
 * SQL-filtered sessions Work list page (typed columns & relations).
 * includeDeleted → deleted-only (Work trash parity).
 */
export async function listSessionsPage(
  tenant: string,
  query: SessionsListQuery & { afterId?: string; skipCount?: boolean },
): Promise<SessionsListPageResult & { nextCursor?: string }> {
  const subdomain = tenant.trim().toLowerCase();

  return withTenantRead(subdomain, async (tx) => {
    const result = await runListPage(tx, sessions, {
      conditions: buildListConditions(subdomain, query),
      orderBy: buildOrderBy(query.sortField, query.sortDir),
      columns: { id: sessions.id },
      page: query.page,
      limit: query.limit,
      afterId: query.afterId,
      skipCount: query.skipCount,
      defaultPageSize: 12,
      rowMapper: (row) => row as typeof sessions.$inferSelect,
    });

    if (result.items.length === 0) {
      return {
        sessions: [],
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasMore: false,
      };
    }

    const ids = result.items.map((r) => r.id);
    const hydratedSessions = await findSessionsSummaryByIds(subdomain, ids);

    // Preserve order from pagination query
    const sessionMap = new Map(hydratedSessions.map((s) => [s.id, s]));
    const ordered: typeof hydratedSessions = [];
    for (let i = 0; i < ids.length; i++) {
      const s = sessionMap.get(ids[i]);
      if (s) ordered.push(s);
    }

    return {
      sessions: ordered,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    };
  });
}

export async function countSessionsActive(tenant: string): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(sessions)
      .where(and(eq(sessions.workspaceSubdomain, subdomain), isNull(sessions.deletedAt)));
    return Number(rows[0]?.count ?? 0);
  });
}

/** SQL aggregates for Sessions command-centre metrics (active rows only). */
export async function aggregateSessionsCommandMetrics(
  tenant: string,
): Promise<SessionsCommandMetricsSnapshot> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE lower(s.status) = 'active')::int AS active,
        COUNT(*) FILTER (WHERE lower(s.status) = 'upcoming')::int AS upcoming,
        COUNT(*) FILTER (WHERE lower(s.status) = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE lower(s.status) = 'cancelled')::int AS cancelled,
        COALESCE(SUM(cls.total_enrolled), 0)::int AS total_enrolled,
        COALESCE(SUM(cls.total_capacity), 0)::int AS total_capacity,
        COALESCE(SUM(cls.class_count), 0)::int AS total_classes,
        COUNT(*) FILTER (WHERE
          s.start_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          AND (s.start_date)::date >= (CURRENT_DATE - INTERVAL '6 days')
          AND (s.start_date)::date <= CURRENT_DATE
        )::int AS sessions_this_week,
        COUNT(*) FILTER (WHERE
          s.start_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          AND (s.start_date)::date >= (CURRENT_DATE - INTERVAL '13 days')
          AND (s.start_date)::date <= (CURRENT_DATE - INTERVAL '7 days')
        )::int AS sessions_last_week
      FROM sessions s
      LEFT JOIN LATERAL (
        SELECT
          SUM(c.enrolled)::int AS total_enrolled,
          SUM(c.capacity)::int AS total_capacity,
          COUNT(*)::int AS class_count
        FROM session_classes c
        WHERE c.workspace_subdomain = s.workspace_subdomain
          AND c.session_id = s.id
      ) cls ON true
      WHERE s.workspace_subdomain = ${subdomain}
        AND s.deleted_at IS NULL
    `);

    const rows = ((result as { rows?: Record<string, unknown>[] }).rows ??
      (Array.isArray(result) ? result : [])) as Record<string, unknown>[];
    const row = (Array.isArray(rows) ? rows[0] : {}) ?? {};

    const num = (k: string): number => Number(row[k] ?? 0) || 0;

    return {
      total: num("total"),
      active: num("active"),
      upcoming: num("upcoming"),
      completed: num("completed"),
      cancelled: num("cancelled"),
      totalEnrolled: num("total_enrolled"),
      totalCapacity: num("total_capacity"),
      totalClasses: num("total_classes"),
      sessionsThisWeek: num("sessions_this_week"),
      sessionsLastWeek: num("sessions_last_week"),
    };
  });
}

/**
 * Set typed `status` for active sessions in one UPDATE.
 * Returns { succeeded, failed }.
 */
export async function bulkUpdateSessionsStatusSql(
  workspaceSubdomain: string,
  ids: string[],
  status: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (!subdomain || uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const normalizedStatus = status.trim().toLowerCase() || "active";

  return withTenant(subdomain, async (tx) => {
    const updated = await tx
      .update(sessions)
      .set({
        status: normalizedStatus,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sessions.workspaceSubdomain, subdomain),
          inArray(sessions.id, uniqueIds),
          isNull(sessions.deletedAt),
        ),
      )
      .returning({ id: sessions.id });

    const succeeded = updated.length;
    const failed = Math.max(0, uniqueIds.length - succeeded);
    return { succeeded, failed };
  });
}
