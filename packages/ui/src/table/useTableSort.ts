import { useState, useMemo } from "react";
import type { TableSortDirection } from "./tableTypes";

export interface UseTableSortProps<T> {
  /** Initial sort key for uncontrolled mode */
  initialSortKey?: string;
  /** Initial sort direction for uncontrolled mode */
  initialSortDirection?: TableSortDirection | null;
  /**
   * The active sort key (controlled mode).
   * If provided, the hook operates in controlled mode and you must handle state updates via `onSort`.
   */
  sortKey?: string;
  /**
   * The active sort direction (controlled mode).
   */
  sortDirection?: TableSortDirection | null;
  /**
   * Callback fired when a sortable column header is clicked.
   */
  onSort?: (key: string, direction: TableSortDirection | null) => void;
  /**
   * Optional data array to sort client-side.
   */
  data?: T[];
}

export function useTableSort<T>({
  initialSortKey,
  initialSortDirection = null,
  sortKey: controlledSortKey,
  sortDirection: controlledSortDirection,
  onSort,
  data,
}: UseTableSortProps<T>) {
  const isControlled = controlledSortKey !== undefined || controlledSortDirection !== undefined;

  const [internalSortKey, setInternalSortKey] = useState<string | undefined>(initialSortKey);
  const [internalSortDirection, setInternalSortDirection] = useState<TableSortDirection | null>(
    initialSortDirection,
  );

  const activeSortKey = isControlled ? controlledSortKey : internalSortKey;
  const activeSortDirection = isControlled ? controlledSortDirection : internalSortDirection;

  const handleSort = (key: string, direction: "asc" | "desc" | null) => {
    if (!isControlled) {
      setInternalSortKey(direction ? key : undefined);
      setInternalSortDirection(direction);
    }
    if (onSort) {
      onSort(key, direction);
    }
  };

  const sortedData = useMemo(() => {
    if (!data || !activeSortKey || !activeSortDirection || activeSortDirection === "none") {
      return data ?? [];
    }

    return [...data].sort((a, b) => {
      const aVal = a[activeSortKey as keyof T];
      const bVal = b[activeSortKey as keyof T];

      // Always place null/undefined at the bottom
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let comparison = 0;

      if (typeof aVal === "string" && typeof bVal === "string") {
        comparison = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: "base" });
      } else if (aVal instanceof Date && bVal instanceof Date) {
        comparison = aVal.getTime() - bVal.getTime();
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else {
        // Fallback for mixed types or booleans
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return activeSortDirection === "asc" ? comparison : -comparison;
    });
  }, [data, activeSortKey, activeSortDirection]);

  return {
    sortKey: activeSortKey,
    sortDirection: activeSortDirection,
    handleSort,
    sortedData,
  };
}
