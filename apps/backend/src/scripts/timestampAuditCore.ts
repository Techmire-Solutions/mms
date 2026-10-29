/**
 * Pure summarizer for the naive-timestamp audit. Kept separate from the CLI so
 * ordering and totals are testable without a database.
 */
export interface NaiveTimestampColumn {
  table: string;
  column: string;
  nullable: boolean;
  /** `tenant` when the table carries `workspace_subdomain`, otherwise global. */
  scope: "tenant" | "global";
  /** `pg_class.reltuples` estimate, or null when PostgreSQL has no estimate. */
  estimatedRows: number | null;
}

export interface TimestampAuditSummary {
  totalColumns: number;
  totalTables: number;
  tenantColumns: number;
  globalColumns: number;
  columns: NaiveTimestampColumn[];
}

/** Newest/largest tables first; unknown estimates sort last, then by name. */
export function summarizeTimestampColumns(
  columns: readonly NaiveTimestampColumn[],
): TimestampAuditSummary {
  const sorted = [...columns].sort((a, b) => {
    const aRows = a.estimatedRows ?? -1;
    const bRows = b.estimatedRows ?? -1;
    if (aRows !== bRows) return bRows - aRows;
    return a.table.localeCompare(b.table) || a.column.localeCompare(b.column);
  });

  return {
    totalColumns: sorted.length,
    totalTables: new Set(sorted.map((column) => column.table)).size,
    tenantColumns: sorted.filter((column) => column.scope === "tenant").length,
    globalColumns: sorted.filter((column) => column.scope === "global").length,
    columns: sorted,
  };
}
