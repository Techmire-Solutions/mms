import type { ComponentProps } from "react";
import type ContactsListCards from "@/tenant/features/contacts/components/ContactsListCards";
import type ContactsListDesktopTable from "@/tenant/features/contacts/components/ContactsListDesktopTable";
import type { useContactsDirectory } from "@/tenant/features/contacts/hooks/useContactsDirectory";
import type { useContactsMessagingActions } from "@/tenant/features/contacts/hooks/useContactsMessagingActions";
import type { useContactsPageActions } from "@/tenant/features/contacts/hooks/useContactsPageActions";
import type { useContactsPageOverlayState } from "@/tenant/features/contacts/hooks/useContactsPageOverlayState";
import type { useContactsSelectionTargets } from "@/tenant/features/contacts/hooks/useContactsSelectionTargets";
import type { ContactsColumnConfig } from "@/tenant/features/contacts/lib/contactTableTypes";
import type { ContactsWorkTierProps } from "@/tenant/features/contacts/lib/contactsWorkTierTypes";

type Directory = ReturnType<typeof useContactsDirectory>;
type Overlay = ReturnType<typeof useContactsPageOverlayState>;
type Messaging = ReturnType<typeof useContactsMessagingActions>;
type Actions = ReturnType<typeof useContactsPageActions>;
type SelectedTargets = ReturnType<typeof useContactsSelectionTargets>;

export interface BuildContactsWorkTierPropsParams {
  effectiveTab: string;
  directory: Directory;
  overlay: Pick<Overlay, "viewMode" | "setViewMode">;
  messaging: Pick<Messaging, "canWriteMessaging" | "handleWhatsApp" | "handleSms" | "handleEmail">;
  actions: Pick<Actions, "requestBulkDelete" | "requestBulkRestore" | "handleBulkTag">;
  selectedTargets: SelectedTargets;
  viewingDeleted: boolean;
  bulkActions: readonly string[];
  canExport: boolean;
  canWrite: boolean;
  canDelete: boolean;
  tableColumns: ContactsColumnConfig[];
  commonDirectoryProps: ComponentProps<typeof ContactsListCards>;
  tableProps: ComponentProps<typeof ContactsListDesktopTable>;
  handleBulkExport: () => void | Promise<void>;
  isExporting: boolean;
  handleShowDeletedChange: (next: boolean) => void;
  handleClearSelection: () => void;
  handleRetryWork: () => void;
}

export function buildContactsWorkTierProps({
  effectiveTab: _effectiveTab,
  directory,
  overlay,
  messaging,
  actions,
  selectedTargets,
  viewingDeleted,
  bulkActions,
  canExport,
  canWrite,
  canDelete,
  tableColumns,
  commonDirectoryProps,
  tableProps,
  handleBulkExport,
  isExporting,
  handleShowDeletedChange,
  handleClearSelection,
  handleRetryWork,
}: BuildContactsWorkTierPropsParams): ContactsWorkTierProps {
  const {
    search,
    setSearch,
    filterGender,
    setFilterGender,
    quickFilter,
    setQuickFilter,
    sortField,
    sortDir,
    handleSort,
    hasActiveFilters,
    activeFilterCount,
    clearFilters,
    selected,
    shownCount,
    isWorkError,
    isWorkLoading,
    isWorkFetching,
    workContacts,
    useServerWork,
    workPageData,
    setListPage,
  } = directory;

  return {
    search,
    onSearchChange: setSearch,
    filterGender,
    onGenderChange: setFilterGender,
    quickFilter,
    onQuickFilterChange: setQuickFilter,
    sortField,
    sortDir,
    onSort: handleSort,
    hasActiveFilters,
    activeFilterCount,
    onClearFilters: clearFilters,
    viewingDeleted,
    onShowDeletedChange: handleShowDeletedChange,
    canViewDeleted: canDelete,
    viewMode: overlay.viewMode,
    onViewModeChange: overlay.setViewMode,
    shownCount,
    selected,
    onClearSelection: handleClearSelection,
    selectedTargets,
    bulkActions,
    canWriteMessaging: messaging.canWriteMessaging,
    canExport,
    canDelete,
    onWhatsApp: messaging.handleWhatsApp,
    onSms: messaging.handleSms,
    onEmail: messaging.handleEmail,
    onBulkExport: handleBulkExport,
    isExporting,
    onRequestBulkDelete: actions.requestBulkDelete,
    onRequestBulkRestore: actions.requestBulkRestore,
    onBulkTag: actions.handleBulkTag,
    isWorkError,
    isWorkLoading,
    isWorkFetching,
    onRetryWork: handleRetryWork,
    workContacts,
    tableColumns,
    commonDirectoryProps,
    tableProps,
    useServerWork,
    workPageData,
    onPageChange: setListPage,
    canWrite,
  };
}
