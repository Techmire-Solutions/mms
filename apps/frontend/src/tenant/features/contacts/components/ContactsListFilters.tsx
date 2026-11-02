import React, { useEffect, useRef, useState } from "react";
import type { ContactsQuickFilter } from "@mms/shared";
import type { ContactsWorkViewMode } from "@/tenant/features/contacts/lib/contactsWorkTierTypes";
import { ContactsFiltersMenuButton } from "@/tenant/features/contacts/components/ContactsFiltersMenuButton";
import { useContactsToolbarModel } from "@/tenant/features/contacts/hooks/useContactsToolbarModel";
import { CONTACTS_WORK_SEARCH_INPUT_ID } from "@/tenant/features/contacts/hooks/useContactsKeyboardShortcuts";
import { ModuleWorkToolbar } from "@/components/app/ModuleWorkToolbar";
import { useDebounce } from "@/hooks/useDebounce";

export interface ContactsListFiltersProps {
  search: string;
  onSearchChange: (searchValue: string) => void;
  filterGender: string;
  onGenderChange: (gender: string) => void;
  quickFilter: ContactsQuickFilter;
  onQuickFilterChange: (preset: ContactsQuickFilter) => void;
  sortField: string;
  onSort: (field: string) => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onClearFilters: () => void;
  viewingDeleted?: boolean;
  onShowDeletedChange?: (show: boolean) => void;
  canViewDeleted?: boolean;
  viewMode: ContactsWorkViewMode;
  onViewModeChange: (mode: ContactsWorkViewMode) => void;
  shownCount?: number;
  filterChips?: React.ReactNode;
}

export const ContactsListFilters = React.memo(function ContactsListFilters({
  search,
  onSearchChange,
  filterGender,
  onGenderChange,
  quickFilter,
  onQuickFilterChange,
  sortField,
  onSort,
  hasActiveFilters,
  activeFilterCount,
  onClearFilters,
  viewingDeleted = false,
  onShowDeletedChange,
  canViewDeleted = false,
  viewMode,
  onViewModeChange,
  shownCount,
  filterChips,
}: ContactsListFiltersProps): React.JSX.Element {
  const {
    t,
    genders,
    sortOptions,
    columnRegistry,
    updateUserColumnLayout,
    handleResetColumnLayout,
    columnCustomizerLabels,
  } = useContactsToolbarModel();

  /**
   * Keystrokes are local: the page controller (metrics, directory, overlays)
   * only re-renders once the debounced value settles, instead of on every
   * character. The ref distinguishes our own pushes from external resets
   * (clear filters, drill-down navigation).
   */
  const [searchInput, setSearchInput] = useState(search);
  const debouncedInput = useDebounce(searchInput, 250);
  const lastPushedRef = useRef(search);

  useEffect(() => {
    if (debouncedInput === lastPushedRef.current) return;
    lastPushedRef.current = debouncedInput;
    onSearchChange(debouncedInput);
  }, [debouncedInput, onSearchChange]);

  useEffect(() => {
    if (search === lastPushedRef.current) return;
    lastPushedRef.current = search;
    setSearchInput(search);
  }, [search]);

  return (
    <ModuleWorkToolbar
      shownCountLabel={
        shownCount != null ? t("contacts.shownCount", { count: shownCount }) : undefined
      }
      regionLabel={t("contacts.filters")}
      search={searchInput}
      onSearchChange={setSearchInput}
      searchPlaceholder={t("contacts.searchPlaceholder")}
      searchId={CONTACTS_WORK_SEARCH_INPUT_ID}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      clearFiltersLabel={t("contacts.clearFilters")}
      filterChips={filterChips}
      filterButton={
        <ContactsFiltersMenuButton
          activeFilterCount={activeFilterCount}
          quickFilter={quickFilter}
          onQuickFilterChange={onQuickFilterChange}
          filterGender={filterGender}
          genders={genders}
          onGenderChange={onGenderChange}
          sortField={sortField}
          sortOptions={sortOptions}
          onSort={onSort}
          t={t}
        />
      }
      trashToggle={
        canViewDeleted && onShowDeletedChange
          ? {
              canViewDeleted,
              viewingDeleted,
              onToggle: onShowDeletedChange,
              activeLabel: t("contacts.showActive"),
              deletedLabel: t("contacts.showDeleted"),
            }
          : undefined
      }
      viewModeToggle={{
        viewMode,
        onViewModeChange,
      }}
      columnCustomizer={{
        registry: columnRegistry,
        onUpdate: updateUserColumnLayout,
        onReset: handleResetColumnLayout,
        labels: columnCustomizerLabels,
      }}
    />
  );
});

export default ContactsListFilters;
