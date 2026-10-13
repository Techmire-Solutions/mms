import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ResizableTableHead } from "@/components/app/ResizableTableHead";
import type { TableCellAlign, TableCellVariant } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Canonical Work-table header cell chrome — SSOT for header typography/padding across module tables. */
export const MODULE_TABLE_HEAD_CLASS =
  "px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide";

export interface ModuleTableHeaderCellProps {
  columnKey: string;
  width?: number;
  onResize?: (columnKey: string, width: number) => void;
  className?: string;
  children: React.ReactNode;
  /** Sort key this column maps to. When provided, the cell renders sortable chrome (chevron + aria-sort). */
  sortKey?: string | null;
  /** Currently active sort field. */
  activeSortField?: string | null;
  sortDir?: "asc" | "desc";
  onSort?: (field: string) => void;
  noWrap?: boolean;
  truncate?: boolean;
  align?: TableCellAlign;
  variant?: TableCellVariant;
}

export const ModuleTableHeaderCell = function ModuleTableHeaderCell({
  columnKey,
  width,
  onResize,
  className,
  children,
  sortKey,
  activeSortField,
  sortDir = "asc",
  onSort,
  noWrap,
  truncate,
  align,
  variant,
}: ModuleTableHeaderCellProps): React.JSX.Element {
  const sortable = Boolean(sortKey);
  const isSorted = sortable && activeSortField === sortKey;
  const ariaSort = isSorted ? (sortDir === "asc" ? "ascending" : "descending") : "none";
  const isEnd =
    align === "end" || align === "right" || variant === "number" || variant === "currency";
  const isCenter = align === "center" || variant === "badge" || variant === "action";

  return (
    <ResizableTableHead
      columnKey={columnKey}
      width={width}
      onResize={onResize}
      aria-sort={ariaSort}
      noWrap={noWrap}
      truncate={truncate}
      align={align}
      variant={variant}
      className={cn(MODULE_TABLE_HEAD_CLASS, className)}
    >
      {sortable && onSort ? (
        <button
          type="button"
          onClick={() => onSort(sortKey as string)}
          className={cn(
            "flex w-full items-center gap-1 cursor-pointer select-none hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
            isEnd
              ? "justify-end text-end"
              : isCenter
                ? "justify-center text-center"
                : "justify-start text-start",
          )}
        >
          {children}
          {isSorted ? (
            sortDir === "asc" ? (
              <ChevronUp className="w-3 h-3 text-primary" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3 h-3 text-primary" aria-hidden="true" />
            )
          ) : (
            <ChevronUp className="w-3 h-3 opacity-20" aria-hidden="true" />
          )}
        </button>
      ) : (
        children
      )}
    </ResizableTableHead>
  );
};
