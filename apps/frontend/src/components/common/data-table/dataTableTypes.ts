import type React from "react";
import type { WorkBatchTableProps } from "@/components/common/work";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";
import type { TableCellAlign, TableCellVariant } from "@/components/ui/table";

/** Column layout owned by a page controller (`useModuleColumnLayout`). */
export type DataTableColumnLayout = ReturnType<typeof useModuleColumnLayout>;

export interface DataTableCardContext {
  isColumnVisible: (columnId: string) => boolean;
}

/** Primitive value(s) a column contributes to the toolbar search index. */
export type DataTableSearchValue =
  string | number | boolean | null | undefined | ReadonlyArray<string | number | null | undefined>;

export interface DataTableColumn<TData> {
  id: string;
  label: string;
  sortField?: string;
  render: (row: TData, index: number) => React.ReactNode;
  /** Text matched by search while the column is visible. Defaults to `row[id]` when primitive. */
  searchValue?: (row: TData) => DataTableSearchValue;
  /** Hidden until the user enables it in the column customizer. */
  defaultHidden?: boolean;
  /** Always visible; cannot be hidden by the user. */
  fixed?: boolean;
  /** Initial pixel width; users can resize afterwards. */
  width?: number;
  headerClassName?: string;
  cellClassName?: string | ((row: TData) => string | undefined);
  /** Omit from the generated card body (e.g. the title column). */
  hideInCard?: boolean;
  /** Prevents text wrapping; ideal for fixed-width columns (IDs, dates, badges, actions). */
  noWrap?: boolean;
  /** Truncates overflowing text with an ellipsis. */
  truncate?: boolean;
  /** Standardized text alignment: right for numbers/currency, left for text, center for badges/actions. */
  align?: TableCellAlign;
  /** Column data variant automatically configuring alignment and formatting. */
  variant?: TableCellVariant;
}

export interface DataTableFilterOption {
  value: string;
  label: string;
}

export interface DataTableFilter<TData> {
  id: string;
  label: string;
  options: DataTableFilterOption[];
  /** Value(s) of the row for this facet; a row matches when any value is selected. */
  getValue: (row: TData) => string | ReadonlyArray<string> | null | undefined;
}

export type DataTableFilterSelection = Readonly<Record<string, readonly string[]>>;

export interface DataTableCardSlots<TData> {
  /** Card heading; defaults to the first visible column. */
  title?: (row: TData) => React.ReactNode;
  /** Optional badge/status rendered beside the title. */
  badge?: (row: TData) => React.ReactNode;
}

type PassThroughTableProps<TData extends { id: string | number }> = Pick<
  WorkBatchTableProps<TData>,
  | "selection"
  | "sort"
  | "onRowClick"
  | "rowClassName"
  | "stickyColumnId"
  | "actionsLabel"
  | "caption"
>;

export interface DataTableProps<
  TData extends { id: string | number },
> extends PassThroughTableProps<TData> {
  /** Stable id; persists column visibility/order/width per user (`<tableId>.table.columns`). */
  tableId: string;
  data: readonly TData[];
  columns: readonly DataTableColumn<TData>[];
  filters?: readonly DataTableFilter<TData>[];
  /** Accessible name for the toolbar region and table caption fallback. */
  label: string;
  searchPlaceholder?: string;
  isLoading?: boolean;
  renderRowActions?: (row: TData, index: number) => React.ReactNode;
  /** Replaces the generated card for card view. */
  renderCard?: (row: TData, index: number, ctx: DataTableCardContext) => React.ReactNode;
  card?: DataTableCardSlots<TData>;
  /** Toolbar slot for the page's primary action (e.g. "Add"). */
  primaryAction?: React.ReactNode;
  /** Extra toolbar controls rendered before the filter menu. */
  toolbarExtras?: React.ReactNode;
  /** Shown when the source data is empty (not when search/filters exclude everything). */
  emptyState?: React.ReactNode;
  /** Initial view; defaults to table at md+ and cards below. */
  defaultViewMode?: WorkDirectoryViewMode;
  /** Use a controller-owned layout instead of the table-local one keyed by `tableId`. */
  columnLayout?: DataTableColumnLayout;
  className?: string;
}
