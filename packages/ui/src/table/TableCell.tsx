import * as React from "react";
import { cn } from "../utils";
import type { TableCellProps } from "./tableTypes";
import { getTableCellAlignClass, getTableCellWrapClass } from "./tableUtils";

export function TableCell({
  className,
  noWrap,
  truncate,
  align,
  variant,
  isFocusable,
  asHeader,
  isSticky,
  title,
  tabIndex,
  children,
  ref,
  ...props
}: TableCellProps) {
  const isRowHeader = Boolean(asHeader || props.scope === "row");
  const resolvedTitle = title ?? (truncate && typeof children === "string" ? children : undefined);
  const wrapClass = getTableCellWrapClass(noWrap, truncate);
  const alignClass = getTableCellAlignClass(align, variant);
  const stickyClass = isSticky && "sticky inset-inline-start-0 z-1 bg-background/95 backdrop-blur-xs shadow-2xs";

  if (isRowHeader) {
    return (
      <th
        ref={ref}
        role="rowheader"
        scope="row"
        title={resolvedTitle}
        tabIndex={isFocusable ? (tabIndex ?? 0) : tabIndex}
        className={cn(
          "p-2 align-middle font-medium text-foreground text-start",
          wrapClass,
          alignClass,
          isFocusable &&
            "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset",
          stickyClass,
          className,
        )}
        {...props}
      >
        {children}
      </th>
    );
  }

  return (
    <td
      ref={ref}
      role="cell"
      title={resolvedTitle}
      tabIndex={isFocusable ? (tabIndex ?? 0) : tabIndex}
      className={cn(
        "p-2 align-middle [&:has([role=checkbox])]:pe-0 [&>[role=checkbox]]:translate-y-0.5",
        wrapClass,
        alignClass,
        isFocusable &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset",
        stickyClass,
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}
TableCell.displayName = "TableCell";
export type { TableCellProps } from "./tableTypes";
