/**
 * @file useWorkBatchTableInternalState.ts
 * @description Provides fallback client-side column sorting and column resizing
 * for WorkBatchTable when not controlled externally by a page controller.
 */
import { useCallback, useMemo, useState } from "react";
import type {
  WorkBatchTableColumn,
  WorkBatchTableColumnResize,
  WorkBatchTableSort,
} from "./workBatchTableTypes";

function compareRowValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  const strA = String(a).trim();
  const strB = String(b).trim();
  return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
}

export interface UseWorkBatchTableInternalStateOptions<TData extends { id: string | number }> {
  data: readonly TData[];
  columns: readonly WorkBatchTableColumn<TData>[];
  sort?: WorkBatchTableSort;
  columnResize?: WorkBatchTableColumnResize;
}

export function useWorkBatchTableInternalState<TData extends { id: string | number }>({
  data,
  columns,
  sort,
  columnResize,
}: UseWorkBatchTableInternalStateOptions<TData>) {
  // ── Column Resize Fallback ──
  const [internalWidths, setInternalWidths] = useState<Record<string, number>>({});

  const effectiveGetColumnWidth = useCallback(
    (key: string): number | undefined => {
      return columnResize?.getColumnWidth?.(key) ?? internalWidths[key];
    },
    [columnResize, internalWidths],
  );

  const effectiveOnColumnResize = useCallback(
    (key: string, width: number) => {
      if (columnResize?.onColumnResize) {
        columnResize.onColumnResize(key, width);
      } else {
        setInternalWidths((prev) => ({ ...prev, [key]: width }));
      }
    },
    [columnResize],
  );

  // ── Sorting Fallback ──
  const [internalSortField, setInternalSortField] = useState<string | undefined>(sort?.field);
  const [internalSortDir, setInternalSortDir] = useState<"asc" | "desc" | undefined>(sort?.dir);

  const effectiveSortField = sort?.field ?? internalSortField;
  const effectiveSortDir = sort?.dir ?? internalSortDir;

  const handleSort = useCallback(
    (field: string) => {
      if (sort?.onSort) {
        sort.onSort(field);
      } else {
        if (internalSortField === field) {
          setInternalSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
          setInternalSortField(field);
          setInternalSortDir("asc");
        }
      }
    },
    [sort, internalSortField],
  );

  const sortedData = useMemo(() => {
    // If external sort handler is controlling sort, data is already ordered
    if (sort?.onSort || !effectiveSortField || !effectiveSortDir) {
      return data;
    }

    const col = columns.find((c) => (c.sortField || c.id) === effectiveSortField);
    const fieldKey = col?.sortField || col?.id || effectiveSortField;

    return [...data].sort((rowA, rowB) => {
      const valA =
        (rowA as Record<string, unknown>)[fieldKey] ??
        (col?.id ? (rowA as Record<string, unknown>)[col.id] : undefined);
      const valB =
        (rowB as Record<string, unknown>)[fieldKey] ??
        (col?.id ? (rowB as Record<string, unknown>)[col.id] : undefined);
      const diff = compareRowValues(valA, valB);
      return effectiveSortDir === "desc" ? -diff : diff;
    });
  }, [data, columns, sort?.onSort, effectiveSortField, effectiveSortDir]);

  return {
    sortedData,
    sortConfig: {
      field: effectiveSortField,
      dir: effectiveSortDir,
      onSort: handleSort,
    },
    columnResizeConfig: {
      getColumnWidth: effectiveGetColumnWidth,
      onColumnResize: effectiveOnColumnResize,
    },
  };
}
