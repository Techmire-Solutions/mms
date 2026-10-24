import React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../button/Button";
import { useUiConfig } from "../theme/UiConfigContext";
import { cn } from "../utils";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize?: number;
  totalItems?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className,
}: PaginationProps): React.JSX.Element {
  const { labels } = useUiConfig();

  const paginationLabel = (labels as { pagination?: string }).pagination || "Pagination";

  return (
    <div
      role="navigation"
      aria-label={paginationLabel}
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 py-3 text-xs text-muted-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {totalItems !== undefined && (
          <span>
            {totalItems} {totalItems === 1 ? "item" : "items"}
          </span>
        )}
        {pageSize && onPageSizeChange && (
          <div className="flex items-center gap-1.5 ms-2">
            <span>{labels.rowsPerPage}:</span>
            <div className="relative inline-flex items-center">
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                aria-label={labels.rowsPerPage}
                className="min-h-11 rounded-md border border-input bg-background text-foreground ps-2 pe-7 text-xs focus:outline-none focus:ring-1 focus:ring-ring focus-visible:ring-2 focus-visible:ring-ring cursor-pointer appearance-none [&>option]:bg-popover [&>option]:text-popover-foreground"
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute end-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span>{labels.pageOf(currentPage, Math.max(1, totalPages))}</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 touch-target-coarse cursor-pointer"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label={labels.previous}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 touch-target-coarse cursor-pointer"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label={labels.next}
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
