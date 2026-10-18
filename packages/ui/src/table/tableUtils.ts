import type { TableCellAlign, TableCellVariant, TableSortDirection } from "./tableTypes";

export function getTableCellWrapClass(noWrap?: boolean, truncate?: boolean): string {
  if (noWrap) return "whitespace-nowrap";
  if (truncate) return "truncate max-w-xs";
  return "whitespace-normal break-words max-w-prose";
}

export function getTableCellAlignClass(align?: TableCellAlign, variant?: TableCellVariant): string {
  if (align === "end" || align === "right" || variant === "number" || variant === "currency") {
    return variant === "currency"
      ? "text-end font-mono tabular-nums font-semibold"
      : "text-end font-mono tabular-nums";
  }
  if (align === "center" || variant === "badge" || variant === "action") {
    return "text-center";
  }
  return "text-start";
}

export function getAriaSort(
  sortDirection?: TableSortDirection | boolean | null,
): "ascending" | "descending" | "none" | undefined {
  if (sortDirection === "asc" || sortDirection === true) return "ascending";
  if (sortDirection === "desc") return "descending";
  if (sortDirection === "none" || sortDirection === false) return "none";
  return undefined;
}
