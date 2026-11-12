import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { WidgetAggregateResult, WidgetQuery } from "@mms/shared";
import { questionCategories, questions } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { HttpDomainError } from "../../lib/httpErrors.js";

function activeWorkspaceWhere(subdomain: string): SQL {
  return and(eq(questions.workspaceSubdomain, subdomain), isNull(questions.deletedAt))!;
}

import { chartExpression, targetExpression, widgetFilterSql } from "./questionBankWidgetFields.js";

/**
 * One scalar value per widget, expressed as a conditional aggregate so every widget's number comes
 * back from a single round trip. The chart query stays per widget: each has its own GROUP BY and
 * LIMIT cardinality, so it cannot share a result set.
 */
function widgetValueSql(query: WidgetQuery): SQL<number> {
  const predicate = widgetFilterSql(query) ?? sql`true`;
  switch (query.operation) {
    case "count":
    case "percentage":
      return sql<number>`count(*) FILTER (WHERE ${predicate})::int`;
    case "sum":
    case "avg": {
      const target = targetExpression(query.targetField);
      const filteredSum = sql`coalesce(sum(${target}::numeric) FILTER (WHERE ${predicate}), 0)`;
      if (query.operation === "sum") return sql<number>`${filteredSum}`;
      return sql<number>`case when count(*) FILTER (WHERE ${predicate} and ${target} is not null) = 0
        then 0
        else round(${filteredSum} / count(*) FILTER (WHERE ${predicate} and ${target} is not null))
      end`;
    }
    default:
      return sql<number>`0`;
  }
}

export async function aggregateQuestionBankWidgetQueries(
  tenant: string,
  queries: WidgetQuery[],
): Promise<Record<string, WidgetAggregateResult>> {
  const subdomain = tenant.trim().toLowerCase();
  const results: Record<string, WidgetAggregateResult> = {};
  if (queries.length === 0) return results;

  return withTenantRead(subdomain, async (tx) => {
    const totalRows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(questions)
      .where(activeWorkspaceWhere(subdomain));
    const totalCount = Number(totalRows[0]?.count ?? 0);

    // 2N+1 queries → N+2: the scalar values share one conditional-aggregate SELECT.
    const valueColumns = queries.map((query) => widgetValueSql(query));
    const [valueRow] = await tx
      .select(
        Object.fromEntries(
          valueColumns.map((expression, index) => [`v${index}`, expression]),
        ) as Record<string, SQL<number>>,
      )
      .from(questions)
      .where(activeWorkspaceWhere(subdomain));

    const queryResults = await Promise.all(
      queries.map(async (query, index) => {
        const raw = Number((valueRow as Record<string, unknown> | undefined)?.[`v${index}`] ?? 0);
        const value =
          query.operation === "percentage"
            ? totalCount > 0
              ? Math.round((raw / totalCount) * 100)
              : 0
            : raw;

        const filterSql = widgetFilterSql(query);
        const whereClause = filterSql
          ? and(activeWorkspaceWhere(subdomain), filterSql)
          : activeWorkspaceWhere(subdomain);
        const chartLimit = Math.max(1, Math.min(query.chartLimit ?? 8, 50));
        const categoryAxis = (query.xAxisField?.trim() || "type") === "categoryId";
        if (categoryAxis && (query.operation === "sum" || query.operation === "avg")) {
          throw new HttpDomainError(
            400,
            "validation_error",
            "categoryId cannot be combined with sum/avg (a question can hold several categories)",
          );
        }
        const target =
          query.operation === "sum" || query.operation === "avg"
            ? targetExpression(query.targetField)
            : null;

        let chartData: { name: string; value: number }[];
        if (categoryAxis) {
          // Group through the junction table instead of a correlated subquery in GROUP BY: the
          // subquery would reference ungrouped `questions` columns (Postgres 42803).
          const chartRows = await tx
            .select({
              name: questionCategories.categoryId,
              value: sql<number>`count(*)::int`,
            })
            .from(questionCategories)
            .innerJoin(
              questions,
              and(
                eq(questionCategories.workspaceSubdomain, questions.workspaceSubdomain),
                eq(questionCategories.questionId, questions.id),
              ),
            )
            .where(and(activeWorkspaceWhere(subdomain), filterSql ?? sql`true`))
            .groupBy(questionCategories.categoryId)
            .orderBy(sql`count(*) desc`)
            .limit(chartLimit);
          chartData = chartRows.map((row) => ({
            name: row.name || "Uncategorized",
            value: Number(row.value ?? 0),
          }));
        } else if (target) {
          const groupExpr = chartExpression(query.xAxisField);
          const sortExpr =
            query.operation === "sum"
              ? sql`coalesce(sum(${target}::numeric), 0) desc`
              : sql`coalesce(sum(${target}::numeric), 0) / nullif(count(*) FILTER (WHERE ${target} IS NOT NULL), 0) desc`;
          const numericChart = await tx
            .select({
              name: groupExpr,
              sum: sql<number>`coalesce(sum(${target}::numeric), 0)`,
              count: sql<number>`count(*) FILTER (WHERE ${target} IS NOT NULL)::int`,
            })
            .from(questions)
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
          const groupExpr = chartExpression(query.xAxisField);
          const chartRows = await tx
            .select({
              name: groupExpr,
              value: sql<number>`count(*)::int`,
            })
            .from(questions)
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
