import {
  findUnknownPersonalizationTokens,
  generateClientEntityId,
  MESSAGE_LOG_RECORD_BATCH_MAX,
  personalizeMessage,
  PuppeteerWhatsAppProvider,
  validateRecipientAddress,
  type MessageLogCreateDto,
  type MessageTemplate,
  type StandardMessagingRecipient as MessagingRecipient,
} from "@mms/shared";
import { openDeviceSmsComposer } from "@/lib/deviceSms";

export type DispatchSpeed = "safe" | "normal" | "express";

export const SPEED_DELAYS: Record<DispatchSpeed, number> = {
  safe: 1200,
  normal: 600,
  express: 300,
};

export type ValidatedMessagingRecipient = MessagingRecipient & {
  isValid: boolean;
  address?: string;
  reason?: string;
};

export function validateMessagingRecipients(
  recipients: MessagingRecipient[],
  channel: "sms" | "whatsapp" | "email",
): ValidatedMessagingRecipient[] {
  return recipients.map((recipient) => {
    const validation = validateRecipientAddress(recipient, channel);
    return {
      ...recipient,
      isValid: validation.isValid,
      address: validation.address,
      reason: validation.reason,
    };
  });
}

export function findUnknownTokens(
  channel: "sms" | "whatsapp" | "email",
  subject: string,
  message: string,
): string[] {
  const unknownBodyTokens = findUnknownPersonalizationTokens(message);
  const unknownSubjectTokens = channel === "email" ? findUnknownPersonalizationTokens(subject) : [];
  return [...new Set([...unknownBodyTokens, ...unknownSubjectTokens])];
}

export type SentDispatchRecord = {
  recipientId: string | number;
  body: string;
  subject?: string;
  status: "sent" | "failed";
};

export interface ExecuteRecipientSendParams {
  channel: "sms" | "whatsapp" | "email";
  recipient: MessagingRecipient;
  text: string;
  subject: string;
  personalizeOptions: { madrasaName?: string };
  defaultSubject: string;
}

export function executeRecipientSend({
  channel,
  recipient,
  text,
  subject,
  personalizeOptions,
  defaultSubject,
}: ExecuteRecipientSendParams): boolean {
  const personalizedBody = personalizeMessage(text, recipient, personalizeOptions);
  if (channel === "email") {
    if (!recipient.email) return false;
    const personalizedSubject = personalizeMessage(
      subject || defaultSubject,
      recipient,
      personalizeOptions,
    );
    window.open(
      `mailto:${recipient.email}?subject=${encodeURIComponent(personalizedSubject)}&body=${encodeURIComponent(personalizedBody)}`,
      "_blank",
      "noopener,noreferrer",
    );
    // `noopener` may make the returned handle null even when the composer opens,
    // so success is "the call did not throw", not "a WindowProxy was returned".
    return true;
  }
  if (!recipient.phone) return false;
  if (channel === "sms") return openDeviceSmsComposer(recipient.phone, personalizedBody);
  const numberId = PuppeteerWhatsAppProvider.getNumberId(recipient.phone);
  if (!numberId) return false;
  window.open(
    `https://wa.me/${numberId}?text=${encodeURIComponent(personalizedBody)}`,
    "_blank",
    "noopener,noreferrer",
  );
  return true;
}

export interface SaveDispatchHistoryParams {
  sentRecords: SentDispatchRecord[];
  user: unknown;
  activeTemplates: MessageTemplate[];
  templateId: string;
  channel: "sms" | "whatsapp" | "email";
  subject: string;
  recordDispatches: {
    mutateAsync: (args: {
      body: { logs: MessageLogCreateDto[]; idempotencyKey: string };
    }) => Promise<unknown>;
  };
  auditSavedCountRef: React.MutableRefObject<number>;
  auditIdempotencyKeyRef: React.MutableRefObject<string | null>;
}

export async function saveDispatchHistory({
  sentRecords,
  user,
  activeTemplates,
  templateId,
  channel,
  subject,
  recordDispatches,
  auditSavedCountRef,
  auditIdempotencyKeyRef,
}: SaveDispatchHistoryParams): Promise<boolean> {
  if (!sentRecords.length || !user) return true;
  const activeTemplate = activeTemplates.find((template) => template.id === templateId);
  const pending = sentRecords.slice(auditSavedCountRef.current);
  if (!pending.length) return true;

  if (!auditIdempotencyKeyRef.current) {
    auditIdempotencyKeyRef.current = generateClientEntityId("msg", "-");
  }
  const idempotencyKey = auditIdempotencyKeyRef.current;

  for (let index = 0; index < pending.length; index += MESSAGE_LOG_RECORD_BATCH_MAX) {
    const chunk = pending.slice(index, index + MESSAGE_LOG_RECORD_BATCH_MAX);
    const messages: MessageLogCreateDto[] = chunk.map((record) => ({
      contactId: record.recipientId,
      channel,
      body: record.body,
      status: record.status,
      subject: channel === "email" ? record.subject || subject || undefined : undefined,
      category: activeTemplate?.category || "general",
    }));
    try {
      await recordDispatches.mutateAsync({
        body: {
          logs: messages,
          idempotencyKey: `${idempotencyKey}:${auditSavedCountRef.current + index}`,
        },
      });
      auditSavedCountRef.current += chunk.length;
    } catch {
      return false;
    }
  }
  return true;
}
