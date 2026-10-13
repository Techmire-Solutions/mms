import React from "react";
import { ExportToolbar, type ExportColumn } from "@/components/ui/ExportToolbar";
import { ListPagination } from "@/components/ui/ListPagination";
import { cn } from "@/lib/utils";

import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/LoadingState";

export interface ReportDataGridContainerProps {
  children: React.ReactNode;
  title?: string;
  columns?: ExportColumn[];
  rows?: Record<string, unknown>[];
  data?: unknown[];
  headers?: string[];
  resolveRows?: () => Promise<Record<string, unknown>[]>;
  moduleId?: string;
  filename?: string;
  hideExport?: boolean;
  page?: number;
  total?: number;
  limit?: number;
  hasMore?: boolean;
  onPageChange?: (page: number) => void;
  i18nNamespace?: string;
  paginationVariant?: "range" | "summary";
  className?: string;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ComponentType<{ className?: string }> | null;
  isLoading?: boolean;
}

/**
 * Standardized data grid container for module reports.
 * Integrates ExportToolbar at the top, scrollable table content in the middle,
 * and ListPagination at the bottom.
 */
export const ReportDataGridContainer = function ReportDataGridContainer({
  children,
  title,
  columns,
  rows,
  data,
  headers,
  resolveRows,
  moduleId,
  filename,
  hideExport = false,
  page,
  total,
  limit = 50,
  hasMore = false,
  onPageChange,
  i18nNamespace = "common",
  paginationVariant = "range",
  className,
  empty = false,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  isLoading = false,
}: ReportDataGridContainerProps): React.JSX.Element {
  const showExport = !hideExport && Boolean(title && (columns || rows || data || resolveRows));
  const showPagination =
    typeof page === "number" &&
    typeof total === "number" &&
    typeof onPageChange === "function" &&
    total > 0;

  return (
    <div className={cn("space-y-3", className)}>
      {showExport && (
        <ExportToolbar
          title={title as string}
          columns={columns}
          rows={rows}
          data={data}
          headers={headers}
          resolveRows={resolveRows}
          moduleId={moduleId}
          filename={filename}
        />
      )}

      <div className="w-full overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={limit > 10 ? 10 : limit} />
          </div>
        ) : empty && emptyTitle ? (
          <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} compact />
        ) : (
          children
        )}
      </div>

      {showPagination && (
        <ListPagination
          page={page as number}
          total={total as number}
          limit={limit}
          hasMore={hasMore}
          onPageChange={onPageChange as (page: number) => void}
          i18nNamespace={i18nNamespace}
          variant={paginationVariant}
        />
      )}
    </div>
  );
};

export default ReportDataGridContainer;
