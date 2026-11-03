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
  channel: "sms" | "whatsapp" | "email";
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

export interface DispatchViaServerGatewayArgs {
  channel: "sms" | "whatsapp" | "email";
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

  if (channel === "sms") {
    const res = await dispatchServerSms.mutateAsync({
      recipients: eligibleRecipients.map((recipient) => ({
        id: recipient.id,
        phone: recipient.phone ?? "",
        name: recipient.name,
      })),
      message,
      category,
      idempotencyKey,
    });
    if (res.queued) {
      notify.info(
        t("messaging.campaignQueuedNotice", { count: String(eligibleRecipients.length) }),
      );
      onClose();
      return;
    }
    if (res.replayed || (res.sentCount === 0 && (res.skippedCount ?? 0) > 0)) {
      notify.info(
        t("messaging.dispatchAlreadySent", {
          count: String(res.skippedCount ?? res.sentCount),
        }),
      );
      onClose();
      return;
    }
    if (res.sentCount > 0) {
      onSent?.(toCompletedRecords(eligibleRecipients, message, personalizeOptions));
    }
    notifyServerDispatchOutcome({
      channel: "sms",
      sentCount: res.sentCount,
      failedCount: res.failedCount,
      t,
    });
    onClose();
    return;
  }

  if (channel === "email") {
    const res = await dispatchServerEmail.mutateAsync({
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
    if (res.queued) {
      notify.info(
        t("messaging.campaignQueuedNotice", { count: String(eligibleRecipients.length) }),
      );
      onClose();
      return;
    }
    if (res.replayed || (res.sentCount === 0 && (res.skippedCount ?? 0) > 0)) {
      notify.info(
        t("messaging.dispatchAlreadySent", {
          count: String(res.skippedCount ?? res.sentCount),
        }),
      );
      onClose();
      return;
    }
    if (res.sentCount > 0) {
      onSent?.(
        toCompletedRecords(
          eligibleRecipients,
          message,
          personalizeOptions,
          subject || t("messaging.defaultSubject"),
        ),
      );
    }
    notifyServerDispatchOutcome({
      channel: "email",
      sentCount: res.sentCount,
      failedCount: res.failedCount,
      t,
    });
    onClose();
    return;
  }

  const res = await dispatchServerWhatsApp.mutateAsync({
    recipients: eligibleRecipients.map((recipient) => ({
      id: recipient.id,
      phone: recipient.phone ?? "",
      name: recipient.name,
    })),
    message,
    category,
    idempotencyKey,
  });
  if (res.queued) {
    notify.info(t("messaging.campaignQueuedNotice", { count: String(eligibleRecipients.length) }));
    onClose();
    return;
  }
  if (res.replayed || (res.sentCount === 0 && (res.skippedCount ?? 0) > 0)) {
    notify.info(
      t("messaging.dispatchAlreadySent", {
        count: String(res.skippedCount ?? res.sentCount),
      }),
    );
    onClose();
    return;
  }
  if (res.sentCount > 0) {
    onSent?.(toCompletedRecords(eligibleRecipients, message, personalizeOptions));
  }
  notifyServerDispatchOutcome({
    channel: "whatsapp",
    sentCount: res.sentCount,
    failedCount: res.failedCount,
    t,
  });
  onClose();
}
