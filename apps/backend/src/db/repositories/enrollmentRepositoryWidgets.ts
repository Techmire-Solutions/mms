import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { EnrollmentsWidgetAggregateResult, EnrollmentsWidgetQuery } from "@mms/shared";
import { enrollments } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { HttpDomainError } from "../../lib/httpErrors.js";

/** Columns whose values are canonical lowercase ids/statuses: equality can use the index. */
const EXACT_INDEXED_FIELDS = new Set([
  "status",
  "paymentStatus",
  "sessionId",
  "classId",
  "studentId",
  "invoiceId",
]);
/** Numeric/date columns usable with gt/lt. */
const RANGE_FIELDS = new Set(["baseFee", "discountPct", "discountAmt", "finalFee", "enrolledDate"]);
const DATE_FIELDS = new Set(["enrolledDate"]);

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function activeWorkspaceWhere(subdomain: string): SQL {
  return and(eq(enrollments.workspaceSubdomain, subdomain), isNull(enrollments.deletedAt))!;
}

const FIELD_TO_SQL_COLUMN: Record<string, string> = {
  studentName: "student_name",
  studentId: "student_id",
  sessionName: "session_name",
  sessionId: "session_id",
  className: "class_name",
  classId: "class_id",
  status: "status",
  paymentStatus: "payment_status",
  enrolledDate: "enrolled_on",
  baseFee: "base_fee",
  discountType: "discount_type",
  discountLabel: "discount_label",
  discountPct: "discount_pct",
  discountAmt: "discount_amt",
  finalFee: "final_fee",
  invoiceId: "invoice_id",
  notes: "notes",
};

function resolveSqlColumn(field: string): SQL {
  const col = FIELD_TO_SQL_COLUMN[field];
  if (!col) {
    throw new HttpDomainError(400, "invalid_widget_field", `Unknown widget field "${field}"`);
  }
  return sql.raw(`"enrollments"."${col}"`);
}

function singleFilterSql(
  field: string | undefined,
  operator: EnrollmentsWidgetQuery["filterOperator"],
  value: string | undefined,
): SQL | null {
  const trimmedField = field?.trim();
  if (!trimmedField || value == null || value === "") return null;
  const colSql = resolveSqlColumn(trimmedField);
  const op = operator ?? "equals";
  if (op === "equals") {
    // Canonical id/status columns use the plain equality so (workspace, status/session/class)
    // indexes remain usable; free-text names keep a case-insensitive comparison.
    if (EXACT_INDEXED_FIELDS.has(trimmedField)) {
      const normalized = DATE_FIELDS.has(trimmedField) ? value.trim() : value.trim().toLowerCase();
      return sql`${colSql} = ${normalized}`;
    }
    if (DATE_FIELDS.has(trimmedField)) {
      return sql`${colSql}::date = ${value.trim()}::date`;
    }
    return sql`lower(btrim(${colSql}::text)) = ${value.trim().toLowerCase()}`;
  }
  if (op === "contains") {
    const pattern = `%${escapeLikePattern(value.trim().toLowerCase())}%`;
    return sql`lower(${colSql}::text) LIKE ${pattern}`;
  }
  if (op === "startsWith") {
    const pattern = `${escapeLikePattern(value.trim().toLowerCase())}%`;
    return sql`lower(${colSql}::text) LIKE ${pattern}`;
  }
  if (op === "gt" || op === "lt") {
    if (!RANGE_FIELDS.has(trimmedField)) {
      throw new HttpDomainError(
        400,
        "invalid_widget_operator",
        `Operator "${op}" is not supported for "${trimmedField}"`,
      );
    }
    if (DATE_FIELDS.has(trimmedField)) {
      return op === "gt"
        ? sql`${colSql}::date > ${value.trim()}::date`
        : sql`${colSql}::date < ${value.trim()}::date`;
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
      throw new HttpDomainError(400, "invalid_widget_value", `"${value}" is not a number`);
    }
    return op === "gt" ? sql`${colSql}::numeric > ${num}` : sql`${colSql}::numeric < ${num}`;
  }
  return null;
}

function widgetFilterSql(query: EnrollmentsWidgetQuery): SQL | null {
  const conditions = [
    singleFilterSql(query.filterField, query.filterOperator, query.filterValue),
    ...(query.filters ?? []).map((filter) =>
      singleFilterSql(filter.field, filter.operator, filter.value),
    ),
  ].filter((condition): condition is SQL => condition !== null);
  if (conditions.length === 0) return null;
  return and(...conditions) ?? null;
}

/** SQL widget aggregates for enrollments (Sessions/Teachers parity — no full-collection dump). */
export async function aggregateEnrollmentsWidgetQueries(
  tenant: string,
  queries: EnrollmentsWidgetQuery[],
): Promise<Record<string, EnrollmentsWidgetAggregateResult>> {
  const subdomain = tenant.trim().toLowerCase();
  const results: Record<string, EnrollmentsWidgetAggregateResult> = {};
  if (queries.length === 0) return results;

  return withTenantRead(subdomain, async (tx) => {
    // The workspace total is only needed to turn a filtered count into a percentage.
    const needsTotal = queries.some((query) => query.operation === "percentage");
    const totalCount = needsTotal
      ? Number(
          (
            await tx
              .select({ count: sql<number>`count(*)::int` })
              .from(enrollments)
              .where(activeWorkspaceWhere(subdomain))
          )[0]?.count ?? 0,
        )
      : 0;

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
            .from(enrollments)
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
              .from(enrollments)
              .where(whereClause);
            const sum = Number(aggRows[0]?.sum ?? 0);
            const count = Number(aggRows[0]?.count ?? 0);
            value = query.operation === "sum" ? sum : count > 0 ? Math.round(sum / count) : 0;
          }
        }

        const xAxis = query.xAxisField?.trim() || "status";
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
          const numericChart = await tx
            .select({
              name: groupExpr,
              sum: sql<number>`coalesce(sum(${targetColSql}::numeric), 0)`,
              count: sql<number>`count(*) FILTER (WHERE ${targetColSql} IS NOT NULL)::int`,
            })
            .from(enrollments)
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
            .from(enrollments)
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
