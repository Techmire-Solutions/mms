import { and, eq, gte, isNull, lte, sql, type SQL } from "drizzle-orm";
import type { WidgetAggregateResult, WidgetQuery } from "@mms/shared";
import { attendance } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

/**
 * Dashboard widget aggregates.
 *
 * The previous implementation scanned **all** live attendance for the tenant once per widget (up to
 * 32 widgets, run concurrently) and wrapped every filter/group in `lower(trim(col::text))`, which
 * made `attendance_workspace_status_idx` and the class/date indexes unusable. This version:
 *
 * - always applies a bounded day range (caller-supplied, else the last 30 days),
 * - compares indexed columns directly (status values are stored lowercase, so the *value* is
 *   normalised — never the column),
 * - groups by the raw column,
 * - runs at most `WIDGET_QUERY_CONCURRENCY` widgets at a time so one dashboard load cannot open 64
 *   table scans against the read pool.
 */

/** Widgets default to the last 30 days when the caller sends no range. */
export const WIDGET_DEFAULT_RANGE_DAYS = 30;
/** Hard ceiling on a widget range (a year of daily marks). */
export const WIDGET_MAX_RANGE_DAYS = 366;
/** Concurrent widget queries per request. */
export const WIDGET_QUERY_CONCURRENCY = 4;

const FILTERABLE_FIELDS = new Set(["status", "classId", "studentId", "date"]);

