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
  /** True when the workspace gateway dispatches; false when the device app opens. */
  useServerGateway: boolean;
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

  // One key per channel: concatenating translated fragments around raw numbers
  // cannot be word-ordered correctly in ar/ur/fa.
  const key = isEmail
    ? "messaging.composerSummaryEmail"
    : isSms
      ? "messaging.composerSummarySms"
      : "messaging.composerSummaryWhatsapp";
  return t(key, { eligible: String(eligibleCount), total: String(total) });
}

export function getComposerNote(
  t: TranslationFunction,
  channel: "sms" | "whatsapp" | "email",
  useServerGateway: boolean,
): string {
  // The note is the last thing a user reads before an irreversible send, so it
  // must describe the mode that will actually run (`mms-messaging` §7).
  if (useServerGateway) {
    if (channel === "email") return t("messaging.gatewayNoteEmail");
    if (channel === "sms") return t("messaging.gatewayNoteSms");
    return t("messaging.gatewayNoteWhatsapp");
  }
  if (channel === "email") return t("messaging.bulkEmailDesc");
  if (channel === "sms") return t("messaging.smsManualSendNote");
  return t("messaging.whatsappBulkManualNote");
}

/** Per-recipient "send one" label for the current dispatch mode. */
export function getRecipientSendLabel({
  t,
  channel,
  isServerGateway,
  isValid,
}: {
  t: TranslationFunction;
  channel: "sms" | "whatsapp" | "email";
  isServerGateway: boolean;
  isValid: boolean;
}): string {
  if (!isValid) return t("messaging.skippedStatus");
  if (isServerGateway) {
    if (channel === "email") return t("messaging.gatewaySendEmail");
    if (channel === "sms") return t("messaging.gatewaySendSms");
    return t("messaging.gatewaySendWhatsapp");
  }
  if (channel === "email") return t("messaging.sendEmail");
  if (channel === "sms") return t("messaging.openSmsApp");
  return t("messaging.openWhatsapp");
}

export function getComposerSaveLabel({
  t,
  step,
  channel,
  localRecipients,
  eligibleCount,
  pendingAudit,
  opening,
  useServerGateway,
}: MessageComposerTextProps): string {
  if (step === "pick") return t("common.next");
  if (pendingAudit) return t("messaging.retrySaveHistory");
  const isEmail = channel === "email";
  const isSms = channel === "sms";
  const isBulk = localRecipients.length > 1;
  const count = String(eligibleCount);

  if (useServerGateway) {
    if (isBulk) return t("messaging.gatewaySendAll", { count });
    if (isEmail) return t("messaging.gatewaySendEmail");
    if (isSms) return t("messaging.gatewaySendSms");
    return t("messaging.gatewaySendWhatsapp");
  }

  if (opening) return isEmail ? t("messaging.openingMail") : t("messaging.openingTabs");

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
