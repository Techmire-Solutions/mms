import { and, getTableColumns, sql, type SQL } from "drizzle-orm";
import type { AnyPgTable, SelectedFields } from "drizzle-orm/pg-core";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../schema.js";

type AppDb = NodePgDatabase<typeof schema>;

export interface RunListPageOptions<Row, Record> {
  /** WHERE conditions (tenant eq + soft-delete + search + module filters). */
  conditions: SQL[];
  /** ORDER BY expression. */
  orderBy: SQL;
  page?: number;
  limit?: number;
  /** Fallback page size when `limit` is omitted. */
  defaultPageSize?: number;
  /** Explicit column projection to eliminate SELECT * wildcard fetches. */
  columns?: SelectedFields;
  /** Maps a raw Drizzle row to the public record shape (e.g. merge `customData`). */
  rowMapper: (row: Row) => Record;
  /** Keyset cursor: fetch items strictly after this ID (enables O(1) indexed page traversal). */
  afterId?: string;
  /** Skip count(*) query when total count is not needed (e.g. streaming export chunking). */
  skipCount?: boolean;
}

export interface ListPageResult<Record> {
  items: Record[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Shared SQL list-page body: clamp page/limit, `count(*)` + `LIMIT/OFFSET` over
 * the same WHERE, then map rows. Extracted from `financeRepositoryList` /
 * `accountingRepositoryList` so new modules don't copy the 6-step skeleton.
 * Runs inside the caller's `withTenant` (RLS SET LOCAL).
 */
export async function runListPage<Row, Record>(
  tx: AppDb,
  table: AnyPgTable,
  options: RunListPageOptions<Row, Record>,
): Promise<ListPageResult<Record>> {
  const rawPage =
    typeof options.page === "number" && Number.isFinite(options.page) ? options.page : 1;
  const page = Math.max(1, Math.floor(rawPage));
  const rawLimit =
    typeof options.limit === "number" && Number.isFinite(options.limit)
      ? options.limit
      : (options.defaultPageSize ?? 50);
  const limit = Math.min(Math.max(1, Math.floor(rawLimit)), 100);
  const isCursorPaging = Boolean(options.afterId?.trim());
  const offset = isCursorPaging ? 0 : (page - 1) * limit;

  const baseWhereClause = and(...options.conditions);
  const conditions = [...options.conditions];
  if (isCursorPaging) {
    // Keyset pagination: filter id > afterId strictly using the primary key index.
    conditions.push(sql`${getTableColumns(table).id} > ${options.afterId!.trim()}`);
  }
  const whereClause = and(...conditions);

  let total = 0;
  if (!options.skipCount) {
    // Count over base conditions so total reflects whole matching dataset, not only rows after cursor
    const countRows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(table)
      .where(baseWhereClause);
    total = Number(countRows[0]?.count ?? 0);
  }

  // When keyset paging on `id > afterId`, ordering must be `id ASC` to preserve index scan consistency
  const effectiveOrderBy = isCursorPaging ? sql`${getTableColumns(table).id} asc` : options.orderBy;

  // Never fall back to a bare `tx.select()` (SELECT *) wildcard. Project an
  // explicit column object — a caller-supplied projection when provided,
  // otherwise every table column enumerated via getTableColumns — so the SQL
  // always lists columns explicitly and omits nothing the row mapper expects.
  const projection: SelectedFields = options.columns ?? getTableColumns(table);
  const baseQuery = tx.select(projection);
  const rows = await baseQuery
    .from(table)
    .where(whereClause)
    .orderBy(effectiveOrderBy)
    .limit(limit)
    .offset(offset);

  const items = (rows as Row[]).map(options.rowMapper);
  const hasMore =
    isCursorPaging || options.skipCount ? items.length === limit : page * limit < total;
  const lastItem = items[items.length - 1] as { id?: unknown } | undefined;
  const nextCursor = isCursorPaging && hasMore && lastItem?.id ? String(lastItem.id) : undefined;

  return {
    items,
    total,
    page,
    limit,
    hasMore,
    ...(nextCursor ? { nextCursor } : {}),
  };
}

/** Merges a row's `customData` JSONB onto the row (the generic-repo record shape). */
export function mergeCustomData<Row extends { customData?: unknown }>(row: Row): Row {
  return { ...row, ...((row.customData as Record<string, unknown> | null) ?? {}) } as Row;
}
