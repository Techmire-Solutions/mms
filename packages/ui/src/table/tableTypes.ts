import type * as React from "react";

export type TableCellAlign = "start" | "left" | "center" | "end" | "right";
export type TableCellVariant = "text" | "number" | "currency" | "badge" | "action";
export type TableSortDirection = "asc" | "desc" | "none";

export interface TableContextValue {
  stickyHeader?: boolean;
}

export interface TableProps extends React.ComponentProps<"table"> {
  containerClassName?: string;
  stickyHeader?: boolean;
  scrollRegionLabel?: string;
  ref?: React.Ref<HTMLTableElement>;
}

export interface TableHeaderProps extends React.ComponentProps<"thead"> {
  sticky?: boolean;
  ref?: React.Ref<HTMLTableSectionElement>;
}

export type TableBodyProps = React.ComponentProps<"tbody">;

export interface TableFooterProps extends React.ComponentProps<"tfoot"> {
  /** Pins the footer to the bottom of the scroll container during vertical scrolling. */
  sticky?: boolean;
  ref?: React.Ref<HTMLTableSectionElement>;
}

export interface TableRowProps extends React.ComponentProps<"tr"> {
  isFocusable?: boolean;
  ref?: React.Ref<HTMLTableRowElement>;
}

export interface TableHeadProps extends Omit<React.ComponentProps<"th">, "align"> {
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
  ref?: React.Ref<HTMLTableCellElement>;
}

export type TableHeadCellProps = TableHeadProps;

export interface TableCellProps extends Omit<React.ComponentProps<"td">, "align"> {
  noWrap?: boolean;
  truncate?: boolean;
  align?: TableCellAlign;
  variant?: TableCellVariant;
  isFocusable?: boolean;
  asHeader?: boolean;
  ref?: React.Ref<HTMLTableCellElement>;
}

export type TableCaptionProps = React.ComponentProps<"caption">;
