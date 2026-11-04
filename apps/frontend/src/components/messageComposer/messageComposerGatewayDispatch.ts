import type { MessageTemplate } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type {
  SentDispatchRecord,
  ValidatedMessagingRecipient,
} from "./messageComposerDispatchService";
import { dispatchViaServerGateway } from "./messageComposerServerGateway";

export interface GatewayDispatchArgs {
  channel: "sms" | "whatsapp" | "email";
  activeTemplates: MessageTemplate[];
  templateId: string;
  message: string;
  subject: string;
  personalizeOptions: { madrasaName?: string };
  /** Retry-stable key minted per submission (see messageComposerSubmissionKey). */
  submissionKeyFor: (recipients: ValidatedMessagingRecipient[]) => string;
  markSubmissionCompleted: () => void;
  dispatchServerSms: Parameters<typeof dispatchViaServerGateway>[0]["dispatchServerSms"];
  dispatchServerEmail: Parameters<typeof dispatchViaServerGateway>[0]["dispatchServerEmail"];
  dispatchServerWhatsApp: Parameters<typeof dispatchViaServerGateway>[0]["dispatchServerWhatsApp"];
  onSent?: (sent: SentDispatchRecord[]) => void;
  onClose: () => void;
  t: TranslationFunction;
}

/** Builds the composer→server-gateway dispatcher (category from the template). */
export function createGatewayDispatch({
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
}: GatewayDispatchArgs): (recipients: ValidatedMessagingRecipient[]) => Promise<void> {
  return async (targetRecipients) => {
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
}
