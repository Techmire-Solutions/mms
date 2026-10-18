import { and, sql } from "drizzle-orm";
import type { FacultyWidgetAggregateResult, FacultyWidgetQuery } from "@mms/shared";
import { withTenantRead } from "../tenant-context.js";
import {
  activeWorkspaceWhere,
  resolveChartLimit,
  resolveFacultyFieldExpr,
  widgetFilterSql,
} from "./facultyRepositoryWidgetFilters.js";
import { facultyWithPrimaryAppointmentFromSql } from "./facultyPrimaryAppointmentSql.js";

/** SQL widget aggregates for faculty — LATERAL primary appointment for dept/desig grouping. */
export async function aggregateFacultyWidgetQueries(
  tenant: string,
  queries: FacultyWidgetQuery[],
): Promise<Record<string, FacultyWidgetAggregateResult>> {
  const subdomain = tenant.trim().toLowerCase();
  const results: Record<string, FacultyWidgetAggregateResult> = {};
  if (queries.length === 0) return results;

  return withTenantRead(subdomain, async (tx) => {
    const fromSql = facultyWithPrimaryAppointmentFromSql();
    const totalResult = await tx.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count
      ${fromSql}
      WHERE ${activeWorkspaceWhere(subdomain)}
    `);
    const totalCount = Number(totalResult.rows[0]?.count ?? 0);

    const queryResults = await Promise.all(
      queries.map(async (query) => {
        const filterSql = widgetFilterSql(query);
        const whereClause = filterSql
          ? and(activeWorkspaceWhere(subdomain), filterSql)
          : activeWorkspaceWhere(subdomain);
        const chartLimit = resolveChartLimit(query);

        let value = 0;
        if (query.operation === "count" || query.operation === "percentage") {
          const countResult = await tx.execute<{ count: number }>(sql`
            SELECT count(*)::int AS count
            ${fromSql}
            WHERE ${whereClause}
          `);
          const filteredCount = Number(countResult.rows[0]?.count ?? 0);
          value =
            query.operation === "percentage"
              ? totalCount > 0
                ? Math.round((filteredCount / totalCount) * 100)
                : 0
              : filteredCount;
        } else if (query.operation === "sum" || query.operation === "avg") {
          const target = query.targetField?.trim() || "";
          if (target) {
            const targetExpr = resolveFacultyFieldExpr(target);
            const aggResult = await tx.execute<{ sum: number; count: number }>(sql`
              SELECT
                coalesce(sum(NULLIF(trim(${targetExpr}::text), '')::numeric), 0) AS sum,
                count(*) FILTER (WHERE NULLIF(trim(${targetExpr}::text), '') IS NOT NULL)::int AS count
              ${fromSql}
              WHERE ${whereClause}
            `);
            const sum = Number(aggResult.rows[0]?.sum ?? 0);
            const count = Number(aggResult.rows[0]?.count ?? 0);
            value = query.operation === "sum" ? sum : count > 0 ? Math.round(sum / count) : 0;
          }
        }

        const xAxis = query.xAxisField?.trim() || "status";
        const xAxisExpr = resolveFacultyFieldExpr(xAxis);
        const groupExpr = sql`COALESCE(NULLIF(trim(${xAxisExpr}::text), ''), 'Unknown')`;

        const target =
          query.operation === "sum" || query.operation === "avg"
            ? query.targetField?.trim() || ""
            : "";

        let chartData: { name: string; value: number }[];
        if (target) {
          const targetExpr = resolveFacultyFieldExpr(target);
          const numericChart = await tx.execute<{ name: string; sum: number; count: number }>(sql`
            SELECT
              ${groupExpr} AS name,
              coalesce(sum(NULLIF(trim(${targetExpr}::text), '')::numeric), 0) AS sum,
              count(*) FILTER (WHERE NULLIF(trim(${targetExpr}::text), '') IS NOT NULL)::int AS count
            ${fromSql}
            WHERE ${whereClause}
            GROUP BY ${groupExpr}
            LIMIT ${chartLimit}
          `);
          chartData = numericChart.rows
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
          const chartRows = await tx.execute<{ name: string; value: number }>(sql`
            SELECT
              ${groupExpr} AS name,
              count(*)::int AS value
            ${fromSql}
            WHERE ${whereClause}
            GROUP BY ${groupExpr}
            ORDER BY count(*) DESC
            LIMIT ${chartLimit}
          `);
          chartData = chartRows.rows.map((row) => ({
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
