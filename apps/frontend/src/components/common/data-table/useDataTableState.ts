import { useCallback, useMemo, useState } from "react";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";
import {
  useWorkDirectoryViewMode,
  type WorkDirectoryViewMode,
} from "@/hooks/useWorkDirectoryViewMode";
import type {
  DataTableColumn,
  DataTableColumnLayout,
  DataTableFilter,
  DataTableFilterSelection,
} from "./dataTableTypes";
import {
  buildDataTableRegistry,
  countActiveFilters,
  filterDataTableRows,
  resolveVisibleColumns,
  sortDataTableRows,
} from "./dataTableUtils";

export interface UseDataTableStateOptions<TData> {
  tableId: string;
  data: readonly TData[];
  columns: readonly DataTableColumn<TData>[];
  filters?: readonly DataTableFilter<TData>[];
  defaultViewMode?: WorkDirectoryViewMode;
  columnLayout?: DataTableColumnLayout;
}

const NO_FILTERS: readonly never[] = [];

/** Client-side search, facet filters, view mode, and persisted column layout for {@link DataTable}. */
export function useDataTableState<TData>({
  tableId,
  data,
  columns,
  filters = NO_FILTERS,
  defaultViewMode,
  columnLayout,
}: UseDataTableStateOptions<TData>) {
  const [search, setSearch] = useState("");
  const [filterSelection, setFilterSelection] = useState<DataTableFilterSelection>({});
  const { viewMode, setViewMode } = useWorkDirectoryViewMode(defaultViewMode);

  const tenantRegistry = useMemo(() => buildDataTableRegistry(columns), [columns]);
  const ownLayout = useModuleColumnLayout({ moduleId: tableId, tenantRegistry });
  const layout = columnLayout ?? ownLayout;

  const visibleColumns = useMemo(
    () => resolveVisibleColumns(columns, layout.columnRegistry),
    [columns, layout.columnRegistry],
  );

  const [sortField, setSortField] = useState<string | undefined>();
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = useCallback((field: string) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return field;
      }
      setSortDir("asc");
      return field;
    });
  }, []);

  const filteredRows = useMemo(
    () => filterDataTableRows(data, visibleColumns, search, filters, filterSelection),
    [data, visibleColumns, search, filters, filterSelection],
  );

  const rows = useMemo(
    () => sortDataTableRows(filteredRows, visibleColumns, sortField, sortDir),
    [filteredRows, visibleColumns, sortField, sortDir],
  );

  const toggleFilterValue = useCallback((filterId: string, value: string) => {
    setFilterSelection((prev) => {
      const current = prev[filterId] ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [filterId]: next };
    });
  }, []);

  const activeFilterCount = countActiveFilters(filterSelection);

  const clearFilters = useCallback(() => {
    setFilterSelection({});
    setSearch("");
  }, []);

  return {
    search,
    setSearch,
    filterSelection,
    toggleFilterValue,
    activeFilterCount,
    hasActiveFilters: activeFilterCount > 0 || search.trim().length > 0,
    clearFilters,
    viewMode,
    setViewMode,
    visibleColumns,
    rows,
    sortField,
    sortDir,
    handleSort,
    layout,
  };
}
