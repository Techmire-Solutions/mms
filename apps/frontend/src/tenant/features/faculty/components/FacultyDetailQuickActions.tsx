import { useTranslation } from "@/hooks/useTranslation";
import { EntityMessagingActions } from "@/components/ui/EntityMessagingActions";
import { facultyMessagingLabels } from "@/lib/faculty/facultyMessagingLabels";
import { toMessagingRecipient, type Faculty } from "@mms/shared";

type MessageChannel = "whatsapp" | "sms" | "email";

export interface FacultyDetailQuickActionsProps {
  faculty: Faculty;
  displayName: string;
  primaryPhone: string | null | undefined;
  primaryEmail: string | null | undefined;
  /** Whether the primary phone resolves to a WhatsApp number (PuppeteerWhatsAppProvider). */
  hasWhatsAppContact?: boolean;
  canWriteMessaging: boolean;
  onOpenComposer: (
    channel: MessageChannel,
    recipients: ReturnType<typeof toMessagingRecipient>[],
  ) => void;
}

export function FacultyDetailQuickActions({
  faculty,
  displayName,
  primaryPhone,
  primaryEmail,
  hasWhatsAppContact,
  canWriteMessaging,
  onOpenComposer,
}: FacultyDetailQuickActionsProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const labels = facultyMessagingLabels(t);

  return (
    <EntityMessagingActions
      variant="button-group"
      primaryPhone={primaryPhone}
      primaryEmail={primaryEmail}
      labels={labels}
      callAriaLabel={
        primaryPhone ? t("faculty.detail.callPhone", { phone: primaryPhone }) : undefined
      }
      messagingEnabled={canWriteMessaging}
      onWhatsApp={
        primaryPhone && hasWhatsAppContact && canWriteMessaging
          ? () =>
              onOpenComposer("whatsapp", [
                toMessagingRecipient({ ...faculty, phone: primaryPhone, name: displayName }),
              ])
          : undefined
      }
      onSms={
        primaryPhone && canWriteMessaging
          ? () =>
              onOpenComposer("sms", [
                toMessagingRecipient({ ...faculty, phone: primaryPhone, name: displayName }),
              ])
          : undefined
      }
      onEmail={
        primaryEmail && canWriteMessaging
          ? () =>
              onOpenComposer("email", [
                toMessagingRecipient({ ...faculty, email: primaryEmail, name: displayName }),
              ])
          : undefined
      }
    />
  );
}
