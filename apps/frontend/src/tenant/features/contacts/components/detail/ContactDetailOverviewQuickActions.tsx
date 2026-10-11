import { type Contact, hasWhatsApp } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { EntityMessagingActions } from "@/components/ui/EntityMessagingActions";

export interface ContactDetailOverviewQuickActionsProps {
  contact: Contact;
  primaryPhone: string | null;
  primaryEmail: string | null;
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
  onEmail?: (contacts: Contact[]) => void;
}

export function ContactDetailOverviewQuickActions({
  contact,
  primaryPhone,
  primaryEmail,
  onWhatsApp,
  onSms,
  onEmail,
}: ContactDetailOverviewQuickActionsProps): React.JSX.Element | null {
  const { t } = useTranslation();
  if (contact.deletedAt) return null;

  return (
    <EntityMessagingActions
      variant="button-group"
      primaryPhone={primaryPhone}
      primaryEmail={primaryEmail}
      labels={{
        call: t("contacts.detail.call"),
        whatsapp: t("contacts.whatsapp"),
        sms: t("contacts.sms"),
        email: t("contacts.detail.emailAction"),
      }}
      callAriaLabel={`${t("contacts.detail.call")} ${primaryPhone ?? ""}`}
      onWhatsApp={onWhatsApp && hasWhatsApp(contact) ? () => onWhatsApp([contact]) : undefined}
      onSms={onSms && primaryPhone ? () => onSms([contact]) : undefined}
      onEmail={onEmail && primaryEmail ? () => onEmail([contact]) : undefined}
    />
  );
}
