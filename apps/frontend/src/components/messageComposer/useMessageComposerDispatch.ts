import { useEffect, useRef, useState } from "react";
import {
  type MessageTemplate,
  type StandardMessagingRecipient as MessagingRecipient,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { reportClientError } from "@/lib/clientErrorReporting";
import { useMessagingMutations } from "@/hooks/useMessaging";
import {
  buildSentDispatchRecord,
  executeRecipientSend,
  findUnknownTokens,
  saveDispatchHistory,
  type DispatchSpeed,
  type SentDispatchRecord,
  type ValidatedMessagingRecipient,
} from "./messageComposerDispatchService";
import { runDeviceDispatchBatch } from "./messageComposerDeviceDispatch";
import { createGatewayDispatch } from "./messageComposerGatewayDispatch";
import { sendSingleRecipient } from "./messageComposerSingleSend";
import { useComposerRecipientValidation } from "./useComposerRecipientValidation";
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
  // Synchronous in-flight latch: state only flips on the next render, so two
  // activations in one frame could otherwise start two dispatches.
  const inFlightRef = useRef(false);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  const personalizeOptions = { madrasaName: madrasaName || undefined };
  const { validatedRecipients, eligibleRecipients, skippedRecipients } =
    useComposerRecipientValidation(recipients, channel);

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
  const dispatchViaGateway = createGatewayDispatch({
    channel,
    activeTemplates,
    templateId,
    message,
    subject,
    personalizeOptions,
    submissionKeyFor,
    markSubmissionCompleted,
    dispatchServerSms,
    dispatchServerEmail,
    dispatchServerWhatsApp,
    onSent,
    onClose,
    t,
  });

  const sendOne = async (recipient: MessagingRecipient): Promise<void> =>
    sendSingleRecipient({
      recipient,
      message,
      channel,
      subject,
      useServerGateway: Boolean(useServerGateway),
      personalizeOptions,
      t,
      isBlocked: () => opening || saving || inFlightRef.current,
      begin: () => {
        inFlightRef.current = true;
        setSaving(true);
      },
      end: () => {
        inFlightRef.current = false;
        setSaving(false);
      },
      dispatchGateway: dispatchViaGateway,
      executeSend,
      resetAuditCounters: () => {
        auditSavedCountRef.current = 0;
        auditIdempotencyKeyRef.current = null;
      },
      saveHistory,
    });

  const sendAll = async (): Promise<void> => {
    if (opening || saving || inFlightRef.current) return;

    if (pendingAudit) {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setSaving(true);
      try {
        if (!(await saveHistory(pendingAudit))) return;
        const completed = pendingAudit;
        setPendingAudit(null);
        auditSavedCountRef.current = 0;
        onSent?.(completed);
        onClose();
      } finally {
        inFlightRef.current = false;
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

    inFlightRef.current = true;
    setSaving(true);
    auditSavedCountRef.current = 0;
    auditIdempotencyKeyRef.current = null;
    try {
      if (useServerGateway) {
        setOpening(true);
        try {
          await dispatchViaGateway(eligibleRecipients);
        } catch (error) {
          // Mutation `onError` already notified the user; keep the composer
          // open so the retry reuses the same submission key.
          reportClientError(error, { context: "messaging.composer.sendAll" });
        }
        return;
      }

      let sentRecords: SentDispatchRecord[];
      if (eligibleRecipients.length === 1) {
        const recipient = eligibleRecipients[0];
        sentRecords = [
          buildSentDispatchRecord({
            recipient,
            message,
            channel,
            subject,
            defaultSubject: t("messaging.defaultSubject"),
            personalizeOptions,
            success: executeSend(recipient, message),
          }),
        ];
      } else {
        setOpening(true);
        setIsPaused(false);
        cancelRef.current = false;
        sentRecords = await runDeviceDispatchBatch({
          recipients: eligibleRecipients,
          message,
          channel,
          subject,
          dispatchSpeed,
          personalizeOptions,
          defaultSubject: t("messaging.defaultSubject"),
          executeSend,
          isCancelled: () => cancelRef.current,
          isPaused: () => pausedRef.current,
          onProgress: (current, total) => setDispatchProgress({ current, total }),
        });
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
      inFlightRef.current = false;
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
