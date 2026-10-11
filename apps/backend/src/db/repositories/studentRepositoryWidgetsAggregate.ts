import { and, eq, sql } from "drizzle-orm";
import type { StudentsWidgetAggregateResult, StudentsWidgetQuery } from "@mms/shared";
import { students, contacts } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import {
  activeWorkspaceWhere,
  resolveChartLimit,
  resolveStudentFieldExpr,
  widgetFilterSql,
  widgetNeedsContactsJoin,
} from "./studentRepositoryWidgetsSql.js";

/** SQL widget aggregates for students (Contacts parity). */
export async function aggregateStudentsWidgetQueries(
  tenant: string,
  queries: StudentsWidgetQuery[],
): Promise<Record<string, StudentsWidgetAggregateResult>> {
  const subdomain = tenant.trim().toLowerCase();
  const results: Record<string, StudentsWidgetAggregateResult> = {};
  if (queries.length === 0) return results;

  return withTenantRead(subdomain, async (tx) => {
    const totalRows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(students)
      .where(activeWorkspaceWhere(subdomain));
    const totalCount = Number(totalRows[0]?.count ?? 0);

    const contactsJoinOn = and(
      eq(contacts.workspaceSubdomain, students.workspaceSubdomain),
      eq(contacts.id, students.contactId),
    );

    const queryResults = await Promise.all(
      queries.map(async (query) => {
        const useJoined = widgetNeedsContactsJoin(query);
        const filterSql = widgetFilterSql(query, useJoined);
        const whereClause = filterSql
          ? and(activeWorkspaceWhere(subdomain), filterSql)
          : activeWorkspaceWhere(subdomain);
        const chartLimit = resolveChartLimit(query);

        let value = 0;
        if (query.operation === "count" || query.operation === "percentage") {
          const countRows = useJoined
            ? await tx
                .select({ count: sql<number>`count(*)::int` })
                .from(students)
                .leftJoin(contacts, contactsJoinOn)
                .where(whereClause)
            : await tx
                .select({ count: sql<number>`count(*)::int` })
                .from(students)
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
            const targetExpr = resolveStudentFieldExpr(target, useJoined);
            const aggFields = {
              sum: sql<number>`coalesce(sum(CASE WHEN ${targetExpr}::text ~ '^-?[0-9]+(\.[0-9]+)?$' THEN ${targetExpr}::text::numeric ELSE 0 END), 0)`,
              count: sql<number>`count(*) FILTER (WHERE ${targetExpr}::text ~ '^-?[0-9]+(\.[0-9]+)?$')::int`,
            };
            const aggRows = useJoined
              ? await tx
                  .select(aggFields)
                  .from(students)
                  .leftJoin(contacts, contactsJoinOn)
                  .where(whereClause)
              : await tx.select(aggFields).from(students).where(whereClause);
            const sum = Number(aggRows[0]?.sum ?? 0);
            const count = Number(aggRows[0]?.count ?? 0);
            value = query.operation === "sum" ? sum : count > 0 ? Math.round(sum / count) : 0;
          }
        }

        const xAxis = query.xAxisField?.trim() || "status";
        const xAxisExpr = resolveStudentFieldExpr(xAxis, useJoined);
        const groupExpr = sql<string>`COALESCE(NULLIF(trim(${xAxisExpr}::text), ''), 'Unknown')`;

        // For sum/avg with a target the count-based chart is discarded by the
        // numeric chart, so only run the count chart for the other operations.
        const target =
          query.operation === "sum" || query.operation === "avg"
            ? query.targetField?.trim() || ""
            : "";

        let chartData: { name: string; value: number }[];
        if (target) {
          const targetExpr = resolveStudentFieldExpr(target, useJoined);
          const chartFields = {
            name: groupExpr,
            sum: sql<number>`coalesce(sum(CASE WHEN ${targetExpr}::text ~ '^-?[0-9]+(\.[0-9]+)?$' THEN ${targetExpr}::text::numeric ELSE 0 END), 0)`,
            count: sql<number>`count(*) FILTER (WHERE ${targetExpr}::text ~ '^-?[0-9]+(\.[0-9]+)?$')::int`,
          };
          const numericChart = useJoined
            ? await tx
                .select(chartFields)
                .from(students)
                .leftJoin(contacts, contactsJoinOn)
                .where(whereClause)
                .groupBy(groupExpr)
                .limit(chartLimit)
            : await tx
                .select(chartFields)
                .from(students)
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
          const countChartFields = {
            name: groupExpr,
            value: sql<number>`count(*)::int`,
          };
          const chartRows = useJoined
            ? await tx
                .select(countChartFields)
                .from(students)
                .leftJoin(contacts, contactsJoinOn)
                .where(whereClause)
                .groupBy(groupExpr)
                .orderBy(sql`count(*) desc`)
                .limit(chartLimit)
            : await tx
                .select(countChartFields)
                .from(students)
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
