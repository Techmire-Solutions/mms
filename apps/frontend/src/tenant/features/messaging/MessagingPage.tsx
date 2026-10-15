import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  mergeMessageTemplates,
  MESSAGING_MODULE_MANIFEST,
  type Message,
  type StandardMessagingRecipient as MessagingRecipient,
} from "@mms/shared";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { useModuleShortcuts } from "@/hooks/useModuleShortcuts";
import { usePersistedTabState } from "@/hooks/usePersistedTabState";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { useFilteredModuleTierTabs } from "@/tenant/hooks/useModuleTierTabs";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { MESSAGING_WORK_SEARCH_INPUT_ID } from "./components/MessagingListFilters";
import { useMessagingKeyboardShortcuts } from "./hooks/useMessagingKeyboardShortcuts";
import {
  invalidateMessagingQueries,
  useMessageTemplates,
  useMessagingMetrics,
  useMessagingMutations,
} from "./hooks/useMessaging";
import { MessagingPageView } from "./components/MessagingPageView";

export default function MessagingPage(): React.JSX.Element {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canRead, canWrite, canViewSetup, canEditSetup, canClearLogs } =
    useModulePermissions(MESSAGING_MODULE_MANIFEST);
  const tabParam = searchParams.get("tab") as "work" | "reports" | "setup" | null;
  const [activeTab, setActiveTab] = usePersistedTabState<"work" | "reports" | "setup">(
    "messaging_active_tab",
    tabParam && ["work", "reports", "setup"].includes(tabParam) ? tabParam : "work",
  );
  const [channelFilter, setChannelFilter] = useState<"all" | "sms" | "whatsapp" | "email">("all");
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [confirmClearLogsOpen, setConfirmClearLogsOpen] = useState(false);
  const [startingCampaign, setStartingCampaign] = useState(false);
  const { messagingTarget, openComposer, closeComposer } = useMessageComposerState();
  const templatesQuery = useMessageTemplates({ enabled: canRead });
  const metricsQuery = useMessagingMetrics({ enabled: canRead });
  const { deleteTemplate, clearLogs } = useMessagingMutations();
  const visibleTabs = useFilteredModuleTierTabs({
    canViewSetup: canViewSetup || canEditSetup,
    workLabelKey: "nav.messaging",
  });

  const handleTabChange = (tab: "work" | "reports" | "setup"): void => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    if (tab !== "work") next.set("tab", tab);
    else next.delete("tab");
    setSearchParams(next, { replace: true });
  };

  const templates = (() => mergeMessageTemplates(templatesQuery.templates))();
  const stats = (() => ({
    total: metricsQuery.data?.total ?? 0,
    sms: metricsQuery.data?.smsCount ?? 0,
    whatsapp: metricsQuery.data?.whatsappCount ?? 0,
    email: metricsQuery.data?.emailCount ?? 0,
  }))();

  const triggerCompose = useCallback(
    (
      channel: "sms" | "whatsapp" | "email",
      recipients: MessagingRecipient[] = [],
      initialMessage?: string,
      initialSubject?: string,
    ): void => {
      openComposer(channel, recipients, { initialMessage, initialSubject });
    },
    [openComposer],
  );

  const startCampaign = useCallback(
    (channel: "whatsapp" | "sms" | "email" = "whatsapp"): void => {
      if (startingCampaign) return;
      setStartingCampaign(true);
      try {
        triggerCompose(channel, []);
      } finally {
        setStartingCampaign(false);
      }
    },
    [startingCampaign, triggerCompose],
  );

  // URL Deep-Linking for auto-opening campaign launcher (?compose=whatsapp|sms|email)
  const composeParam = searchParams.get("compose");
  useEffect(() => {
    if (
      composeParam &&
      (composeParam === "whatsapp" || composeParam === "sms" || composeParam === "email") &&
      canWrite
    ) {
      void startCampaign(composeParam);
      const next = new URLSearchParams(searchParams);
      next.delete("compose");
      setSearchParams(next, { replace: true });
    }
  }, [composeParam, canWrite, startCampaign, searchParams, setSearchParams]);

  useMessagingKeyboardShortcuts({
    canWrite,
    hasActiveComposer: Boolean(messagingTarget),
    startCampaign,
  });

  useModuleShortcuts({
    searchInputId: MESSAGING_WORK_SEARCH_INPUT_ID,
    selectedCount: 0,
    hasActiveFilters: false,
    clearFilters: () => {},
    clearSelection: () => {},
    canWrite,
    showDeleted: false,
    onCreate: () => void startCampaign("whatsapp"),
    enabled: activeTab === "work",
  });

  const resend = (log: Message, recipient: MessagingRecipient): void => {
    triggerCompose(log.channel, [recipient], log.body, log.subject);
  };

  const handleBulkResend = (
    logs: Message[],
    recipients: MessagingRecipient[],
    targetChannel?: "whatsapp" | "sms" | "email",
  ): void => {
    if (logs.length === 0) return;
    const channel = targetChannel ?? logs[0]?.channel ?? "whatsapp";
    const initialMessage = logs.length === 1 ? logs[0]?.body : undefined;
    const initialSubject = logs.length === 1 ? logs[0]?.subject : undefined;
    triggerCompose(channel, recipients, initialMessage, initialSubject);
  };

  const confirmDeleteTemplate = async (): Promise<void> => {
    if (!deleteTemplateId) return;
    try {
      await deleteTemplate.mutateAsync(deleteTemplateId);
      setDeleteTemplateId(null);
      notify.success(t("common.delete"));
    } catch {
      // Mutation hook reports the failure.
    }
  };

  const confirmClearLogs = async (): Promise<void> => {
    try {
      await clearLogs.mutateAsync();
      setConfirmClearLogsOpen(false);
      notify.success(t("messaging.clearLogs"));
    } catch {
      // Mutation hook reports the failure.
    }
  };

  const handleDispatchSent = (): void => {
    void metricsQuery.refetch();
    invalidateMessagingQueries(queryClient);
  };

  const refetchMetrics = (): void => {
    void metricsQuery.refetch();
  };

  return (
    <MessagingPageView
      canRead={canRead}
      canWrite={canWrite}
      canViewSetup={canViewSetup}
      canEditSetup={canEditSetup}
      canClearLogs={canClearLogs}
      activeTab={activeTab}
      visibleTabs={visibleTabs}
      channelFilter={channelFilter}
      startingCampaign={startingCampaign}
      messagingTarget={messagingTarget}
      templates={templates}
      stats={stats}
      metricsQueryIsError={metricsQuery.isError}
      deleteTemplateId={deleteTemplateId}
      confirmClearLogsOpen={confirmClearLogsOpen}
      handleTabChange={handleTabChange}
      setChannelFilter={setChannelFilter}
      setDeleteTemplateId={setDeleteTemplateId}
      setConfirmClearLogsOpen={setConfirmClearLogsOpen}
      startCampaign={startCampaign}
      resend={resend}
      handleBulkResend={handleBulkResend}
      confirmDeleteTemplate={confirmDeleteTemplate}
      confirmClearLogs={confirmClearLogs}
      handleDispatchSent={handleDispatchSent}
      closeComposer={closeComposer}
      refetchMetrics={refetchMetrics}
    />
  );
}
