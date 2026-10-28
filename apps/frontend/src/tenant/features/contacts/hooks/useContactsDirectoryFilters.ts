import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";
import { isContactsQuickFilter, type ContactsQuickFilter } from "@mms/shared";
import {
  CONTACTS_WORK_DRILLDOWN_EVENT,
  consumeContactsWorkDrillDown,
  type ContactsWorkDrillDown,
} from "@/lib/contacts/contactsWorkDrillDown";
import { toggleIdInSelection, togglePageIdsInSelection } from "@/lib/directorySelection";

export function useContactsDirectoryFilters({
  setActiveTab,
}: {
  setActiveTab: (tab: string) => void;
  initialViewingDeleted?: boolean;
}) {
  const [initialDrillDown] = useState(() => consumeContactsWorkDrillDown());
  const [viewingDeleted, setViewingDeleted] = useDirectoryTrashState();
  const [listPage, setListPage] = useState(1);
  const [search, setSearch] = useState(() => initialDrillDown?.search || "");
  const debouncedSearch = useDebounce(search, 250);
  const [filterGender, setFilterGender] = useState(() => initialDrillDown?.gender || "");
  const [quickFilter, setQuickFilter] = useState<ContactsQuickFilter>(() =>
    initialDrillDown?.quickFilter && isContactsQuickFilter(initialDrillDown.quickFilter)
      ? initialDrillDown.quickFilter
      : "all",
  );
  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<(string | number)[]>([]);

  const currentFilterKey = `${debouncedSearch}|${filterGender}|${quickFilter}|${sortField}|${sortDir}|${viewingDeleted}`;
  const [prevFilterKey, setPrevFilterKey] = useState(currentFilterKey);
  if (prevFilterKey !== currentFilterKey) {
    setPrevFilterKey(currentFilterKey);
    if (listPage !== 1) {
      setListPage(1);
    }
  }

  const applyDrillDown = useCallback(
    (filter: ContactsWorkDrillDown) => {
      if (filter.gender) setFilterGender(filter.gender);
      if (filter.search) setSearch(filter.search);
      if (filter.quickFilter && isContactsQuickFilter(filter.quickFilter)) {
        setQuickFilter(filter.quickFilter);
      }
      setActiveTab("work");
    },
    [setActiveTab],
  );

  useEffect(() => {
    if (initialDrillDown) {
      setActiveTab("work");
    }

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ContactsWorkDrillDown>).detail;
      if (detail) applyDrillDown(detail);
    };
    window.addEventListener(CONTACTS_WORK_DRILLDOWN_EVENT, handler);
    return () => window.removeEventListener(CONTACTS_WORK_DRILLDOWN_EVENT, handler);
  }, [applyDrillDown, initialDrillDown, setActiveTab]);

  const hasActiveFilters = !!(filterGender || search || quickFilter !== "all");
  const activeFilterCount =
    (filterGender ? 1 : 0) + (quickFilter !== "all" ? 1 : 0) + (search.trim() ? 1 : 0);

  const handleSort = useCallback((field: string) => {
    setSortField((currentField) => {
      if (currentField === field) {
        setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
        return currentField;
      }
      setSortDir("asc");
      return field;
    });
  }, []);

  const handleSelect = useCallback((id: string | number) => {
    setSelected((selectedIds) => toggleIdInSelection(selectedIds, id));
  }, []);

  /** Toggle current-page ids into/out of selection (keeps selections from other pages). */
  const handleSelectAll = useCallback((workContactIds: Array<string | number>) => {
    setSelected((selectedIds) => togglePageIdsInSelection(selectedIds, workContactIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelected([]);
  }, []);

  const clearFilters = useCallback(() => {
    setFilterGender("");
    setSearch("");
    setQuickFilter("all");
  }, []);

  return {
    viewingDeleted,
    setViewingDeleted,
    listPage,
    setListPage,
    search,
    setSearch,
    debouncedSearch,
    filterGender,
    setFilterGender,
    quickFilter,
    setQuickFilter,
    sortField,
    sortDir,
    selected,
    setSelected,
    hasActiveFilters,
    activeFilterCount,
    handleSort,
    handleSelect,
    handleSelectAll,
    clearFilters,
    clearSelection,
  };
}
