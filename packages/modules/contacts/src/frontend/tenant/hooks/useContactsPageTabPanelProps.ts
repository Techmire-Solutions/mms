import { useCallback, useMemo, type ComponentProps } from "react";
import type ContactsListCards from "../components/ContactsListCards";
import type ContactsListDesktopTable from "../components/ContactsListDesktopTable";
import type { useContactsDirectory } from "./useContactsDirectory.js";
import type { useContactsMessagingActions } from "./useContactsMessagingActions.js";
import type { useContactsPageActions } from "./useContactsPageActions.js";
import type { useContactsPageOverlayState } from "./useContactsPageOverlayState.js";
import type { useContactsSelectionTargets } from "./useContactsSelectionTargets.js";
import type { ContactsColumnConfig } from "../lib/contactTableTypes";
import { buildContactsWorkTierProps } from "./contactsWorkTierPropsBuilder.js";

type Directory = ReturnType<typeof useContactsDirectory>;
type Overlay = ReturnType<typeof useContactsPageOverlayState>;
type Messaging = ReturnType<typeof useContactsMessagingActions>;
type Actions = ReturnType<typeof useContactsPageActions>;
type SelectedTargets = ReturnType<typeof useContactsSelectionTargets>;

/** Maps directory / overlay slices into ContactsPageTabPanelProps. */
export function useContactsPageTabPanelProps({
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
  onOpenImport,
}: {
  effectiveTab: string;
  directory: Directory;
  overlay: Pick<Overlay, "viewMode" | "setViewMode">;
  messaging: Pick<Messaging, "canWriteMessaging" | "handleWhatsApp" | "handleSms" | "handleEmail">;
  actions: Pick<
    Actions,
    | "requestBulkDelete"
    | "requestBulkRestore"
    | "handleImport"
    | "handleBulkTag"
    | "handleCreateContact"
  >;
  onOpenImport?: () => void;
  selectedTargets: SelectedTargets;
  viewingDeleted: boolean;
  bulkActions: readonly string[];
  canExport: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canEditSetup: boolean;
  tableColumns: ContactsColumnConfig[];
  commonDirectoryProps: ComponentProps<typeof ContactsListCards>;
  tableProps: ComponentProps<typeof ContactsListDesktopTable>;
  handleBulkExport: () => void | Promise<void>;
  isExporting: boolean;
}) {
  const { setViewingDeleted, setSelected, refetchWork } = directory;

  const handleShowDeletedChange = useCallback(
    (next: boolean) => {
      setViewingDeleted(next);
      setSelected([]);
    },
    [setViewingDeleted, setSelected],
  );

  const handleClearSelection = useCallback(() => {
    setSelected([]);
  }, [setSelected]);

  const handleRetryWork = useCallback(() => {
    void refetchWork();
  }, [refetchWork]);

  const workTierProps = useMemo(
    () =>
      buildContactsWorkTierProps({
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
        tableColumns,
        commonDirectoryProps,
        tableProps,
        handleBulkExport,
        isExporting,
        handleShowDeletedChange,
        handleClearSelection,
        handleRetryWork,
        onOpenImport,
      }),
    [
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
      tableColumns,
      commonDirectoryProps,
      tableProps,
      handleBulkExport,
      isExporting,
      handleShowDeletedChange,
      handleClearSelection,
      handleRetryWork,
      onOpenImport,
    ],
  );

  const setupTierProps = useMemo(
    () => ({
      canWrite,
      canEditSetup,
      onImport: actions.handleImport,
    }),
    [canWrite, canEditSetup, actions.handleImport],
  );

  return { workTierProps, setupTierProps };
}
