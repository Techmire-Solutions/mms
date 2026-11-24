/**
 * Low-level table primitives only. The single table *engine* for the whole app is
 * `WorkBatchTable` (packages/fe-core/src/components/WorkBatchTable.tsx),
 * with the stateful shell `DataTable` (apps/frontend/src/components/common/data-table).
 * Do not add a second DataTable/Pagination-style table engine here — the
 * `check:shared-ui` ratchet enforces this allowlist.
 */
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableCaption,
  type TableProps,
  type TableHeaderProps,
  type TableFooterProps,
  type TableRowProps,
} from "./Table";
export {
  TableHead,
  TableHeadCell,
  type TableHeadProps,
  type TableHeadCellProps,
} from "./TableHead";
export { TableCell, type TableCellProps } from "./TableCell";
export {
  ListPagination,
  type ListPaginationProps,
  type ListPaginationLabels,
} from "./ListPagination";
export { TableSkeleton, type TableSkeletonProps } from "./TableSkeleton";
export { TableEmpty, type TableEmptyProps } from "./TableEmpty";
export { DensityToggle, type DensityMode, type DensityToggleProps } from "./DensityToggle";
export { TableCellLink, type TableCellLinkProps } from "./TableCellLink";
export { useTableSort, type UseTableSortProps } from "./useTableSort";
export {
  getTableCellWrapClass,
  getTableCellAlignClass,
  getTableHeadAlignClass,
  getAriaSort,
} from "./tableUtils";
export type {
  TableCellAlign,
  TableCellVariant,
  TableSortDirection,
  TableContextValue,
  TableBodyProps,
  TableCaptionProps,
} from "./tableTypes";
