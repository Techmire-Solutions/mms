import type { StandardMessagingRecipient as MessagingRecipient } from "@mms/shared";
import { reportClientError } from "@/lib/clientErrorReporting";
import { notify } from "@/lib/notify";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import {
  buildSentDispatchRecord,
  findUnknownTokens,
  validateMessagingRecipients,
  type SentDispatchRecord,
  type ValidatedMessagingRecipient,
} from "./messageComposerDispatchService";
import { notifyUnknownTokenErrors } from "./messageComposerTokenErrors";

export interface SingleSendDeps {
  recipient: MessagingRecipient;
  message: string;
  channel: "sms" | "whatsapp" | "email";
  subject: string;
  useServerGateway: boolean;
  personalizeOptions: { madrasaName?: string };
  t: TranslationFunction;
  /** Latched/busy inputs at call time (guard before starting). */
  isBlocked: () => boolean;
  /** Synchronous latch + busy state for the duration of the send. */
  begin: () => void;
  end: () => void;
  dispatchGateway: (recipients: ValidatedMessagingRecipient[]) => Promise<void>;
  executeSend: (recipient: MessagingRecipient, text: string) => boolean;
  resetAuditCounters: () => void;
  saveHistory: (records: SentDispatchRecord[]) => Promise<boolean>;
}

/**
 * One-recipient send from the composer's recipient rows.
 *
 * Gateway mode dispatches only that recipient (the submission key dedupes a
 * retry); device mode opens the composer and records the audit row. Failures
 * are reported, never thrown: the caller renders the error state.
 */
export async function sendSingleRecipient(deps: SingleSendDeps): Promise<void> {
  const {
    recipient,
    message,
    channel,
    subject,
    useServerGateway,
    personalizeOptions,
    t,
    isBlocked,
    begin,
    end,
    dispatchGateway,
    executeSend,
    resetAuditCounters,
    saveHistory,
  } = deps;

  if (isBlocked() || !message.trim()) return;
  const unknownTokens = findUnknownTokens(channel, subject, message);
  if (unknownTokens.length > 0) {
    notifyUnknownTokenErrors(unknownTokens, t);
    return;
  }

  begin();
  try {
    if (useServerGateway) {
      const [validated] = validateMessagingRecipients([recipient], channel);
      if (!validated?.isValid) return;
      try {
        await dispatchGateway([validated]);
      } catch (error) {
        reportClientError(error, { context: "messaging.composer.sendOne" });
      }
      return;
    }

    const record = buildSentDispatchRecord({
      recipient,
      message,
      channel,
      subject,
      defaultSubject: t("messaging.defaultSubject"),
      personalizeOptions,
      success: executeSend(recipient, message),
    });
    // A single send is its own submission: reset the batch counters so the
    // history offset starts at this row.
    resetAuditCounters();
    if (!(await saveHistory([record]))) {
      notify.error(t("messaging.singleSendAuditFailed"));
    }
  } finally {
    end();
  }
}
