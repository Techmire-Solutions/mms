import type * as React from "react";

export type TableCellAlign = "start" | "left" | "center" | "end" | "right";
export type TableCellVariant = "text" | "number" | "currency" | "badge" | "action";
export type TableSortDirection = "asc" | "desc" | "none";

export interface TableContextValue {
  stickyHeader?: boolean;
}

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  containerClassName?: string;
  stickyHeader?: boolean;
  scrollRegionLabel?: string;
}

export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  sticky?: boolean;
}

export type TableBodyProps = React.HTMLAttributes<HTMLTableSectionElement>;

export interface TableFooterProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /** Pins the footer to the bottom of the scroll container during vertical scrolling. */
  sticky?: boolean;
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  isFocusable?: boolean;
}

export interface TableHeadProps extends Omit<
  React.ThHTMLAttributes<HTMLTableCellElement>,
  "align"
> {
  noWrap?: boolean;
  truncate?: boolean;
  align?: TableCellAlign;
  variant?: TableCellVariant;
  isFocusable?: boolean;
  /** Whether this column can be sorted */
  sortable?: boolean;
  /** The field identifier used for sorting */
  sortKey?: string;
  /** The current sort direction */
  sortDirection?: TableSortDirection | boolean | null;
  /** Callback fired when the header is clicked for sorting */
  onSort?: ((key: string, direction: "asc" | "desc" | null) => void) | (() => void);
}

export type TableHeadCellProps = TableHeadProps;

export interface TableCellProps extends Omit<
  React.TdHTMLAttributes<HTMLTableCellElement>,
  "align"
> {
  noWrap?: boolean;
  truncate?: boolean;
  align?: TableCellAlign;
  variant?: TableCellVariant;
  isFocusable?: boolean;
  asHeader?: boolean;
}

export type TableCaptionProps = React.HTMLAttributes<HTMLTableCaptionElement>;
