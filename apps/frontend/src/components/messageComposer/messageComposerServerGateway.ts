import {
  personalizeMessage,
  type StandardMessagingRecipient as MessagingRecipient,
} from "@mms/shared";
import { notify } from "@/lib/notify";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type {
  SentDispatchRecord,
  ValidatedMessagingRecipient,
} from "./messageComposerDispatchService";

export interface ServerDispatchResult {
  sentCount: number;
  failedCount?: number;
  total?: number;
  queued?: boolean;
  /** Recipients already claimed by an earlier attempt of this submission. */
  skippedCount?: number;
  /** The server replayed a stored response instead of sending again. */
  replayed?: boolean;
}

type DispatchChannel = "sms" | "whatsapp" | "email";

export function toCompletedRecords(
  recipients: MessagingRecipient[],
  msg: string,
  opts: { madrasaName?: string },
  subj?: string,
): SentDispatchRecord[] {
  return recipients.map((r) => ({
    recipientId: r.id,
    body: personalizeMessage(msg, r, opts),
    subject: subj ? personalizeMessage(subj, r, opts) : undefined,
    status: "sent",
  }));
}

export interface ServerDispatchOutcomeArgs {
  channel: DispatchChannel;
  sentCount: number;
  failedCount?: number;
  t: TranslationFunction;
}

export function notifyServerDispatchOutcome({
  channel,
  sentCount,
  failedCount = 0,
  t,
}: ServerDispatchOutcomeArgs): void {
  if (sentCount === 0 && failedCount > 0) {
    notify.error(t("messaging.serverDispatchFailed", { count: String(failedCount) }));
    return;
  }
  if (sentCount > 0 && failedCount > 0) {
    notify.warning(
      t("messaging.serverPartialSuccess", {
        sent: String(sentCount),
        failed: String(failedCount),
      }),
    );
    return;
  }
  if (channel === "sms") {
    notify.success(t("messaging.serverSmsSuccess", { count: String(sentCount) }));
  } else if (channel === "email") {
    notify.success(t("messaging.serverEmailSuccess", { count: String(sentCount) }));
  } else {
    notify.success(t("messaging.serverWhatsAppSuccess", { count: String(sentCount) }));
  }
}

interface ApplyServerDispatchResultArgs {
  channel: DispatchChannel;
  result: ServerDispatchResult;
  eligibleRecipients: ValidatedMessagingRecipient[];
  message: string;
  subject: string;
  personalizeOptions: { madrasaName?: string };
  onSent?: (sent: SentDispatchRecord[]) => void;
  onClose: () => void;
  t: TranslationFunction;
}

/**
 * Shared post-response handling for every channel: queued campaign, replayed
 * submission, success/partial success and close. Payload construction stays in
 * the channel branch; this only decides what the user sees.
 */
function applyServerDispatchResult({
  channel,
  result,
  eligibleRecipients,
  message,
  subject,
  personalizeOptions,
  onSent,
  onClose,
  t,
}: ApplyServerDispatchResultArgs): void {
  const alreadySentCount = result.skippedCount ?? result.sentCount;
  if (result.queued) {
    notify.info(t("messaging.campaignQueuedNotice", { count: String(eligibleRecipients.length) }));
    onClose();
    return;
  }
  if (result.replayed || (result.sentCount === 0 && (result.skippedCount ?? 0) > 0)) {
    notify.info(t("messaging.dispatchAlreadySent", { count: String(alreadySentCount) }));
    onClose();
    return;
  }
  if (result.sentCount > 0) {
    onSent?.(
      toCompletedRecords(
        eligibleRecipients,
        message,
        personalizeOptions,
        channel === "email" ? subject : undefined,
      ),
    );
  }
  notifyServerDispatchOutcome({
    channel,
    sentCount: result.sentCount,
    failedCount: result.failedCount,
    t,
  });
  onClose();
}

export interface DispatchViaServerGatewayArgs {
  channel: DispatchChannel;
  eligibleRecipients: ValidatedMessagingRecipient[];
  message: string;
  subject: string;
  category: string;
  /**
   * Per-submission key minted by the composer (retry-stable, never derived from
   * the body). The server binds it to the canonical body digest.
   */
  idempotencyKey: string;
  personalizeOptions: { madrasaName?: string };
  dispatchServerSms: {
    mutateAsync: (args: {
      recipients: { id: string | number; phone: string; name: string }[];
      message: string;
      category?: string;
      idempotencyKey: string;
    }) => Promise<ServerDispatchResult>;
  };
  dispatchServerEmail: {
    mutateAsync: (args: {
      recipients: { id: string | number; email: string; name: string }[];
      subject: string;
      message: string;
      category?: string;
      idempotencyKey: string;
    }) => Promise<ServerDispatchResult>;
  };
  dispatchServerWhatsApp: {
    mutateAsync: (args: {
      recipients: { id: string | number; phone: string; name: string }[];
      message: string;
      category?: string;
      idempotencyKey: string;
    }) => Promise<ServerDispatchResult>;
  };
  onSent?: (sent: SentDispatchRecord[]) => void;
  onClose: () => void;
  t: TranslationFunction;
}

export async function dispatchViaServerGateway(args: DispatchViaServerGatewayArgs): Promise<void> {
  const {
    channel,
    eligibleRecipients,
    message,
    subject,
    category,
    idempotencyKey,
    personalizeOptions,
    dispatchServerSms,
    dispatchServerEmail,
    dispatchServerWhatsApp,
    onSent,
    onClose,
    t,
  } = args;

  let result: ServerDispatchResult;
  if (channel === "sms") {
    result = await dispatchServerSms.mutateAsync({
      recipients: eligibleRecipients.map((recipient) => ({
        id: recipient.id,
        phone: recipient.phone ?? "",
        name: recipient.name,
      })),
      message,
      category,
      idempotencyKey,
    });
  } else if (channel === "email") {
    result = await dispatchServerEmail.mutateAsync({
      recipients: eligibleRecipients.map((recipient) => ({
        id: recipient.id,
        email: recipient.email ?? "",
        name: recipient.name,
      })),
      subject: subject || t("messaging.defaultSubject"),
      message,
      category,
      idempotencyKey,
    });
  } else {
    result = await dispatchServerWhatsApp.mutateAsync({
      recipients: eligibleRecipients.map((recipient) => ({
        id: recipient.id,
        phone: recipient.phone ?? "",
        name: recipient.name,
      })),
      message,
      category,
      idempotencyKey,
    });
  }

  applyServerDispatchResult({
    channel,
    result,
    eligibleRecipients,
    message,
    // Email completes its records with the subject actually sent.
    subject: subject || t("messaging.defaultSubject"),
    personalizeOptions,
    onSent,
    onClose,
    t,
  });
}
