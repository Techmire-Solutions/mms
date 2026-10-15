import * as React from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

export interface TableSkeletonProps {
  /** Number of columns — must match the real table to reserve identical geometry. Defaults to 5. */
  columns?: number;
  /** Backwards-compatible alias for columns. */
  cols?: number;
  /** Number of placeholder rows to render. Defaults to 5. */
  rows?: number;
  /** Optional widths (px) per column, in the same order as the real table. */
  columnWidths?: number[];
  className?: string;
}

/**
 * Layout-preserving skeleton loader for tables.
 *
 * Renders a `<table>` with invisible header cells and shimmer body rows whose
 * geometry exactly matches the column count (and optional widths) of the real
 * table. This eliminates Cumulative Layout Shift (CLS) when real data arrives.
 *
 * @example
 * {isLoading ? <TableSkeleton columns={5} rows={8} /> : <MyTable data={data} />}
 */
export function TableSkeleton({
  columns,
  cols,
  rows = 5,
  columnWidths,
  className,
}: TableSkeletonProps): React.JSX.Element {
  const { t } = useTranslation();
  const resolvedCols = columns ?? cols ?? 5;
  const colIndices = Array.from({ length: resolvedCols }, (_, i) => i);
  return (
    <div
      role="status"
      aria-label={t("common.loading")}
      className={cn("relative w-full max-w-full overflow-x-auto", className)}
    >
      <table
        role="table"
        className="w-full caption-bottom text-sm table-fixed"
        aria-busy="true"
        aria-hidden="true"
      >
        {/* Invisible header row reserves column widths — aria-hidden so it is skipped by screen readers */}
        <thead aria-hidden="true">
          <tr role="row">
            {colIndices.map((i) => (
              <th
                key={i}
                scope="col"
                role="columnheader"
                aria-hidden="true"
                style={columnWidths?.[i] != null ? { width: columnWidths[i] } : undefined}
                className="h-10 px-2"
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, rowIdx) => (
            <tr key={rowIdx} role="row" className="border-b">
              {colIndices.map((colIdx) => (
                <td key={colIdx} role="cell" aria-hidden="true" className="p-2">
                  <div
                    className={cn(
                      "h-4 rounded-md bg-muted animate-pulse",
                      colIdx === 0 ? "w-3/4" : colIdx === resolvedCols - 1 ? "w-1/2" : "w-full",
                    )}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <span className="sr-only">{t("common.loading")}</span>
    </div>
  );
}
