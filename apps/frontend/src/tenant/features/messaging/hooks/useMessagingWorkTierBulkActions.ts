import { useCallback, useState } from "react";
import type {
  Message,
  MessagingStatusFilter,
  StandardMessagingRecipient as MessagingRecipient,
} from "@mms/contracts";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { notify } from "@/lib/notify";
import { exportMessagingLogsFiltered } from "../lib/messagingReportsExport";

interface UseMessagingWorkTierBulkActionsParams {
  canWrite: boolean;
  channel: "all" | "sms" | "whatsapp" | "email";
  category: string;
  debouncedSearch: string;
  status: MessagingStatusFilter;
  queryStartDate: string | undefined;
  endDate: string;
  t: TranslationFunction;
  getRecipient: (contactId: string | number | null | undefined) => MessagingRecipient | null;
  getRecipientName: (contactId: string | number) => string;
  onResend: (log: Message, recipient: MessagingRecipient) => void;
  onBulkResend?: (
    logs: Message[],
    recipients: MessagingRecipient[],
    targetChannel?: "whatsapp" | "sms" | "email",
  ) => void;
}

export function useMessagingWorkTierBulkActions({
  canWrite,
  channel,
  category,
  debouncedSearch,
  status,
  queryStartDate,
  endDate,
  t,
  getRecipient,
  getRecipientName,
  onResend,
  onBulkResend,
}: UseMessagingWorkTierBulkActionsParams) {
  const [exporting, setExporting] = useState(false);

  const handleBulkResendLogs = useCallback(
    (targetLogs: Message[], targetChannel?: "whatsapp" | "sms" | "email"): void => {
      if (targetLogs.length === 0) return;
      const selectedRecipients: MessagingRecipient[] = targetLogs.map((log) => {
        const rec = getRecipient(log.contactId);
        return (
          rec ?? {
            id: log.contactId,
            name: getRecipientName(log.contactId),
            phone: "",
            email: "",
          }
        );
      });
      if (onBulkResend) {
        onBulkResend(targetLogs, selectedRecipients, targetChannel);
      } else {
        const first = targetLogs[0];
        if (first) onResend(first, selectedRecipients[0]!);
      }
    },
    [getRecipient, getRecipientName, onResend, onBulkResend],
  );

  const handleExportLogs = useCallback(async (): Promise<void> => {
    if (!canWrite || exporting) return;
    setExporting(true);
    try {
      await exportMessagingLogsFiltered({
        channel,
        category,
        debouncedSearch,
        status,
        startDate: queryStartDate,
        endDate,
        t,
      });
    } catch {
      notify.error(t("messaging.exportFailed"), { description: t("messaging.loadFailedHint") });
    } finally {
      setExporting(false);
    }
  }, [canWrite, exporting, channel, category, debouncedSearch, status, queryStartDate, endDate, t]);

  return {
    handleBulkResendLogs,
    handleExportLogs,
  };
}
