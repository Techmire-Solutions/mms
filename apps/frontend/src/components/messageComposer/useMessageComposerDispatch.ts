import { useEffect, useRef, useState } from "react";
import {
  type MessageTemplate,
  type StandardMessagingRecipient as MessagingRecipient,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { useMessagingMutations } from "@/hooks/useMessaging";
import {
  buildSentDispatchRecord,
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
import { resolveSubmissionKey, type SubmissionKeyState } from "./messageComposerSubmissionKey";
import { notifyUnknownTokenErrors } from "./messageComposerTokenErrors";

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
  const submissionKeyRef = useRef<SubmissionKeyState | null>(null);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

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

  /**
   * Submission idempotency key: a retry of the same composition reuses it (the
   * server dedupes the partial delivery), while a new — or already completed —
   * submission mints a fresh one so a deliberate repeat campaign still sends.
   */
  const submissionKeyFor = (targetRecipients: ValidatedMessagingRecipient[]): string => {
    const activeTemplate = activeTemplates.find((template) => template.id === templateId);
    const digest = JSON.stringify({
      channel,
      message,
      subject,
      category: activeTemplate?.category ?? "general",
      recipients: targetRecipients.map((recipient) => String(recipient.id)),
    });
    const resolved = resolveSubmissionKey(submissionKeyRef.current, digest, () =>
      crypto.randomUUID(),
    );
    submissionKeyRef.current = resolved.state;
    return resolved.key;
  };

  const markSubmissionCompleted = (): void => {
    if (submissionKeyRef.current) {
      submissionKeyRef.current = { ...submissionKeyRef.current, completed: true };
    }
  };

  const dispatchViaGateway = async (
    targetRecipients: ValidatedMessagingRecipient[],
  ): Promise<void> => {
    const activeTemplate = activeTemplates.find((template) => template.id === templateId);
    await dispatchViaServerGateway({
      channel,
      eligibleRecipients: targetRecipients,
      message,
      subject,
      category: activeTemplate?.category || "general",
      idempotencyKey: submissionKeyFor(targetRecipients),
      personalizeOptions,
      dispatchServerSms,
      dispatchServerEmail,
      dispatchServerWhatsApp,
      onSent,
      onClose,
      t,
    });
    markSubmissionCompleted();
  };

  /** Sends one recipient and persists its audit row (previously never recorded). */
  const sendOne = async (recipient: MessagingRecipient): Promise<void> => {
    if (opening || saving || !message.trim()) return;
    const unknownTokens = findUnknownTokens(channel, subject, message);
    if (unknownTokens.length > 0) {
      notifyUnknownTokenErrors(unknownTokens, t);
      return;
    }
    if (useServerGateway) {
      const [validated] = validateMessagingRecipients([recipient], channel);
      if (!validated?.isValid) return;
      await dispatchViaGateway([validated]);
      return;
    }

    const success = executeSend(recipient, message);
    const record = buildSentDispatchRecord({
      recipient,
      message,
      channel,
      subject,
      defaultSubject: t("messaging.defaultSubject"),
      personalizeOptions,
      success,
    });
    // A single send is its own submission: reset the batch counters so the
    // history offset starts at this row.
    auditSavedCountRef.current = 0;
    auditIdempotencyKeyRef.current = null;
    if (!(await saveHistory([record]))) {
      notify.error(t("messaging.singleSendAuditFailed"));
    }
  };

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
      notifyUnknownTokenErrors(unknownTokens, t);
      return;
    }
    const sentRecords: SentDispatchRecord[] = [];
    const record = (recipient: MessagingRecipient, success: boolean): void => {
      sentRecords.push(
        buildSentDispatchRecord({
          recipient,
          message,
          channel,
          subject,
          defaultSubject: t("messaging.defaultSubject"),
          personalizeOptions,
          success,
        }),
      );
    };

    setSaving(true);
    auditSavedCountRef.current = 0;
    auditIdempotencyKeyRef.current = null;
    try {
      if (useServerGateway) {
        setOpening(true);
        await dispatchViaGateway(eligibleRecipients);
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
    sendOne,
    sendAll,
    cancelDispatch,
  };
}
