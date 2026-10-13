import type { StandardMessagingRecipient as MessagingRecipient } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface MessageComposerTextProps {
  t: TranslationFunction;
  step: "pick" | "compose";
  channel: "sms" | "whatsapp" | "email";
  localRecipients: MessagingRecipient[];
  eligibleCount: number;
  pendingAudit: boolean;
  opening: boolean;
}

export function getComposerTitle({
  t,
  step,
  channel,
  localRecipients,
}: Pick<MessageComposerTextProps, "t" | "step" | "channel" | "localRecipients">): string {
  if (step === "pick") return t("messaging.selectRecipients");
  const isBulk = localRecipients.length > 1;
  const isEmail = channel === "email";
  const isSms = channel === "sms";
  const firstRecipientName = localRecipients[0]?.name ?? "";

  if (isBulk) {
    return isEmail
      ? t("messaging.bulkEmailTitle")
      : isSms
        ? t("messaging.bulkSmsTitle")
        : t("messaging.bulkWhatsappTitle");
  }
  return isEmail
    ? `${t("messaging.sendEmail")} – ${firstRecipientName}`
    : isSms
      ? `${t("messaging.sms")} – ${firstRecipientName}`
      : t("messaging.whatsappSingleTitle", { name: firstRecipientName });
}

export function getComposerSubtitle({
  t,
  step,
  channel,
  localRecipients,
  eligibleCount,
}: Pick<MessageComposerTextProps, "t" | "step" | "channel" | "localRecipients" | "eligibleCount">):
  string | undefined {
  if (step === "pick") return t("messaging.selectRecipientsDesc");
  if (localRecipients.length <= 1) return undefined;
  const total = localRecipients.length;
  const isEmail = channel === "email";
  const isSms = channel === "sms";

  return isEmail
    ? `${eligibleCount} ${t("messaging.of")} ${total} ${t("messaging.selectRecipientsDesc")}`
    : isSms
      ? `${eligibleCount} ${t("messaging.of")} ${total} ${t("messaging.contactsHavePhone")}`
      : `${eligibleCount} ${t("messaging.of")} ${total} ${t("messaging.contactsHaveWhatsapp")}`;
}

export function getComposerNote(
  t: TranslationFunction,
  channel: "sms" | "whatsapp" | "email",
): string {
  if (channel === "email") return t("messaging.bulkEmailDesc");
  if (channel === "sms") return t("messaging.smsManualSendNote");
  return t("messaging.whatsappBulkManualNote");
}

export function getComposerSaveLabel({
  t,
  step,
  channel,
  localRecipients,
  eligibleCount,
  pendingAudit,
  opening,
}: MessageComposerTextProps): string {
  if (step === "pick") return t("common.next");
  if (pendingAudit) return t("messaging.retrySaveHistory");
  const isEmail = channel === "email";
  const isSms = channel === "sms";
  if (opening) return isEmail ? t("messaging.openingMail") : t("messaging.openingTabs");
  const isBulk = localRecipients.length > 1;
  const count = String(eligibleCount);

  return isEmail
    ? isBulk
      ? t("messaging.openAllMail", { count })
      : t("messaging.openMailDraft")
    : isSms
      ? t("messaging.openSmsApp")
      : isBulk
        ? `${t("messaging.openAllWhatsapp")} (${count})`
        : t("messaging.openWhatsapp");
}
