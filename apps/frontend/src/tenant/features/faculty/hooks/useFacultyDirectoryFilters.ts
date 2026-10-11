import { useCallback, useEffect, useState } from "react";
import { isFacultyQuickFilter, type FacultyQuickFilter } from "@mms/shared";
import { useDebounce } from "@/hooks/useDebounce";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";
import { getDirectoryPageSelection } from "@/lib/directorySelection";
import { useWorkSelection } from "@/hooks/useWorkSelection";
import { useFacultyDirectoryDrillDown } from "@/tenant/features/faculty/hooks/useFacultyDirectoryDrillDown";
import type { FacultySortField } from "@/tenant/features/faculty/components/facultyListTypes";

/** Directory filters, sort, trash, and selection SSOT for Faculty Work. */
export function useFacultyDirectoryFilters({
  setActiveTab,
}: {
  setActiveTab: (tab: string) => void;
}) {
  const [listPage, setListPage] = useState(1);
  const [showDeleted, setShowDeleted] = useDirectoryTrashState();
  const [sortField, setSortField] = useState<FacultySortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterSpecialization, setFilterSpecialization] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterDesignation, setFilterDesignation] = useState("");
  const [filterReportingFacultyId, setFilterReportingFacultyId] = useState("");
  const [quickFilter, setQuickFilter] = useState<FacultyQuickFilter>("all");
  const { selectedIds, toggleSelected, toggleSelectAll, clearSelection } =
    useWorkSelection<string>();

  useEffect(() => {
    setListPage(1);
  }, [
    debouncedSearch,
    filterStatus,
    filterSpecialization,
    filterGender,
    filterDepartment,
    filterDesignation,
    filterReportingFacultyId,
    quickFilter,
    showDeleted,
    sortField,
    sortDir,
  ]);

  useEffect(() => {
    clearSelection();
  }, [
    listPage,
    debouncedSearch,
    filterStatus,
    filterSpecialization,
    filterGender,
    filterDepartment,
    filterDesignation,
    filterReportingFacultyId,
    quickFilter,
    showDeleted,
    sortField,
    sortDir,
    clearSelection,
  ]);

  useFacultyDirectoryDrillDown({
    setActiveTab,
    setQuickFilter,
    setFilterStatus,
    setFilterDepartment,
    setFilterDesignation,
    setFilterReportingFacultyId,
  });

  const toggleStatus = useCallback((status: string) => {
    setQuickFilter("all");
    setFilterStatus((selectedStatuses) => {
      const nextSet = new Set(selectedStatuses);
      if (nextSet.has(status)) nextSet.delete(status);
      else nextSet.add(status);
      return [...nextSet];
    });
  }, []);

  const changeQuickFilter = useCallback((preset: string) => {
    if (!isFacultyQuickFilter(preset)) return;
    setFilterStatus([]);
    setQuickFilter(preset);
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setFilterStatus([]);
    setFilterSpecialization("");
    setFilterGender("");
    setFilterDepartment("");
    setFilterDesignation("");
    setFilterReportingFacultyId("");
    setQuickFilter("all");
  }, []);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    filterStatus.length > 0 ||
    Boolean(filterSpecialization) ||
    Boolean(filterGender) ||
    Boolean(filterDepartment) ||
    Boolean(filterDesignation) ||
    Boolean(filterReportingFacultyId) ||
    quickFilter !== "all";

  const activeFilterCount =
    filterStatus.length +
    (filterSpecialization ? 1 : 0) +
    (filterGender ? 1 : 0) +
    (filterDepartment ? 1 : 0) +
    (filterDesignation ? 1 : 0) +
    (filterReportingFacultyId ? 1 : 0) +
    (search.trim() ? 1 : 0) +
    (quickFilter !== "all" ? 1 : 0);

  const handleSelectOne = useCallback(
    (id: string) => {
      toggleSelected(id, !selectedIds.includes(id));
    },
    [selectedIds, toggleSelected],
  );

  const handleSelectAll = useCallback(
    (pageIds: string[]) => {
      const { allSelected } = getDirectoryPageSelection(pageIds, selectedIds);
      toggleSelectAll(!allSelected, pageIds);
    },
    [selectedIds, toggleSelectAll],
  );

  return {
    listPage,
    setListPage,
    showDeleted,
    setShowDeleted,
    sortField,
    setSortField,
    sortDir,
    setSortDir,
    search,
    setSearch,
    debouncedSearch,
    filterStatus,
    setFilterStatus,
    filterSpecialization,
    setFilterSpecialization,
    filterGender,
    setFilterGender,
    filterDepartment,
    setFilterDepartment,
    filterDesignation,
    setFilterDesignation,
    filterReportingFacultyId,
    setFilterReportingFacultyId,
    quickFilter,
    changeQuickFilter,
    selectedIds,
    clearSelection,
    handleSelectOne,
    handleSelectAll,
    toggleStatus,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  };
}
