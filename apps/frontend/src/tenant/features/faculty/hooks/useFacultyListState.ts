import { useCallback, useMemo } from "react";
import type { Faculty, FacultySortField } from "@mms/shared";
import { getDirectoryPageSelection } from "@/lib/directorySelection";
import { useFacultyStatusConfig } from "@/tenant/features/faculty/hooks/useFacultyStatusConfig";

export interface UseFacultyListStateOptions {
  faculty: Faculty[];
  showDeleted: boolean;
  selectedIds: string[];
  onSelectOne: (id: string) => void;
  onSelectAll: (pageIds: string[]) => void;
  controlledSortField?: FacultySortField;
  controlledSortDir?: "asc" | "desc";
  /** Server SQL sort (Work list SSOT) — required; client re-sort removed. */
  onSortChange: (field: FacultySortField, dir: "asc" | "desc") => void;
  isColumnVisible?: (columnId: string) => boolean;
}

export function useFacultyListState({
  faculty,
  showDeleted: _showDeleted,
  selectedIds,
  onSelectOne,
  onSelectAll,
  controlledSortField = "name",
  controlledSortDir = "asc",
  onSortChange,
  isColumnVisible,
}: UseFacultyListStateOptions) {
  const columnVisible = isColumnVisible ?? (() => true);

  const statusConfig = useFacultyStatusConfig();

  const sortField = controlledSortField;
  const sortDir = controlledSortDir;

  const handleSort = useCallback(
    (field: FacultySortField) => {
      const resolvedDir = sortField === field && sortDir === "asc" ? "desc" : "asc";
      onSortChange(field, resolvedDir);
    },
    [sortField, sortDir, onSortChange],
  );

  const pageIds = useMemo(() => faculty.map((member) => String(member.id)), [faculty]);
  const { allSelected, someSelected } = getDirectoryPageSelection(pageIds, selectedIds);

  const handleSelectAll = useCallback(() => {
    onSelectAll(pageIds);
  }, [onSelectAll, pageIds]);

  const handleSelectOne = useCallback(
    (id: string) => {
      onSelectOne(id);
    },
    [onSelectOne],
  );

  return {
    sorted: faculty,
    sortField,
    sortDir,
    statusConfig,
    isColumnVisible: columnVisible,
    selectedIds,
    allSelected,
    someSelected,
    handleSort,
    handleSelectAll,
    handleSelectOne,
  };
}
