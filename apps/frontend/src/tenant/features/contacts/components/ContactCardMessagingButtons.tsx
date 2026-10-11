import type React from "react";
import { type Contact, hasWhatsApp } from "@mms/shared";
import { EntityMessagingActions } from "@/components/ui/EntityMessagingActions";
import { useTranslation } from "@/hooks/useTranslation";

export interface HasContactCardFaceChannelsParams {
  contact: Contact;
  phone: string | null;
  email: string | null;
  showArchived?: boolean;
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
  onEmail?: (contacts: Contact[]) => void;
}

/** True when the card face shows Call / WA / SMS / Email controls. */
export function hasContactCardFaceChannels({
  contact,
  phone,
  email,
  showArchived = false,
  onWhatsApp,
  onSms,
  onEmail,
}: HasContactCardFaceChannelsParams): boolean {
  if (showArchived) return false;
  return (
    Boolean(phone) ||
    Boolean(onWhatsApp && hasWhatsApp(contact)) ||
    Boolean(onSms && phone) ||
    Boolean(onEmail && email)
  );
}

export interface ContactCardMessagingButtonsProps {
  contact: Contact;
  displayName: string;
  phone: string | null;
  email: string | null;
  showArchived?: boolean;
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
  onEmail?: (contacts: Contact[]) => void;
}

export function ContactCardMessagingButtons({
  contact,
  displayName,
  phone,
  email,
  showArchived = false,
  onWhatsApp,
  onSms,
  onEmail,
}: ContactCardMessagingButtonsProps): React.JSX.Element | null {
  const { t } = useTranslation();

  return (
    <EntityMessagingActions
      variant="icon-row"
      primaryPhone={phone}
      primaryEmail={email}
      showArchived={showArchived}
      labels={{
        call: t("contacts.detail.call"),
        whatsapp: t("contacts.whatsapp"),
        sms: t("contacts.sms"),
        email: t("contacts.detail.emailAction"),
      }}
      callAriaLabel={t("contacts.detail.callContact", { name: displayName })}
      whatsappAriaLabel={t("contacts.detail.whatsappContact", { name: displayName })}
      smsAriaLabel={t("contacts.detail.smsContact", { name: displayName })}
      emailAriaLabel={t("contacts.detail.emailNamedContact", { name: displayName })}
      onWhatsApp={onWhatsApp && hasWhatsApp(contact) ? () => onWhatsApp([contact]) : undefined}
      onSms={onSms && phone ? () => onSms([contact]) : undefined}
      onEmail={onEmail && email ? () => onEmail([contact]) : undefined}
    />
  );
}
