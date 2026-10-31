import { useState, useEffect } from "react";
import { usePersistedTabState } from "@/hooks/usePersistedTabState";
import { useModuleShortcuts } from "@/hooks/useModuleShortcuts";
import { useTranslation } from "@/hooks/useTranslation";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";
import { useFilteredModuleTierTabs } from "@/tenant/hooks/useModuleTierTabs";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import {
  OBLIGATIONS_MODULE_MANIFEST,
  resolveModuleTierTab,
  type AppTranslationKey,
  type ObligationCollection,
} from "@mms/shared";
import {
  useObligationsTypesCollection,
  useObligationsMujtahidsCollection,
  useObligationsRepsCollection,
  useObligationsWakalaCollection,
  useObligationsDistributionsCollection,
  useObligationsCollections,
  useObligationsCollectionsCollection,
  useObligationsMutations,
} from "@/tenant/features/obligations/hooks/useObligationsApi";
import { useObligationColumnLayout } from "@/tenant/features/obligations/hooks/useObligationColumnLayout";
import { useWorkSelection } from "@/hooks/useWorkSelection";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { useObligationsPageActions } from "./useObligationsPageActions";

const SETUP_TAB_LABEL_KEYS: Record<
  (typeof OBLIGATIONS_MODULE_MANIFEST.setupSubTabs)[number],
  AppTranslationKey
> = {
  wakala: "obligations.wakala",
  numbering: "obligations.setup.tabs.numbering",
  invoice_template: "obligations.setup.tabs.invoiceTemplate",
};

export function useObligationsPageController() {
  const { t } = useTranslation();
  const {
    canWrite,
    canDelete,
    canReports: canViewReports,
    canViewSetup,
    canEditSetup,
  } = useModulePermissions(OBLIGATIONS_MODULE_MANIFEST);
  const PAGE_TABS = useFilteredModuleTierTabs({
    canViewSetup,
    canViewReports,
    workLabelKey: "nav.obligations",
  });
  const CONFIG_SUB_TABS = (() =>
    OBLIGATIONS_MODULE_MANIFEST.setupSubTabs.map((id) => ({
      id,
      label: t(SETUP_TAB_LABEL_KEYS[id]),
    })))();
  const [activeTab, setActiveTab] = usePersistedTabState<string>("obligations_active_tab", "work");
  const [activeConfigTab, setActiveConfigTab] = useState("wakala");
  const [showDeleted, setShowDeleted] = useDirectoryTrashState();

  const collectionSelection = useWorkSelection<string>();
  const { clearSelection: clearCollectionSelection } = collectionSelection;
  useEffect(() => {
    clearCollectionSelection();
  }, [showDeleted, clearCollectionSelection]);

  const obligationTypes = useObligationsTypesCollection();
  const mujtahids = useObligationsMujtahidsCollection();
  const reps = useObligationsRepsCollection();
  const wakalaTypes = useObligationsWakalaCollection();
  const distributions = useObligationsDistributionsCollection();
  const collectionsResult = useObligationsCollections({ includeDeleted: showDeleted });
  const collections = useObligationsCollectionsCollection({ includeDeleted: showDeleted });

  const {
    replaceTypes,
    replaceMujtahids,
    replaceReps,
    replaceWakala,
    replaceDistributions,
    replaceCollections,
    deleteCollection,
    restoreCollection,
    bulkDeleteCollections,
    bulkRestoreCollections,
  } = useObligationsMutations();

  const [showForm, setShowForm] = useState(false);
  const [viewCollection, setViewCollection] = useState<ObligationCollection | null>(null);
  const [voucherCollection, setVoucherCollection] = useState<ObligationCollection | null>(null);
  const [reportedFilteredCount, setFilteredCount] = useState<number | null>(null);
  const columnLayout = useObligationColumnLayout();

  const { messagingTarget, openComposer, closeComposer, canWriteMessaging } =
    useMessageComposerState();

  const {
    handleMessageCollections,
    handleSaveCollection,
    handleDelete,
    handleRestore,
    handleBulkDelete,
    handleBulkRestore,
    runSetupSave,
  } = useObligationsPageActions({
    t,
    collections,
    replaceCollections,
    deleteCollection,
    restoreCollection,
    bulkDeleteCollections,
    bulkRestoreCollections,
    clearCollectionSelection,
    setShowForm,
    openComposer,
    canWriteMessaging,
  });

  // The collections list reports its own filtered count; until it does, fall back to the
  // full loaded collection.
  const filteredCount = reportedFilteredCount ?? collections.length;

  useModuleShortcuts({
    searchInputId: "obligations-search-input",
    selectedCount: collectionSelection.selectedIds.length,
    hasActiveFilters: false,
    clearFilters: () => {},
    clearSelection: collectionSelection.clearSelection,
    canWrite,
    showDeleted,
    onCreate: () => {
      setActiveTab("work");
      setShowForm(true);
    },
    enabled: activeTab === "work",
  });

  const effectiveTab = resolveModuleTierTab(
    activeTab,
    PAGE_TABS.map((tab) => tab.id),
  );
  const effectiveConfigTab = CONFIG_SUB_TABS.find((tab) => tab.id === activeConfigTab)
    ? activeConfigTab
    : "wakala";
  const listLoadFailed = collectionsResult.isError;

  return {
    t,
    canWrite,
    canDelete,
    canEditSetup,
    PAGE_TABS,
    CONFIG_SUB_TABS,
    activeTab,
    setActiveTab,
    effectiveTab,
    effectiveConfigTab,
    showDeleted,
    setShowDeleted,
    showForm,
    setShowForm,
    viewCollection,
    setViewCollection,
    voucherCollection,
    setVoucherCollection,
    filteredCount,
    setFilteredCount,
    columnLayout,
    messagingTarget,
    closeComposer,
    canWriteMessaging,
    obligationTypes,
    mujtahids,
    reps,
    wakalaTypes,
    distributions,
    collections,
    listLoadFailed,
    handleMessageCollections,
    handleSaveCollection,
    handleDelete,
    handleRestore,
    handleBulkDelete,
    handleBulkRestore,
    runSetupSave,
    replaceTypes,
    replaceMujtahids,
    replaceReps,
    replaceWakala,
    replaceDistributions,
    setActiveConfigTab,
    collectionSelection,
    refetchCollections: () => {
      void collectionsResult.refetch();
    },
  };
}
