import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { Message, StandardMessagingRecipient as MessagingRecipient } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { useMessagingRecipientsByIds } from "../hooks/useMessagingContactsByIds";

export interface UseMessagingWorkTierDetailOptions {
  logs: Message[];
  onResend: (log: Message, recipient: MessagingRecipient) => void;
  t: TranslationFunction;
}

export function useMessagingWorkTierDetail({
  logs,
  onResend,
  t,
}: UseMessagingWorkTierDetailOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlLogId = searchParams.get("logId");

  const activeDetailLog = useMemo(() => {
    if (!urlLogId || logs.length === 0) return null;
    return logs.find((l: Message) => String(l.id) === urlLogId) || null;
  }, [urlLogId, logs]);

  const handleOpenDetail = useCallback(
    (log: Message): void => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("logId", String(log.id));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleCloseDetail = useCallback((): void => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("logId");
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const contactIds = useMemo(() => logs.map((log: Message) => log.contactId), [logs]);
  const { getRecipient } = useMessagingRecipientsByIds(contactIds);

  const getRecipientName = useCallback(
    (contactId: string | number): string => {
      const recipient = getRecipient(contactId);
      return recipient?.name || t("messaging.contactFallback", { id: contactId });
    },
    [getRecipient, t],
  );

  const handleResendLog = useCallback(
    (log: Message): void => {
      const recipient = getRecipient(log.contactId);
      onResend(
        log,
        recipient ?? {
          id: log.contactId,
          name: getRecipientName(log.contactId),
          phone: "",
          email: "",
        },
      );
    },
    [getRecipient, getRecipientName, onResend],
  );

  const activeRecipient = useMemo(() => {
    if (!activeDetailLog) return null;
    return getRecipient(activeDetailLog.contactId);
  }, [activeDetailLog, getRecipient]);

  return {
    activeDetailLog,
    activeRecipient,
    getRecipient,
    getRecipientName,
    handleOpenDetail,
    handleCloseDetail,
    handleResendLog,
  };
}
