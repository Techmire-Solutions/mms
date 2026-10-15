import { useCallback, useMemo } from "react";
import type { Contact } from "@mms/shared";
import { CONTACTS_MODULE_MANIFEST } from "@mms/shared";
import { useContactsContractList } from "@/tenant/features/contacts/hooks/useContactsQueries";
import { useContactsDirectoryFilters } from "@/tenant/features/contacts/hooks/useContactsDirectoryFilters";
import { useContactsDirectoryLinks } from "@/tenant/features/contacts/hooks/useContactsDirectoryLinks";

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
    isWorkErrorTsr || (workPageDataResponse != null && workPageDataResponse.status !== 200);
  const workPageData = workPageDataResponse?.status === 200 ? workPageDataResponse.body : undefined;

  const allContactsForLinks = useContactsDirectoryLinks({
    workContacts,
    editContact,
    viewContact,
  });

  const { handleSelectAll: selectAllIds } = filters;
  const handleSelectAll = useCallback(() => {
    selectAllIds(workContacts.map((contact) => contact.id));
  }, [selectAllIds, workContacts]);

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
    handleSelect: filters.handleSelect,
    handleSelectAll,
    clearFilters: filters.clearFilters,
    clearSelection: filters.clearSelection,
  };
}
