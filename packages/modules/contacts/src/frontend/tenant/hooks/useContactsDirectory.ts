import { useCallback, useMemo, useRef } from "react";
import type { Contact } from "@mms/contracts";
import { CONTACTS_MODULE_MANIFEST } from "@mms/contracts";
import { useContactsContractList } from "./useContactsQueries.js";
import { useContactsDirectoryFilters } from "./useContactsDirectoryFilters.js";
import { useContactsDirectoryLinks } from "./useContactsDirectoryLinks.js";
import { contractBody, isContractQueryError } from "@mms/fe-core/api/contractQuery";
import { addRangeToSelection } from "@mms/fe-core/lib/directorySelection";

interface UseContactsDirectoryOptions {
  effectiveTab: string;
  setActiveTab: (tab: string) => void;
  editContact: Contact | null;
  viewContact: Contact | null;
  initialViewingDeleted?: boolean;
}

export function useContactsDirectory({
  effectiveTab,
  setActiveTab,
  editContact,
  viewContact,
  initialViewingDeleted = false,
}: UseContactsDirectoryOptions) {
  const filters = useContactsDirectoryFilters({
    setActiveTab,
    initialViewingDeleted,
  });

  const useServerWork = effectiveTab === "work";
  const workLimit = CONTACTS_MODULE_MANIFEST.defaultPageSize;

  const {
    data: workPageDataResponse,
    isLoading: isWorkLoading,
    isError: isWorkErrorTsr,
    refetch: refetchWork,
    isFetching: isWorkFetching,
  } = useContactsContractList(
    {
      page: filters.listPage,
      limit: workLimit,
      search: filters.debouncedSearch,
      gender: filters.filterGender,
      includeDeleted: filters.viewingDeleted,
      sortField: filters.sortField,
      sortDir: filters.sortDir,
      quickFilter: filters.quickFilter,
    },
    useServerWork,
  );

  const workContacts = useMemo(
    () => (workPageDataResponse?.body?.contacts ?? []) as Contact[],
    [workPageDataResponse?.body?.contacts],
  );
  const shownCount = workPageDataResponse?.body?.total ?? 0;
  const isWorkError =
    isWorkErrorTsr ||
    isContractQueryError({ isError: false, data: workPageDataResponse ?? undefined });
  const workPageData =
    contractBody<
      typeof workPageDataResponse extends undefined
        ? never
        : NonNullable<typeof workPageDataResponse>["body"]
    >(workPageDataResponse);

  const allContactsForLinks = useContactsDirectoryLinks({
    workContacts,
    editContact,
    viewContact,
  });

  const {
    handleSelectAll: selectAllIds,
    handleSelect: toggleSelect,
    setSelected: setSelectedIds,
  } = filters;
  const handleSelectAll = useCallback(() => {
    selectAllIds(workContacts.map((contact) => contact.id));
  }, [selectAllIds, workContacts]);

  // Shift-click range selection: the last plain (non-shift) selection acts as the
  // range anchor; a shift+click extends selection contiguously in list order.
  const anchorIdRef = useRef<string | number | null>(null);

  const handleSelect = useCallback(
    (id: string | number) => {
      anchorIdRef.current = id;
      toggleSelect(id);
    },
    [toggleSelect],
  );

  const handleSelectRange = useCallback(
    (id: string | number) => {
      const anchor = anchorIdRef.current;
      if (anchor == null || anchor === id) {
        handleSelect(id);
        return;
      }
      const ids = workContacts.map((contact) => contact.id);
      const anchorIdx = ids.indexOf(anchor);
      const targetIdx = ids.indexOf(id);
      if (anchorIdx === -1 || targetIdx === -1) {
        handleSelect(id);
        return;
      }
      const [lo, hi] = anchorIdx < targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
      const range = ids.slice(lo, hi + 1);
      setSelectedIds((selected) => addRangeToSelection(selected, range));
    },
    [workContacts, handleSelect, setSelectedIds],
  );

  return {
    viewingDeleted: filters.viewingDeleted,
    setViewingDeleted: filters.setViewingDeleted,
    listPage: filters.listPage,
    setListPage: filters.setListPage,
    search: filters.search,
    setSearch: filters.setSearch,
    debouncedSearch: filters.debouncedSearch,
    filterGender: filters.filterGender,
    setFilterGender: filters.setFilterGender,
    quickFilter: filters.quickFilter,
    setQuickFilter: filters.setQuickFilter,
    sortField: filters.sortField,
    sortDir: filters.sortDir,
    selected: filters.selected,
    setSelected: filters.setSelected,
    useServerWork,
    workPageData,
    isWorkLoading,
    isWorkError,
    refetchWork,
    isWorkFetching,
    workContacts,
    shownCount,
    allContactsForLinks,
    hasActiveFilters: filters.hasActiveFilters,
    activeFilterCount: filters.activeFilterCount,
    handleSort: filters.handleSort,
    handleSortDir: filters.handleSortDir,
    handleSelect,
    handleSelectRange,
    handleSelectAll,
    clearFilters: filters.clearFilters,
    clearSelection: filters.clearSelection,
  };
}
