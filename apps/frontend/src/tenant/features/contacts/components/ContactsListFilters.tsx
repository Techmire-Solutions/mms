import React, { useEffect, useRef, useState } from "react";
import type { ContactsQuickFilter } from "@mms/shared";
import type { ContactsWorkViewMode } from "@/tenant/features/contacts/lib/contactsWorkTierTypes";
import { ContactsFiltersMenuButton } from "@/tenant/features/contacts/components/ContactsFiltersMenuButton";
import { useContactsToolbarModel } from "@/tenant/features/contacts/hooks/useContactsToolbarModel";
import { CONTACTS_WORK_SEARCH_INPUT_ID } from "@/tenant/features/contacts/hooks/useContactsKeyboardShortcuts";
import { ModuleWorkToolbar } from "@/components/app/ModuleWorkToolbar";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

export interface ContactsListFiltersProps {
  search: string;
  onSearchChange: (searchValue: string) => void;
  filterGender: string;
  onGenderChange: (gender: string) => void;
  quickFilter: ContactsQuickFilter;
  onQuickFilterChange: (preset: ContactsQuickFilter) => void;
  sortField: string;
  sortDir: "asc" | "desc";
  onSort: (field: string) => void;
  onSortDirChange: (dir: "asc" | "desc") => void;
  isSearching?: boolean;
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
  sortDir,
  onSort,
  onSortDirChange,
  isSearching = false,
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

  const sortLabel = sortOptions.find((option) => option.field === sortField)?.label ?? sortField;
  const directionLabel = t(
    sortDir === "asc" ? "contacts.sort.ascending" : "contacts.sort.descending",
  );
  const sortChipLabel = t("contacts.sort.chip", { field: sortLabel, direction: directionLabel });
  const SortIcon = sortDir === "asc" ? ArrowUp : ArrowDown;

  return (
    <>
      <ModuleWorkToolbar
        shownCountLabel={
          shownCount != null ? t("contacts.shownCount", { count: shownCount }) : undefined
        }
        regionLabel={t("contacts.filters")}
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder={t("contacts.searchPlaceholder")}
        searchId={CONTACTS_WORK_SEARCH_INPUT_ID}
        isSearching={isSearching}
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
            sortDir={sortDir}
            sortOptions={sortOptions}
            onSort={onSort}
            onSortDirChange={onSortDirChange}
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
      {viewMode === "cards" ? (
        <div className="flex justify-end px-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSortDirChange(sortDir === "asc" ? "desc" : "asc")}
            aria-label={`${sortChipLabel}. ${t("contacts.sort.direction")}: ${directionLabel}`}
            className="min-h-11 gap-1.5 px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <SortIcon className="h-3.5 w-3.5" aria-hidden />
            <span>{sortChipLabel}</span>
            <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden />
          </Button>
        </div>
      ) : null}
    </>
  );
});

export default ContactsListFilters;
