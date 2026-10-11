import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { WidgetAggregateResult, WidgetQuery } from "@mms/shared";
import { attendance } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

function activeWorkspaceWhere(subdomain: string): SQL {
  return and(eq(attendance.workspaceSubdomain, subdomain), isNull(attendance.deletedAt))!;
}

const FIELD_TO_SQL_COLUMN: Record<string, string> = {
  status: "status",
  classId: "class_id",
  studentId: "student_id",
  date: "date",
};

function resolveSqlColumn(field: string): SQL {
  const col = FIELD_TO_SQL_COLUMN[field] ?? "status";
  return sql.raw(`"attendance"."${col}"`);
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
    return sql`lower(trim(${colSql}::text)) = ${value.trim().toLowerCase()}`;
  }
  if (op === "contains") {
    return sql`lower(${colSql}::text) LIKE ${`%${value.trim().toLowerCase()}%`}`;
  }
  if (op === "gt") {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return sql`${colSql}::numeric > ${num}`;
  }
  if (op === "lt") {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return sql`${colSql}::numeric < ${num}`;
  }
  return null;
}

function widgetFilterSql(query: WidgetQuery): SQL | null {
  return singleFilterSql(query.filterField, query.filterOperator, query.filterValue);
}

export async function aggregateAttendanceWidgetQueries(
  tenant: string,
  queries: WidgetQuery[],
): Promise<Record<string, WidgetAggregateResult>> {
  const subdomain = tenant.trim().toLowerCase();
  const results: Record<string, WidgetAggregateResult> = {};
  if (queries.length === 0) return results;

  return withTenantRead(subdomain, async (tx) => {
    const totalRows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(attendance)
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
          // A no-filter widget's whereClause equals activeWorkspaceWhere, so its
          // count is exactly totalCount (already computed above) — reuse it
          // instead of re-running an identical aggregate.
          const filteredCount = filterSql
            ? Number(
                (
                  await tx
                    .select({ count: sql<number>`count(*)::int` })
                    .from(attendance)
                    .where(whereClause)
                )[0]?.count ?? 0,
              )
            : totalCount;
          value =
            query.operation === "percentage"
              ? totalCount > 0
                ? Math.round((filteredCount / totalCount) * 100)
                : 0
              : filteredCount;
        }

        const xAxis = query.xAxisField?.trim() || "status";
        const xAxisColSql = resolveSqlColumn(xAxis);
        const groupExpr = sql<string>`COALESCE(NULLIF(trim(${xAxisColSql}::text), ''), 'Unknown')`;

        const chartRows = await tx
          .select({
            name: groupExpr,
            value: sql<number>`count(*)::int`,
          })
          .from(attendance)
          .where(whereClause)
          .groupBy(groupExpr)
          .orderBy(sql`count(*) desc`)
          .limit(chartLimit);

        const chartData = chartRows.map((row) => ({
          name: row.name,
          value: Number(row.value ?? 0),
        }));

        return { id: query.id, result: { value, totalCount, chartData } };
      }),
    );

    for (const { id, result } of queryResults) {
      results[id] = result;
    }

    return results;
  });
}
