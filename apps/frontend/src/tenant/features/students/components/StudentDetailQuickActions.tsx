import { useTranslation } from "@/hooks/useTranslation";
import { EntityMessagingActions } from "@/components/app/EntityMessagingActions";
import { toMessagingRecipient, type Student } from "@mms/shared";

type MessageChannel = "whatsapp" | "sms" | "email";

export interface StudentDetailQuickActionsProps {
  student: Student;
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  hasWhatsAppContact?: boolean;
  openComposer: (
    channel: MessageChannel,
    recipients: ReturnType<typeof toMessagingRecipient>[],
  ) => void;
}

export function StudentDetailQuickActions({
  student,
  primaryPhone,
  primaryEmail,
  hasWhatsAppContact,
  openComposer,
}: StudentDetailQuickActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <EntityMessagingActions
      variant="button-group"
      primaryPhone={primaryPhone}
      primaryEmail={primaryEmail}
      labels={{
        call: t("students.detail.call"),
        whatsapp: t("students.list.actionWhatsApp"),
        sms: t("students.list.actionSms"),
        email: t("students.list.actionEmail"),
      }}
      callAriaLabel={
        primaryPhone ? t("students.detail.callPhone", { phone: primaryPhone }) : undefined
      }
      onWhatsApp={
        primaryPhone && hasWhatsAppContact
          ? () =>
              openComposer("whatsapp", [toMessagingRecipient({ ...student, phone: primaryPhone })])
          : undefined
      }
      onSms={
        primaryPhone
          ? () => openComposer("sms", [toMessagingRecipient({ ...student, phone: primaryPhone })])
          : undefined
      }
      onEmail={
        primaryEmail
          ? () =>
              openComposer("email", [
                toMessagingRecipient({ ...student, name: student.name || "", email: primaryEmail }),
              ])
          : undefined
      }
    />
  );
}
