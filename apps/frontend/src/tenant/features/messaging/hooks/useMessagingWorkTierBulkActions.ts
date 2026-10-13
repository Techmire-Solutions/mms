import { useState } from "react";
import type { Message, StandardMessagingRecipient as MessagingRecipient } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { notify } from "@/lib/notify";
import { exportMessagingLogsFiltered } from "../lib/messagingReportsExport";

interface UseMessagingWorkTierBulkActionsParams {
  canWrite: boolean;
  channel: "all" | "sms" | "whatsapp" | "email";
  category: string;
  debouncedSearch: string;
  status: "all" | "sent" | "delivered" | "failed" | "skipped";
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

  const handleBulkResendLogs = (
    targetLogs: Message[],
    targetChannel?: "whatsapp" | "sms" | "email",
  ): void => {
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
  };

  const handleExportLogs = async (): Promise<void> => {
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
  };

  return {
    handleBulkResendLogs,
    handleExportLogs,
  };
}
