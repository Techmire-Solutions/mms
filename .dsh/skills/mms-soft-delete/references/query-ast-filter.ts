import { isNull, sql, type SQL, type Table } from 'drizzle-orm';
import type { PgColumn, PgTableWithColumns } from 'drizzle-orm/pg-core';

/**
 * Generates an active-record filter predicate (deleted_at IS NULL).
 * Enforces soft-delete invariant across joins, subqueries, and metric aggregations.
 */
export function withActiveRecords<T extends Table>(table: T): SQL {
  const column = (table as unknown as Record<string, PgColumn>).deletedAt;
  if (!column) {
    throw new Error(`Table ${(table as unknown as { _: { name: string } })._?.name || 'unknown'} lacks deletedAt column`);
  }
  return isNull(column);
}

/**
 * Injects soft-delete bypass predicate if session setting `app.include_deleted` is true.
 */
export function withSoftDeleteFilter<T extends Table>(table: T): SQL {
  const column = (table as unknown as Record<string, PgColumn>).deletedAt;
  if (!column) {
    throw new Error(`Table ${(table as unknown as { _: { name: string } })._?.name || 'unknown'} lacks deletedAt column`);
  }
  return sql`(${column} IS NULL OR current_setting('app.include_deleted', true) = 'true')`;
}
