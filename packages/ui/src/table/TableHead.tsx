import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "../utils";
import type { TableHeadProps, TableSortDirection } from "./tableTypes";
import { getAriaSort, getTableCellAlignClass, getTableCellWrapClass } from "./tableUtils";

export function TableHead({
  className,
  noWrap,
  truncate,
  align,
  variant,
  isFocusable,
  isSticky,
  tabIndex,
  sortable,
  sortKey,
  sortDirection,
  onSort,
  children,
  ref,
  ...props
}: TableHeadProps) {
  const isSortable = sortable || !!onSort;

  // Normalize boolean sortDirection to null/asc for backwards compatibility
  const normalizedSortDirection =
    sortDirection === true ? "asc" : sortDirection === false ? "none" : sortDirection;
  const ariaSort = getAriaSort(normalizedSortDirection);

  const wrapClass = getTableCellWrapClass(noWrap, truncate);
  const alignClass = getTableCellAlignClass(align, variant);
  const isRightAligned =
    align === "end" || align === "right" || variant === "number" || variant === "currency";

  // Tri-state cycle: asc -> desc -> null
  const nextDirection: TableSortDirection | null =
    normalizedSortDirection === "asc" ? "desc" : normalizedSortDirection === "desc" ? null : "asc";

  const handleClick = (e: React.MouseEvent) => {
    if (!isSortable) return;
    e.stopPropagation();
    if (onSort) {
      const sortCallback = onSort as (key: string, direction: "asc" | "desc" | null) => void;
      sortCallback(sortKey ?? "", nextDirection);
    }
  };

  const sortIcon =
    normalizedSortDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden="true" />
    ) : normalizedSortDirection === "desc" ? (
      <ArrowDown className="h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden="true" />
    ) : isSortable ? (
      <ArrowUpDown
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"
        aria-hidden="true"
      />
    ) : null;

  const screenReaderLabel = isSortable
    ? `Sort ${sortKey ?? "column"} ${nextDirection === "asc" ? "ascending" : nextDirection === "desc" ? "descending" : "to remove sort"}`
    : undefined;

  return (
    <th
      ref={ref}
      role="columnheader"
      scope="col"
      aria-sort={ariaSort}
      tabIndex={isFocusable ? (tabIndex ?? 0) : tabIndex}
      className={cn(
        "h-10 px-2 align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pe-0 [&>[role=checkbox]]:translate-y-0.5",
        wrapClass,
        alignClass,
        isFocusable &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset",
        isSticky && "sticky inset-inline-start-0 z-20 bg-background/95 backdrop-blur-xs shadow-2xs",
        isSortable && "group",
        className,
      )}
      {...props}
    >
      {isSortable ? (
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            "inline-flex min-h-11 -my-0.5 items-center gap-1.5 font-inherit text-inherit hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs",
            isRightAligned && "flex-row-reverse",
          )}
          title={screenReaderLabel}
        >
          <span>{children}</span>
          {sortIcon}
          <span className="sr-only">{screenReaderLabel}</span>
        </button>
      ) : (
        <span
          className={cn("inline-flex items-center gap-1.5", isRightAligned && "flex-row-reverse")}
        >
          {children}
          {sortIcon}
        </span>
      )}
    </th>
  );
}
TableHead.displayName = "TableHead";

export const TableHeadCell = TableHead;
export type { TableHeadProps, TableHeadCellProps } from "./tableTypes";
