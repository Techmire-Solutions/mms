import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MESSAGE_LOGS_DEFAULT_PAGE_SIZE,
  type Message,
  type StandardMessagingRecipient as MessagingRecipient,
} from "@mms/shared";
import { useDescriptorFilterChips } from "@/components/common/useDescriptorFilterChips";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import { useMessageLogs } from "@/hooks/useMessaging";
import { useMessagingHistoryColumnLayout } from "./useMessagingColumnLayouts";
import { useMessagingEntityDescriptor } from "./useMessagingEntityDescriptor";
import { useMessagingPageOptions } from "./useMessagingPageOptions";
import { useMessagingWorkFilters } from "./useMessagingWorkFilters";
import { useMessagingWorkTierBulkActions } from "./useMessagingWorkTierBulkActions";
import { useMessagingWorkTierKeyboardNav } from "./useMessagingWorkTierKeyboardNav";
import { useMessagingWorkTierSelection } from "./useMessagingWorkTierSelection";
import { useMessagingWorkTierDetail } from "./useMessagingWorkTierDetail";

export interface MessagingWorkTierControllerProps {
  canWrite: boolean;
  onClearLogsRequest: () => void;
  onResend: (log: Message, recipient: MessagingRecipient) => void;
  onBulkResend?: (
    logs: Message[],
    recipients: MessagingRecipient[],
    targetChannel?: "whatsapp" | "sms" | "email",
  ) => void;
  channel?: "all" | "sms" | "whatsapp" | "email";
  onChannelChange?: (channel: "all" | "sms" | "whatsapp" | "email") => void;
  /** Lets the page header use the single filtered export path owned by the work tier. */
  onExportLogsRegister?: (handler: (() => Promise<void>) | null) => void;
}

export function useMessagingWorkTierController({
  canWrite,
  onResend,
  onBulkResend,
  channel: controlledChannel,
  onChannelChange: controlledOnChannelChange,
  onExportLogsRegister,
}: MessagingWorkTierControllerProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { categorySelectOptions, channelSelectOptions, statusOptions, logStatusConfig } =
    useMessagingPageOptions();
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();

  const filters = useMessagingWorkFilters({
    searchParams,
    setSearchParams,
    controlledChannel,
    controlledOnChannelChange,
  });

  const logsQuery = useMessageLogs({
    channel: filters.channel,
    category: filters.category,
    search: filters.debouncedSearch,
    status: filters.status,
    startDate: filters.queryStartDate,
    endDate: filters.queryEndDate,
    page: filters.logsPage,
    pageSize: MESSAGE_LOGS_DEFAULT_PAGE_SIZE,
  });

  const {
    activeDetailLog,
    activeRecipient,
    getRecipient,
    getRecipientName,
    handleOpenDetail,
    handleCloseDetail,
    handleResendLog,
  } = useMessagingWorkTierDetail({
    logs: logsQuery.logs,
    onResend,
    t,
  });

  const {
    columnRegistry,
    isColumnVisible,
    getColumnWidth,
    setColumnWidth,
    updateUserColumnLayout,
    customizerLabels,
  } = useMessagingHistoryColumnLayout();

  const {
    selectedById,
    setSelectedById,
    allVisibleSelected,
    someVisibleSelected,
    selectedList,
    selectedCount,
    toggleLog,
    toggleAllVisible,
  } = useMessagingWorkTierSelection({ logs: logsQuery.logs });

  const selectedCountLabel = t("messaging.selectedCount", { count: selectedCount });
  const pageCountLabel = formatDirectoryPageCountLabel(logsQuery.logs.length, t, {
    singular: "messaging.item.recipient",
    plural: "messaging.item.recipients",
  });

  const { focusedIndex } = useMessagingWorkTierKeyboardNav({
    logs: logsQuery.logs,
    toggleLog,
    handleOpenDetail,
  });

  const { handleBulkResendLogs, handleExportLogs } = useMessagingWorkTierBulkActions({
    canWrite,
    channel: filters.channel,
    category: filters.category,
    debouncedSearch: filters.debouncedSearch,
    status: filters.status,
    queryStartDate: filters.queryStartDate,
    endDate: filters.endDate,
    t,
    getRecipient,
    getRecipientName,
    onResend,
    onBulkResend,
  });

  const handleBulkResend = (targetChannel?: "whatsapp" | "sms" | "email"): void => {
    handleBulkResendLogs(selectedList, targetChannel);
  };

  useEffect(() => {
    onExportLogsRegister?.(handleExportLogs);
    return () => onExportLogsRegister?.(null);
  }, [onExportLogsRegister, handleExportLogs]);

  const failedLogs = logsQuery.logs.filter((l: Message) => l.status === "failed");

  const handleFilterContact = (contactName: string): void => {
    filters.setSearch(contactName);
    filters.setLogsPage(1);
  };

  const descriptor = useMessagingEntityDescriptor();
  // Keyboard-focus identity for visible j/k focus rendering (class + scroll target).
  const focusedLogId = focusedIndex >= 0 ? (logsQuery.logs[focusedIndex]?.id ?? null) : null;
  const activeFilters = useMemo(
    () => ({
      search: filters.debouncedSearch.trim() || undefined,
      channel: filters.channel !== "all" ? filters.channel : undefined,
      status: filters.status !== "all" ? filters.status : undefined,
      category: filters.category !== "all" ? filters.category : undefined,
      startDate: filters.queryStartDate || undefined,
      endDate: filters.endDate || undefined,
    }),
    [
      filters.debouncedSearch,
      filters.channel,
      filters.status,
      filters.category,
      filters.queryStartDate,
      filters.endDate,
    ],
  );

  const onRemoveChip = useCallback(
    (fieldKey: string) => {
      if (fieldKey === "search") {
        filters.setSearch("");
        return;
      }
      if (fieldKey === "channel") {
        filters.setChannel("all");
        return;
      }
      if (fieldKey === "status") {
        filters.setStatus("all");
        return;
      }
      if (fieldKey === "category") {
        filters.setCategory("all");
        return;
      }
      if (fieldKey === "startDate") {
        filters.setStartDate("");
        return;
      }
      if (fieldKey === "endDate") {
        filters.setEndDate("");
      }
    },
    [filters],
  );

  const filterChips = useDescriptorFilterChips(descriptor, activeFilters, onRemoveChip);

  return {
    t,
    viewMode,
    setViewMode,
    channelSelectOptions,
    statusOptions,
    categorySelectOptions,
    ...filters,
    columnRegistry,
    updateUserColumnLayout,
    customizerLabels,
    logsQuery,
    selectedById,
    setSelectedById,
    allVisibleSelected,
    someVisibleSelected,
    selectedCount,
    selectedCountLabel,
    pageCountLabel,
    toggleLog,
    toggleAllVisible,
    handleResendLog,
    handleOpenDetail,
    handleCloseDetail,
    handleBulkResend,
    handleBulkResendLogs,
    handleExportLogs,
    focusedLogId,
    failedLogs,
    hasBulkResend: Boolean(onBulkResend),
    activeDetailLog,
    activeRecipient,
    handleFilterContact,
    filterChips,
    logStatusConfig,
    getRecipientName,
    isColumnVisible,
    getColumnWidth,
    setColumnWidth,
  };
}
