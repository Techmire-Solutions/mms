import type { StandardMessagingRecipient as MessagingRecipient } from "@mms/shared";
import {
  buildSentDispatchRecord,
  SPEED_DELAYS,
  type DispatchSpeed,
  type SentDispatchRecord,
  type ValidatedMessagingRecipient,
} from "./messageComposerDispatchService";

export interface DeviceBatchDispatchArgs {
  recipients: ValidatedMessagingRecipient[];
  message: string;
  channel: "sms" | "whatsapp" | "email";
  subject: string;
  dispatchSpeed: DispatchSpeed;
  personalizeOptions: { madrasaName?: string };
  defaultSubject: string;
  executeSend: (recipient: MessagingRecipient, text: string) => boolean;
  isCancelled: () => boolean;
  isPaused: () => boolean;
  /** Called after each recipient so the caller can render progress. */
  onProgress: (current: number, total: number) => void;
}

/**
 * Device-gateway batch loop (opens the SMS/WhatsApp composer per recipient).
 *
 * Extracted from the composer dispatch hook so the hook stays under the
 * 300-line ceiling; cancellation/pause are polled through callbacks so the loop
 * never reads React state directly.
 */
export async function runDeviceDispatchBatch({
  recipients,
  message,
  channel,
  subject,
  dispatchSpeed,
  personalizeOptions,
  defaultSubject,
  executeSend,
  isCancelled,
  isPaused,
  onProgress,
}: DeviceBatchDispatchArgs): Promise<SentDispatchRecord[]> {
  const sentRecords: SentDispatchRecord[] = [];

  for (let index = 0; index < recipients.length; index += 1) {
    if (isCancelled()) break;
    while (isPaused() && !isCancelled()) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (isCancelled()) break;

    const recipient = recipients[index];
    const success = executeSend(recipient, message);
    sentRecords.push(
      buildSentDispatchRecord({
        recipient,
        message,
        channel,
        subject,
        defaultSubject,
        personalizeOptions,
        success,
      }),
    );
    onProgress(index + 1, recipients.length);

    if (index < recipients.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, SPEED_DELAYS[dispatchSpeed]));
    }
  }

  return sentRecords;
}
