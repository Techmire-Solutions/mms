import { useState, useEffect } from "react";
import { usePersistedTabState } from "@/hooks/usePersistedTabState";
import { useModuleShortcuts } from "@/hooks/useModuleShortcuts";
import { useTranslation } from "@/hooks/useTranslation";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";
import { useFilteredModuleTierTabs } from "@/tenant/hooks/useModuleTierTabs";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import {
  HASANAT_MODULE_MANIFEST,
  resolveModuleTierTab,
  toMessagingRecipient,
  type Distribution,
} from "@mms/shared";
import { useHasanatDistributionColumnLayout } from "./useHasanatDistributionColumnLayout";
import { useHasanatRedemptionColumnLayout } from "./useHasanatRedemptionColumnLayout";
import {
  useHasanatDenoms,
  useHasanatBatches,
  useHasanatDistributions,
  useHasanatMutations,
} from "./useHasanatApi";
import { NotifiedMutationError } from "@/lib/notifiedMutationError";
import { useWorkSelection } from "@/hooks/useWorkSelection";
import { useHasanatDistributionTrashActions } from "@/tenant/features/hasanat/hooks/useHasanatDistributionTrashActions";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { notify } from "@/lib/notify";
import {
  getHasanatSetupTabs,
  getHasanatSubTabs,
  unwrapHasanatEnvelopes,
  formatHasanatMessageRecipients,
} from "./hasanatPageDescriptors";

export function useHasanatCardsPageController() {
  const { t } = useTranslation();
  const {
    canWrite,
    canDelete,
    canReports: canViewReports,
    canViewSetup,
    canEditSetup,
  } = useModulePermissions(HASANAT_MODULE_MANIFEST);
  const PAGE_TABS = useFilteredModuleTierTabs({
    canViewSetup,
    canViewReports,
    workLabelKey: "nav.hasanatCards",
  });
  const SETUP_TABS = getHasanatSetupTabs(t);
  const SUB_TABS = getHasanatSubTabs(t);
  const [activeTab, setActiveTab] = usePersistedTabState<string>("hasanat_active_tab", "work");
  const [activeSubTab, setActiveSubTab] = useState("overview");
  const [configSubTab, setConfigSubTab] = useState<string>("denominations");
  const [showDeleted, setShowDeleted] = useDirectoryTrashState();
  const [createDistributeKey, setCreateDistributeKey] = useState(0);
  const [activeDistribution, setActiveDistribution] = useState<Distribution | null>(null);

  const distributionSelection = useWorkSelection<string>();
  const { clearSelection: clearDistributionSelection } = distributionSelection;
  useEffect(() => {
    clearDistributionSelection();
  }, [showDeleted, clearDistributionSelection]);

  const denomsResult = useHasanatDenoms();
  const batchesResult = useHasanatBatches();
  const distributionsResult = useHasanatDistributions({ includeDeleted: showDeleted });
  const { denoms, batches, distributions } = unwrapHasanatEnvelopes(
    denomsResult.data?.body,
    batchesResult.data?.body,
    distributionsResult.data?.body,
  );

  const {
    replaceDenoms,
    replaceBatches,
    createDistribution,
    updateDistribution,
    deleteDistribution,
    restoreDistribution,
    bulkDeleteDistributions,
    bulkRestoreDistributions,
  } = useHasanatMutations();
  const [reportedFilteredCount, setFilteredCount] = useState(0);
  const distributionColumnLayout = useHasanatDistributionColumnLayout();
  const redemptionColumnLayout = useHasanatRedemptionColumnLayout();

  const { messagingTarget, openComposer, closeComposer, canWriteMessaging } =
    useMessageComposerState();

  const {
    handleDeleteDistribution,
    handleRestoreDistribution,
    handleBulkDelete: rawBulkDelete,
    handleBulkRestore: rawBulkRestore,
  } = useHasanatDistributionTrashActions({
    deleteDistribution,
    restoreDistribution,
    bulkDeleteDistributions,
    bulkRestoreDistributions,
  });

  const handleBulkDelete = async (ids: string[]) => {
    await rawBulkDelete(ids);
    clearDistributionSelection();
  };
  const handleBulkRestore = async (ids: string[]) => {
    await rawBulkRestore(ids);
    clearDistributionSelection();
  };

  const handleMessageDistributions = (
    channel: "sms" | "whatsapp" | "email",
    distList: Array<{ id: string; recipientName?: string; phone?: string; email?: string }>,
  ) => {
    if (!canWriteMessaging) return;
    const recipients = formatHasanatMessageRecipients(
      distList,
      t("hasanat.messaging.recipient"),
    ).map((r) => toMessagingRecipient(r));
    openComposer(channel, recipients);
  };

  const effectiveTab = resolveModuleTierTab(
    activeTab,
    PAGE_TABS.map((tab) => tab.id),
  );
  const effectiveSubTab = SUB_TABS.find((tab) => tab.id === activeSubTab)
    ? activeSubTab
    : "overview";
  const effectiveConfigTab =
    SETUP_TABS.find((tab) => tab.id === configSubTab)?.id ?? "denominations";

  // The distribute/redemptions lists report their own filtered count; every other sub-tab
  // shows the full loaded collection.
  const isCountedListTab = effectiveSubTab === "distribute" || effectiveSubTab === "redemptions";
  const filteredCount = isCountedListTab ? reportedFilteredCount : distributions.length;

  useModuleShortcuts({
    searchInputId: "hasanat-search-input",
    selectedCount: distributionSelection.selectedIds.length,
    hasActiveFilters: false,
    clearFilters: () => {},
    clearSelection: distributionSelection.clearSelection,
    canWrite,
    showDeleted,
    onCreate: () => {
      setActiveTab("work");
      setActiveSubTab("distribute");
      setCreateDistributeKey((key) => key + 1);
    },
    enabled: activeTab === "work",
  });

  const runHasanatSave = async (save: () => Promise<unknown>): Promise<void> => {
    try {
      await save();
    } catch (error: unknown) {
      if (!(error instanceof NotifiedMutationError)) {
        notify.error(t("hasanat.saveFailed"), {
          description: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  };

  const listLoadFailed = distributionsResult.isError;

  const openDistribute = () => {
    setActiveTab("work");
    setActiveSubTab("distribute");
    setCreateDistributeKey((key) => key + 1);
  };

  return {
    activeDistribution,
    setActiveDistribution,
    t,
    canWrite,
    canDelete,
    canEditSetup,
    PAGE_TABS,
    SETUP_TABS,
    SUB_TABS,
    activeTab,
    setActiveTab,
    effectiveTab,
    effectiveSubTab,
    effectiveConfigTab,
    showDeleted,
    setShowDeleted,
    createDistributeKey,
    filteredCount,
    setFilteredCount,
    distributionColumnLayout,
    redemptionColumnLayout,
    messagingTarget,
    closeComposer,
    canWriteMessaging,
    denoms,
    batches,
    distributions,
    listLoadFailed,
    setActiveSubTab,
    setConfigSubTab,
    handleMessageDistributions,
    handleDeleteDistribution,
    handleRestoreDistribution,
    handleBulkDelete,
    handleBulkRestore,
    runHasanatSave,
    replaceDenoms,
    replaceBatches,
    createDistribution,
    updateDistribution,
    openDistribute,
    distributionSelection,
    refetchDistributions: () => {
      void distributionsResult.refetch();
    },
  };
}
