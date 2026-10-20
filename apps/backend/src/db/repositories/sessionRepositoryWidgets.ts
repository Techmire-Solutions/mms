import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { SessionsWidgetAggregateResult, SessionsWidgetQuery } from "@mms/shared";
import { sessions } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { sessionTypeSql } from "./academicCatalogNameSql.js";

function activeWorkspaceWhere(subdomain: string): SQL {
  return and(eq(sessions.workspaceSubdomain, subdomain), isNull(sessions.deletedAt))!;
}

function resolveSessionColumnSql(field: string): SQL {
  switch (field) {
    case "name":
      return sql`${sessions.name}`;
    case "type":
      return sql`${sessionTypeSql}`;
    case "status":
      return sql`${sessions.status}`;
    case "startDate":
      return sql`${sessions.startDate}::text`;
    case "endDate":
      return sql`${sessions.endDate}::text`;
    case "baseFee":
      return sql`${sessions.baseFee}`;
    case "currency":
      return sql`${sessions.currency}`;
    case "description":
      return sql`${sessions.description}`;
    default:
      return sql`${sessions.status}`;
  }
}

function singleFilterSql(
  field: string | undefined,
  operator: SessionsWidgetQuery["filterOperator"],
  value: string | undefined,
): SQL | null {
  const trimmedField = field?.trim();
  if (!trimmedField || value == null || value === "") return null;
  const colSql = resolveSessionColumnSql(trimmedField);
  const op = operator ?? "equals";
  if (op === "equals") {
    return sql`lower(trim(COALESCE(${colSql}, ''))) = ${value.trim().toLowerCase()}`;
  }
  if (op === "contains") {
    return sql`lower(COALESCE(${colSql}, '')) LIKE ${`%${value.trim().toLowerCase()}%`}`;
  }
  if (op === "gt") {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return sql`NULLIF(${colSql}, '')::numeric > ${num}`;
  }
  if (op === "lt") {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return sql`NULLIF(${colSql}, '')::numeric < ${num}`;
  }
  return null;
}

function widgetFilterSql(query: SessionsWidgetQuery): SQL | null {
  return singleFilterSql(query.filterField, query.filterOperator, query.filterValue);
}

/** SQL widget aggregates for sessions (parses typed columns). */
export async function aggregateSessionsWidgetQueries(
  tenant: string,
  queries: SessionsWidgetQuery[],
): Promise<Record<string, SessionsWidgetAggregateResult>> {
  const subdomain = tenant.trim().toLowerCase();
  const results: Record<string, SessionsWidgetAggregateResult> = {};
  if (queries.length === 0) return results;

  return withTenantRead(subdomain, async (tx) => {
    const totalRows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(sessions)
      .where(activeWorkspaceWhere(subdomain));
    const totalCount = Number(totalRows[0]?.count ?? 0);

    const queryResults = await Promise.all(
      queries.map(async (query) => {
        const filterSql = widgetFilterSql(query);
        const whereClause = filterSql
          ? and(activeWorkspaceWhere(subdomain), filterSql)
          : activeWorkspaceWhere(subdomain);
        const chartLimit = 8;

        let value = 0;
        if (query.operation === "count" || query.operation === "percentage") {
          const countRows = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(sessions)
            .where(whereClause);
          const filteredCount = Number(countRows[0]?.count ?? 0);
          value =
            query.operation === "percentage"
              ? totalCount > 0
                ? Math.round((filteredCount / totalCount) * 100)
                : 0
              : filteredCount;
        } else if (query.operation === "sum" || query.operation === "avg") {
          const target = query.targetField?.trim() || "";
          if (target) {
            const colSql = resolveSessionColumnSql(target);
            const aggRows = await tx
              .select({
                sum: sql<number>`coalesce(sum(NULLIF(${colSql}, '')::numeric), 0)`,
                count: sql<number>`count(*) FILTER (WHERE NULLIF(${colSql}, '') IS NOT NULL)::int`,
              })
              .from(sessions)
              .where(whereClause);
            const sum = Number(aggRows[0]?.sum ?? 0);
            const count = Number(aggRows[0]?.count ?? 0);
            value = query.operation === "sum" ? sum : count > 0 ? Math.round(sum / count) : 0;
          }
        }

        const xAxis = query.xAxisField?.trim() || "status";
        const colSql = resolveSessionColumnSql(xAxis);
        const groupExpr = sql<string>`COALESCE(NULLIF(trim(${colSql}), ''), 'Unknown')`;

        // For sum/avg with a target the count-based chart is discarded by the
        // numeric chart, so only run the count chart for the other operations.
        const target =
          query.operation === "sum" || query.operation === "avg"
            ? query.targetField?.trim() || ""
            : "";

        let chartData: { name: string; value: number }[];
        if (target) {
          const targetColSql = resolveSessionColumnSql(target);
          const numericChart = await tx
            .select({
              name: groupExpr,
              sum: sql<number>`coalesce(sum(NULLIF(${targetColSql}, '')::numeric), 0)`,
              count: sql<number>`count(*) FILTER (WHERE NULLIF(${targetColSql}, '') IS NOT NULL)::int`,
            })
            .from(sessions)
            .where(whereClause)
            .groupBy(groupExpr)
            .limit(chartLimit);
          chartData = numericChart
            .map((row) => {
              const sum = Number(row.sum ?? 0);
              const count = Number(row.count ?? 0);
              return {
                name: row.name,
                value: query.operation === "sum" ? sum : count > 0 ? Math.round(sum / count) : 0,
              };
            })
            .sort((a, b) => b.value - a.value)
            .slice(0, chartLimit);
        } else {
          const chartRows = await tx
            .select({
              name: groupExpr,
              value: sql<number>`count(*)::int`,
            })
            .from(sessions)
            .where(whereClause)
            .groupBy(groupExpr)
            .orderBy(sql`count(*) desc`)
            .limit(chartLimit);
          chartData = chartRows.map((row) => ({
            name: row.name,
            value: Number(row.value ?? 0),
          }));
        }

        return { id: query.id, result: { value, totalCount, chartData } };
      }),
    );

    for (const { id, result } of queryResults) {
      results[id] = result;
    }

    return results;
  });
}
