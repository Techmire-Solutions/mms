import { useCallback } from "react";
import { CONTACTS_MODULE_MANIFEST } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { useContactColumns } from "@mms/mod-contacts/frontend/tenant/components/ContactConfigContext";
import { useGoogleContactsOAuthListener } from "@mms/mod-contacts/frontend/tenant/lib/googleContactsOAuthListener";
import { useModuleTierPageNav } from "./useModuleTierPageNav.js";
import { useContactsConflictPanel } from "./useContactsConflictPanel.js";
import { useContactsCrudActions } from "./useContactsCrudActions.js";
import { useContactsDirectory } from "./useContactsDirectory.js";
import { useContactsExportActions } from "./useContactsExportActions.js";
import { useContactsKeyboardShortcuts } from "./useContactsKeyboardShortcuts.js";
import { useContactsMessagingActions } from "./useContactsMessagingActions.js";
import { useContactsPageActions } from "./useContactsPageActions.js";
import { useContactsPageDirectoryProps } from "./useContactsPageDirectoryProps.js";
import { useContactsPageOverlayProps } from "./useContactsPageOverlayProps.js";
import { useContactsPageOverlayState } from "./useContactsPageOverlayState.js";
import { useContactsPageTabPanelProps } from "./useContactsPageTabPanelProps.js";
import { useContactsSelectionTargets } from "./useContactsSelectionTargets.js";

/**
 * Contacts page orchestrator — composes domain slices and builds view prop bags
 * without a flatten→rebuild intermediate.
 */
export function useContactsPageController() {
  const {
    canRead,
    canWrite,
    canDelete,
    canExport,
    canEditSetup,
    visibleTabs: visibleTopTabs,
    setActiveTab,
    effectiveTab,
  } = useModuleTierPageNav({
    manifest: CONTACTS_MODULE_MANIFEST,
    workLabelKey: "nav.contacts",
    storageKey: "contacts_active_tab",
  });
  const bulkActions = CONTACTS_MODULE_MANIFEST.work.bulkActions;
  const tableColumns = useContactColumns();
  const { t } = useTranslation();
  const crud = useContactsCrudActions();
  const { handleError } = crud;

  const overlay = useContactsPageOverlayState();
  const { pendingCount, conflictCount, flushing, flush, openConflictReview } =
    useContactsConflictPanel(overlay.setConflictPanelOpen);
  const messaging = useContactsMessagingActions();

  const handleGoogleContactsOAuth = useCallback(() => {
    setActiveTab("setup");
  }, [setActiveTab]);

  useGoogleContactsOAuthListener(handleGoogleContactsOAuth);

  const directory = useContactsDirectory({
    effectiveTab,
    setActiveTab,
    editContact: overlay.editContact,
    viewContact: overlay.viewContact,
  });

  const actions = useContactsPageActions({
    canWrite,
    canDelete,
    workContacts: directory.workContacts,
    linkContacts: directory.allContactsForLinks,
    selected: directory.selected,
    setSelected: directory.setSelected,
    shownCount: directory.shownCount,
    editContact: overlay.editContact,
    setEditContact: overlay.setEditContact,
    setShowForm: overlay.setShowForm,
    setShowDuplicates: overlay.setShowDuplicates,
    openingDuplicates: overlay.openingDuplicates,
    setOpeningDuplicates: overlay.setOpeningDuplicates,
    deleteTarget: overlay.deleteTarget,
    setDeleteTarget: overlay.setDeleteTarget,
    setBulkDeleteOpen: overlay.setBulkDeleteOpen,
    setBulkRestoreOpen: overlay.setBulkRestoreOpen,
    crud,
  });

  const { handleExportCSV, handleBulkExport, isExporting } = useContactsExportActions({
    canExport,
    // Debounced: the export must cover exactly what the visible list was filtered by.
    search: directory.debouncedSearch,
    filterGender: directory.filterGender,
    sortField: directory.sortField,
    sortDir: directory.sortDir,
    quickFilter: directory.quickFilter,
    viewingDeleted: directory.viewingDeleted,
    hasActiveFilters: directory.hasActiveFilters,
    selected: directory.selected,
    handleError,
    t,
  });

  const selectedTargets = useContactsSelectionTargets({
    selected: directory.selected,
    workContacts: directory.workContacts,
  });

  const { setImportOpen, setCsvImportOpen } = overlay;
  /** Import writes contacts; a reader without `contacts.write` must not open the dialog. */
  const handleOpenImport = useCallback(() => {
    if (canWrite) setImportOpen(true);
  }, [canWrite, setImportOpen]);

  const handleOpenCsvImport = useCallback(() => {
    if (canWrite) setCsvImportOpen(true);
  }, [canWrite, setCsvImportOpen]);

  useContactsKeyboardShortcuts({
    selectedCount: directory.selected.length,
    hasActiveFilters: directory.hasActiveFilters,
    clearFilters: directory.clearFilters,
    clearSelection: directory.clearSelection,
    canWrite,
    viewingDeleted: directory.viewingDeleted,
    onCreate: actions.handleCreateContact,
  });

  const viewingDeleted = directory.viewingDeleted;

  const { messagingHandlers, commonDirectoryProps, tableProps } = useContactsPageDirectoryProps({
    directory,
    overlay,
    messaging,
    actions,
    viewingDeleted,
    canWrite,
    canDelete,
    tableColumns,
  });

  const tabPanelProps = useContactsPageTabPanelProps({
    effectiveTab,
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
    canEditSetup,
    tableColumns,
    commonDirectoryProps,
    tableProps,
    handleBulkExport,
    isExporting,
    onOpenImport: handleOpenImport,
  });

  const overlayProps = useContactsPageOverlayProps({
    canWrite,
    canDelete,
    overlay,
    messaging,
    actions,
    messagingHandlers,
    allContactsForLinks: directory.allContactsForLinks,
    selectedCount: directory.selected.length,
  });

  return {
    t,
    visibleTopTabs,
    effectiveTab,
    setActiveTab,
    canExport,
    canRead,
    canWrite,
    viewingDeleted,
    openingDuplicates: overlay.openingDuplicates,
    isExporting,
    handleOpenDuplicates: actions.handleOpenDuplicates,
    handleExportCSV,
    handleOpenImport,
    handleOpenCsvImport,
    handleNew: actions.handleCreateContact,
    shownCount: directory.shownCount,
    pendingCount,
    conflictCount,
    flushing,
    flush,
    openConflictReview,
    conflictPanelOpen: overlay.conflictPanelOpen,
    setConflictPanelOpen: overlay.setConflictPanelOpen,
    tabPanelProps,
    overlayProps,
  };
}
