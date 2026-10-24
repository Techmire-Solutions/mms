import { useRef, useState } from "react";
import {
  personalizeMessage,
  type MessageTemplate,
  type StandardMessagingRecipient as MessagingRecipient,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { useMessagingMutations } from "@/hooks/useMessaging";
import {
  executeRecipientSend,
  findUnknownTokens,
  saveDispatchHistory,
  validateMessagingRecipients,
  SPEED_DELAYS,
  type DispatchSpeed,
  type SentDispatchRecord,
  type ValidatedMessagingRecipient,
} from "./messageComposerDispatchService";
import { dispatchViaServerGateway } from "./messageComposerServerGateway";
import { formatUnknownTokensLabel } from "./messageComposerTokenErrors";

export type { DispatchSpeed, ValidatedMessagingRecipient };

interface UseMessageComposerDispatchParams {
  channel: "sms" | "whatsapp" | "email";
  recipients: MessagingRecipient[];
  activeTemplates: MessageTemplate[];
  templateId: string;
  subject: string;
  message: string;
  onClose: () => void;
  onSent?: (sent: { recipientId: string | number; body: string }[]) => void;
  madrasaName?: string;
  user?: unknown;
  useServerGateway?: boolean;
  defaultDispatchSpeed?: DispatchSpeed;
}

export function useMessageComposerDispatch({
  channel,
  recipients,
  activeTemplates,
  templateId,
  subject,
  message,
  onClose,
  onSent,
  madrasaName,
  user,
  useServerGateway,
  defaultDispatchSpeed,
}: UseMessageComposerDispatchParams) {
  const { t } = useTranslation();
  const { recordDispatches, dispatchServerSms, dispatchServerEmail, dispatchServerWhatsApp } =
    useMessagingMutations();
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dispatchSpeed, setDispatchSpeed] = useState<DispatchSpeed>(
    defaultDispatchSpeed ?? "normal",
  );
  const [dispatchProgress, setDispatchProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [pendingAudit, setPendingAudit] = useState<SentDispatchRecord[] | null>(null);
  const cancelRef = useRef(false);
  const pausedRef = useRef(false);
  const auditSavedCountRef = useRef(0);
  const auditIdempotencyKeyRef = useRef<string | null>(null);
  pausedRef.current = isPaused;

  const personalizeOptions = { madrasaName: madrasaName || undefined };
  const validatedRecipients = validateMessagingRecipients(recipients, channel);
  const eligibleRecipients = validatedRecipients.filter((recipient) => recipient.isValid);
  const skippedRecipients = validatedRecipients.filter((recipient) => !recipient.isValid);

  const executeSend = (recipient: MessagingRecipient, text: string): boolean =>
    executeRecipientSend({
      channel,
      recipient,
      text,
      subject,
      personalizeOptions,
      defaultSubject: t("messaging.defaultSubject"),
    });

  const saveHistory = (sentRecords: SentDispatchRecord[]): Promise<boolean> =>
    saveDispatchHistory({
      sentRecords,
      user,
      activeTemplates,
      templateId,
      channel,
      subject,
      recordDispatches,
      auditSavedCountRef,
      auditIdempotencyKeyRef,
    });

  const sendAll = async (): Promise<void> => {
    if (opening || saving) return;

    if (pendingAudit) {
      setSaving(true);
      try {
        if (!(await saveHistory(pendingAudit))) return;
        const completed = pendingAudit;
        setPendingAudit(null);
        auditSavedCountRef.current = 0;
        onSent?.(completed);
        onClose();
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!eligibleRecipients.length || !message.trim()) return;
    const unknownTokens = findUnknownTokens(channel, subject, message);
    if (unknownTokens.length > 0) {
      notify.error(
        t("messaging.unknownTokens", {
          tokens: formatUnknownTokensLabel(unknownTokens),
        }),
      );
      return;
    }
    const sentRecords: SentDispatchRecord[] = [];
    const record = (recipient: MessagingRecipient, success: boolean): void => {
      sentRecords.push({
        recipientId: recipient.id,
        body: personalizeMessage(message, recipient, personalizeOptions),
        subject:
          channel === "email"
            ? personalizeMessage(
                subject || t("messaging.defaultSubject"),
                recipient,
                personalizeOptions,
              )
            : undefined,
        status: success ? "sent" : "failed",
      });
    };

    setSaving(true);
    auditSavedCountRef.current = 0;
    auditIdempotencyKeyRef.current = null;
    try {
      if (useServerGateway) {
        setOpening(true);
        const activeTemplate = activeTemplates.find((template) => template.id === templateId);
        await dispatchViaServerGateway({
          channel,
          eligibleRecipients,
          message,
          subject,
          category: activeTemplate?.category || "general",
          personalizeOptions,
          dispatchServerSms,
          dispatchServerEmail,
          dispatchServerWhatsApp,
          onSent,
          onClose,
          t,
        });
        return;
      }

      if (eligibleRecipients.length === 1) {
        record(eligibleRecipients[0], executeSend(eligibleRecipients[0], message));
      } else {
        setOpening(true);
        setIsPaused(false);
        cancelRef.current = false;
        for (let index = 0; index < eligibleRecipients.length; index += 1) {
          if (cancelRef.current) break;
          while (pausedRef.current && !cancelRef.current) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
          if (cancelRef.current) break;
          const recipient = eligibleRecipients[index];
          record(recipient, executeSend(recipient, message));
          setDispatchProgress({ current: index + 1, total: eligibleRecipients.length });
          if (index < eligibleRecipients.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, SPEED_DELAYS[dispatchSpeed]));
          }
        }
        setOpening(false);
        setDispatchProgress(null);
      }

      if (sentRecords.length === 0) return;
      if (!(await saveHistory(sentRecords))) {
        setPendingAudit(sentRecords);
        return;
      }
      onSent?.(sentRecords);
      onClose();
    } finally {
      setOpening(false);
      setDispatchProgress(null);
      setSaving(false);
    }
  };

  const cancelDispatch = (): void => {
    cancelRef.current = true;
  };

  return {
    personalizeOptions,
    validatedRecipients,
    eligibleRecipients,
    skippedRecipients,
    opening,
    saving,
    pendingAudit: Boolean(pendingAudit),
    dispatchSpeed,
    setDispatchSpeed,
    dispatchProgress,
    isPaused,
    setIsPaused,
    executeSend,
    sendAll,
    cancelDispatch,
  };
}
