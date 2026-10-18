import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

  return (
    <div
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
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
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
            className="h-8 w-8"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label={labels.previous}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label={labels.next}
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      </div>
    </div>
  );
}
