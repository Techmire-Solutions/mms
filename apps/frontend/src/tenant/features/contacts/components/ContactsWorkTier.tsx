import React, { useMemo } from "react";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { FilterChips } from "@/components/app/FilterChips";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { useTranslation } from "@/hooks/useTranslation";
import ContactsListFilters from "@/tenant/features/contacts/components/ContactsListFilters";
import { ContactsBulkActionBar } from "@/tenant/features/contacts/components/ContactsBulkActionBar";
import { ContactsList } from "@/tenant/features/contacts/components/ContactsList";
import { useContactEntityDescriptor } from "@/tenant/features/contacts/hooks/useContactEntityDescriptor";
import { useDescriptorFilterChips } from "@/components/common/useDescriptorFilterChips";
import type { ContactsWorkTierProps } from "@/tenant/features/contacts/lib/contactsWorkTierTypes";

export const ContactsWorkTier = React.memo(function ContactsWorkTier({
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
  viewingDeleted,
  onShowDeletedChange,
  canViewDeleted,
  viewMode,
  onViewModeChange,
  shownCount,
  selected,
  onClearSelection,
  selectedTargets,
  bulkActions,
  canWriteMessaging,
  canExport,
  canDelete,
  canWrite,
  onWhatsApp,
  onSms,
  onEmail,
  onBulkExport,
  isExporting,
  onRequestBulkDelete,
  onRequestBulkRestore,
  onBulkTag,
  isWorkError,
  isWorkLoading,
  isWorkFetching,
  onRetryWork,
  workContacts,
  tableColumns,
  commonDirectoryProps,
  tableProps,
  useServerWork,
  workPageData,
  onPageChange,
}: ContactsWorkTierProps): React.JSX.Element {
  const { t } = useTranslation();
  const descriptor = useContactEntityDescriptor();

  const activeFilters = useMemo(
    () => ({
      gender: filterGender || undefined,
      quickFilter: quickFilter !== "all" ? quickFilter : undefined,
    }),
    [filterGender, quickFilter],
  );

  const filterChips = useDescriptorFilterChips(descriptor, activeFilters, (key) => {
    if (key === "gender") onGenderChange("");
    if (key === "quickFilter") onQuickFilterChange("all");
  });

  return (
    <ModuleTierMotion tier="work" className="space-y-4" aria-busy={isWorkFetching}>
      <ErrorBoundary
        fallback={
          <div className="p-4 text-sm text-destructive">{t("errors.toolbar.loadFailed")}</div>
        }
      >
        <ContactsListFilters
          search={search}
          onSearchChange={onSearchChange}
          filterGender={filterGender}
          onGenderChange={onGenderChange}
          quickFilter={quickFilter}
          onQuickFilterChange={onQuickFilterChange}
          sortField={sortField}
          onSort={onSort}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          onClearFilters={onClearFilters}
          viewingDeleted={viewingDeleted}
          onShowDeletedChange={onShowDeletedChange}
          canViewDeleted={canViewDeleted}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          shownCount={shownCount}
          filterChips={<FilterChips chips={filterChips} onClearAll={onClearFilters} />}
        />
      </ErrorBoundary>

      <ContactsBulkActionBar
        selectedCount={selected.length}
        viewingDeleted={viewingDeleted}
        bulkActions={bulkActions}
        canWriteMessaging={canWriteMessaging}
        canExport={canExport}
        canDelete={canDelete}
        canWrite={canWrite}
        selectedTargets={selectedTargets}
        onWhatsApp={onWhatsApp}
        onSms={onSms}
        onEmail={onEmail}
        onBulkExport={onBulkExport}
        isExporting={isExporting}
        onRequestBulkDelete={onRequestBulkDelete}
        onRequestBulkRestore={onRequestBulkRestore}
        onClearSelection={onClearSelection}
        onBulkTag={onBulkTag}
      />

      <ContactsList
        isWorkError={isWorkError}
        isWorkLoading={isWorkLoading}
        isWorkFetching={isWorkFetching}
        onRetryWork={onRetryWork}
        workContacts={workContacts}
        tableColumns={tableColumns}
        hasActiveFilters={hasActiveFilters}
        viewingDeleted={viewingDeleted}
        canWrite={canWrite}
        onClearFilters={onClearFilters}
        onShowDeletedChange={onShowDeletedChange}
        viewMode={viewMode}
        commonDirectoryProps={commonDirectoryProps}
        tableProps={tableProps}
        useServerWork={useServerWork}
        workPageData={workPageData}
        onPageChange={onPageChange}
      />
    </ModuleTierMotion>
  );
});
