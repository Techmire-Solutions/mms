import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { WidgetAggregateResult, WidgetQuery } from "@mms/shared";
import { ValidationError } from "../../lib/httpErrors.js";
import { contacts } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

function activeWorkspaceWhere(subdomain: string): SQL {
  return and(eq(contacts.workspaceSubdomain, subdomain), isNull(contacts.deletedAt))!;
}

/**
 * Columns a contacts widget may filter, group or aggregate on.
 *
 * Explicit Drizzle references (never `sql.raw`): an unknown field is a client
 * error, not a silent fallback to `gender`, which used to return a plausible but
 * completely wrong KPI.
 */
const FIELD_TO_COLUMN: Record<string, SQL> = {
  gender: sql`${contacts.gender}`,
  isSyed: sql`${contacts.isSyed}`,
  whatsappStatus: sql`${contacts.whatsappStatus}`,
};

/** Fields a numeric aggregate (sum/avg) may target. Contacts has none today. */
const NUMERIC_FIELDS: ReadonlySet<string> = new Set();

function resolveColumn(field: string): SQL {
  const key = field.trim();
  const column = FIELD_TO_COLUMN[key];
  if (!column) {
    throw new ValidationError(`Unsupported contact widget field "${key}"`);
  }
  return column;
}

/** Rejects unsupported widget fields/operations before any SQL runs. */
function assertWidgetQueriesSupported(queries: readonly WidgetQuery[]): void {
  for (const query of queries) {
    if (query.filterField) resolveColumn(query.filterField);
    for (const filter of query.filters ?? []) resolveColumn(filter.field);
    if (query.xAxisField) resolveColumn(query.xAxisField);
    if (query.targetField) {
      resolveColumn(query.targetField);
      const target = query.targetField.trim();
      if ((query.operation === "sum" || query.operation === "avg") && !NUMERIC_FIELDS.has(target)) {
        throw new ValidationError(
          `Operation "${query.operation}" is not supported for contact field "${target}"`,
        );
      }
    }
  }
}

function singleFilterSql(
  field: string | undefined,
  operator: WidgetQuery["filterOperator"],
  value: string | undefined,
): SQL | null {
  const trimmedField = field?.trim();
  if (!trimmedField || value == null || value === "") return null;
  const colSql = resolveColumn(trimmedField);
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
  if (op === "startsWith") {
    return sql`lower(${colSql}::text) LIKE ${`${value.trim().toLowerCase()}%`}`;
  }
  if (op === "gt") {
    return sql`${colSql}::numeric > ${Number(value)}`;
  }
  if (op === "lt") {
    return sql`${colSql}::numeric < ${Number(value)}`;
  }
  return null;
}

/**
 * Primary filter plus every `filters[]` rule, AND-ed. The visualizer/multi-rule
 * widgets send `filters[]`; ignoring them returned tenant-wide numbers.
 */
function widgetFilterSql(query: WidgetQuery): SQL | null {
  const parts = [
    singleFilterSql(query.filterField, query.filterOperator, query.filterValue),
    ...(query.filters ?? []).map((filter) =>
      singleFilterSql(filter.field, filter.operator, filter.value),
    ),
  ].filter((part): part is SQL => part != null);
  if (parts.length === 0) return null;
  return and(...parts) ?? null;
}

export async function aggregateContactsWidgetQueries(
  tenant: string,
  queries: WidgetQuery[],
): Promise<Record<string, WidgetAggregateResult>> {
  const subdomain = tenant.trim().toLowerCase();
  const results: Record<string, WidgetAggregateResult> = {};
  if (queries.length === 0) return results;
  assertWidgetQueriesSupported(queries);

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
            const targetColSql = resolveColumn(target);
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
        const xAxisColSql = resolveColumn(xAxis);
        const groupExpr = sql<string>`COALESCE(NULLIF(trim(${xAxisColSql}::text), ''), 'Unknown')`;

        // For sum/avg with a target the count-based chart is discarded by the
        // numeric chart, so only run the count chart for the other operations.
        const target =
          query.operation === "sum" || query.operation === "avg"
            ? query.targetField?.trim() || ""
            : "";

        let chartData: { name: string; value: number }[];
        if (target) {
          const targetColSql = resolveColumn(target);
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
