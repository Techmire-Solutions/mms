import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { WidgetAggregateResult, WidgetQuery } from "@mms/shared";
import { contacts } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

function activeWorkspaceWhere(subdomain: string): SQL {
  return and(eq(contacts.workspaceSubdomain, subdomain), isNull(contacts.deletedAt))!;
}

const FIELD_TO_SQL_COLUMN: Record<string, string> = {
  gender: "gender",
  isSyed: "is_syed",
  whatsappStatus: "whatsapp_status",
};

function resolveSqlColumn(field: string): SQL {
  const col = FIELD_TO_SQL_COLUMN[field] ?? "gender";
  return sql.raw(`"contacts"."${col}"`);
}

function singleFilterSql(
  field: string | undefined,
  operator: WidgetQuery["filterOperator"],
  value: string | undefined,
): SQL | null {
  const trimmedField = field?.trim();
  if (!trimmedField || value == null || value === "") return null;
  const colSql = resolveSqlColumn(trimmedField);
  const op = operator ?? "equals";
  if (op === "equals") {
    if (value === "true" || value === "false") {
      return sql`${colSql}::boolean = ${value === "true"}`;
    }
    return sql`lower(trim(${colSql}::text)) = ${value.trim().toLowerCase()}`;
  }
  if (op === "contains") {
    return sql`lower(${colSql}::text) LIKE ${`%${value.trim().toLowerCase()}%`}`;
  }
  if (op === "gt") {
    return sql`${colSql}::numeric > ${Number(value)}`;
  }
  if (op === "lt") {
    return sql`${colSql}::numeric < ${Number(value)}`;
  }
  return null;
}

function widgetFilterSql(query: WidgetQuery): SQL | null {
  return singleFilterSql(query.filterField, query.filterOperator, query.filterValue);
}

export async function aggregateContactsWidgetQueries(
  tenant: string,
  queries: WidgetQuery[],
): Promise<Record<string, WidgetAggregateResult>> {
  const subdomain = tenant.trim().toLowerCase();
  const results: Record<string, WidgetAggregateResult> = {};
  if (queries.length === 0) return results;

  return withTenantRead(subdomain, async (tx) => {
    const totalRows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .where(activeWorkspaceWhere(subdomain));
    const totalCount = Number(totalRows[0]?.count ?? 0);

    const queryResults = await Promise.all(
      queries.map(async (query) => {
        const filterSql = widgetFilterSql(query);
        const whereClause = filterSql
          ? and(activeWorkspaceWhere(subdomain), filterSql)
          : activeWorkspaceWhere(subdomain);
        const chartLimit = Math.max(1, Math.min(query.chartLimit ?? 8, 50));

        let value = 0;
        if (query.operation === "count" || query.operation === "percentage") {
          const countRows = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(contacts)
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
            const targetColSql = resolveSqlColumn(target);
            const aggRows = await tx
              .select({
                sum: sql<number>`coalesce(sum(${targetColSql}::numeric), 0)`,
                count: sql<number>`count(*) FILTER (WHERE ${targetColSql} IS NOT NULL)::int`,
              })
              .from(contacts)
              .where(whereClause);
            const sum = Number(aggRows[0]?.sum ?? 0);
            const count = Number(aggRows[0]?.count ?? 0);
            value = query.operation === "sum" ? sum : count > 0 ? Math.round(sum / count) : 0;
          }
        }

        const xAxis = query.xAxisField?.trim() || "gender";
        const xAxisColSql = resolveSqlColumn(xAxis);
        const groupExpr = sql<string>`COALESCE(NULLIF(trim(${xAxisColSql}::text), ''), 'Unknown')`;

        // For sum/avg with a target the count-based chart is discarded by the
        // numeric chart, so only run the count chart for the other operations.
        const target =
          query.operation === "sum" || query.operation === "avg"
            ? query.targetField?.trim() || ""
            : "";

        let chartData: { name: string; value: number }[];
        if (target) {
          const targetColSql = resolveSqlColumn(target);
          const sortExpr =
            query.operation === "sum"
              ? sql`coalesce(sum(${targetColSql}::numeric), 0) desc`
              : sql`coalesce(sum(${targetColSql}::numeric), 0) / nullif(count(*) FILTER (WHERE ${targetColSql} IS NOT NULL), 0) desc`;
          const numericChart = await tx
            .select({
              name: groupExpr,
              sum: sql<number>`coalesce(sum(${targetColSql}::numeric), 0)`,
              count: sql<number>`count(*) FILTER (WHERE ${targetColSql} IS NOT NULL)::int`,
            })
            .from(contacts)
            .where(whereClause)
            .groupBy(groupExpr)
            .orderBy(sortExpr)
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
            .from(contacts)
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