function isoDaysAgo(days: number, from = new Date()): string {
  return new Date(from.getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Inclusive range for a widget; clamped to `WIDGET_MAX_RANGE_DAYS`. */
export function resolveWidgetRange(query: WidgetQuery): { dateFrom: string; dateTo: string } {
  const dateTo = query.dateTo?.trim() || todayISO();
  const dateFrom = query.dateFrom?.trim() || isoDaysAgo(WIDGET_DEFAULT_RANGE_DAYS);
  const span =
    Math.round(
      (Date.parse(`${dateTo}T00:00:00Z`) - Date.parse(`${dateFrom}T00:00:00Z`)) / 86_400_000,
    ) + 1;
  if (!Number.isFinite(span) || span < 1) {
    return { dateFrom: isoDaysAgo(WIDGET_DEFAULT_RANGE_DAYS), dateTo: todayISO() };
  }
  if (span > WIDGET_MAX_RANGE_DAYS) {
    return {
      dateFrom: isoDaysAgo(WIDGET_MAX_RANGE_DAYS - 1, new Date(`${dateTo}T00:00:00Z`)),
      dateTo,
    };
  }
  return { dateFrom, dateTo };
}

function activeWorkspaceWhere(subdomain: string): SQL {
  return and(eq(attendance.workspaceSubdomain, subdomain), isNull(attendance.deletedAt))!;
}

function rangeWhere(range: { dateFrom: string; dateTo: string }): SQL {
  return and(gte(attendance.date, range.dateFrom), lte(attendance.date, range.dateTo))!;
}

/** Raw indexed column for a widget field; unknown fields fall back to `status`. */
function columnFor(field: string | undefined): { column: SQL; field: string } {
  const trimmed = field?.trim() ?? "";
  switch (trimmed) {
    case "classId":
      return { column: sql`${attendance.classId}`, field: "classId" };
    case "studentId":
      return { column: sql`${attendance.studentId}`, field: "studentId" };
    case "date":
      return { column: sql`${attendance.date}`, field: "date" };
    case "status":
    default:
      return { column: sql`${attendance.status}`, field: "status" };
  }
}

/**
 * One filter, expressed against the raw column so the index applies.
 *
 * `contains` cannot use a btree (inherent for `%…%`), and `gt`/`lt` are only meaningful for `date`
 * (an ISO day compares correctly as text); other numeric comparisons are ignored rather than
 * silently casting every row.
 */
function singleFilterSql(query: WidgetQuery): SQL | null {
  const field = query.filterField?.trim();
  const value = query.filterValue?.trim();
  if (!field || !FILTERABLE_FIELDS.has(field) || value == null || value === "") return null;
  const { column } = columnFor(field);
  const op = query.filterOperator ?? "equals";
  if (op === "equals") {
    // Values are normalised to what is stored (status is lowercase by constraint).
    const normalised = field === "status" ? value.toLowerCase() : value;
    return sql`${column} = ${normalised}`;
  }
  if (op === "contains") {
    const escaped = value.replace(/[%_\\]/g, (match) => `\\${match}`);
    return sql`${column} LIKE ${`%${escaped}%`}`;
  }
  if (field === "date" && (op === "gt" || op === "lt")) {
    return sql`${column} ${sql.raw(op === "gt" ? ">" : "<")} ${value}`;
  }
  return null;
}

function chartGroupExpr(field: string | undefined): SQL {
  const { column } = columnFor(field);
  return sql<string>`COALESCE(NULLIF(trim(${column}::text), ''), 'Unknown')`;
}

/**
 * Runs widget queries with bounded concurrency.
 *
 * Exported for tests; production enters via {@link aggregateAttendanceWidgetQueries}.
 */
export async function runWidgetQueries<T>(
  queries: readonly WidgetQuery[],
  runOne: (query: WidgetQuery, index: number) => Promise<T>,
  concurrency = WIDGET_QUERY_CONCURRENCY,
): Promise<T[]> {
  const results: T[] = new Array(queries.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, queries.length)) },
    async () => {
      for (;;) {
        const index = next;
        next += 1;
        if (index >= queries.length) return;
        results[index] = await runOne(queries[index]!, index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export async function aggregateAttendanceWidgetQueries(
  tenant: string,
  queries: WidgetQuery[],
): Promise<Record<string, WidgetAggregateResult>> {
  const subdomain = tenant.trim().toLowerCase();
  const results: Record<string, WidgetAggregateResult> = {};
  if (queries.length === 0) return results;

  return withTenantRead(subdomain, async (tx) => {
    const ranges = queries.map((query) => resolveWidgetRange(query));
    // The widest range is the one "all widgets" denominator; a no-filter widget counts within its
    // own range, which is what the widget actually displays.
    const totalCounts = new Map<string, number>();
    for (const range of ranges) {
      const key = `${range.dateFrom}|${range.dateTo}`;
      if (totalCounts.has(key)) continue;
      const [row] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(attendance)
        .where(and(activeWorkspaceWhere(subdomain), rangeWhere(range)));
      totalCounts.set(key, Number(row?.count ?? 0));
    }

    const computed = await runWidgetQueries(queries, async (query, index) => {
      const range = ranges[index]!;
      const filterSql = singleFilterSql(query);
      const whereClause = filterSql
        ? and(activeWorkspaceWhere(subdomain), rangeWhere(range), filterSql)!
        : and(activeWorkspaceWhere(subdomain), rangeWhere(range))!;
      const totalCount = totalCounts.get(`${range.dateFrom}|${range.dateTo}`) ?? 0;

      let value = 0;
      if (query.operation === "count" || query.operation === "percentage") {
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

      const chartLimit = Math.max(1, Math.min(query.chartLimit ?? 8, 50));
      const groupExpr = chartGroupExpr(query.xAxisField);
      const chartRows = await tx
        .select({ name: groupExpr, value: sql<number>`count(*)::int` })
        .from(attendance)
        .where(whereClause)
        .groupBy(groupExpr)
        .orderBy(sql`count(*) desc`)
        .limit(chartLimit);
      return {
        id: query.id,
        result: {
          value,
          totalCount,
          chartData: chartRows.map((row) => ({
            name: String(row.name ?? ""),
            value: Number(row.value ?? 0),
          })),
        },
      };
    });

    for (const { id, result } of computed) results[id] = result;
    return results;
  });
}
