import { type Contact, PuppeteerWhatsAppProvider } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { formatContactPhoneFull, resolvePhoneLabel } from "@/lib/contacts/contactI18n";
import { CollectionRowItem } from "./ContactDetailShared";
import { DetailSectionCard } from "@/components/ui/DetailSectionCard";
import { COLLECTION_CONTAINER_CLASS } from "./contactDetailStyles";
import { DetailCollectionEmpty, withPrimaryPhone } from "./contactDetailChannelHelpers";
import { buildDetailPhoneMessagingActions } from "./contactDetailMessagingActions";

export interface ContactDetailPhonesSectionProps {
  contact: Contact;
  phoneLabels: string[];
  defaultPhoneCountryCode: string;
  allowOutbound?: boolean;
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
}

export function ContactDetailPhonesSection({
  contact,
  phoneLabels,
  defaultPhoneCountryCode,
  allowOutbound = true,
  onWhatsApp,
  onSms,
}: ContactDetailPhonesSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const phones = contact.phones && contact.phones.length > 0 ? contact.phones : [];

  return (
    <DetailSectionCard
      className={COLLECTION_CONTAINER_CLASS}
      title={t("contacts.form.phonesLabel")}
    >
      {phones.length === 0 ? (
        <DetailCollectionEmpty title={t("contacts.detail.emptyPhones")} />
      ) : (
        phones.map((phone, phoneIndex) => {
          const formattedPhone = formatContactPhoneFull(
            phone.number,
            phone.countryCode || defaultPhoneCountryCode,
          );
          const hasWa = Boolean(PuppeteerWhatsAppProvider.getNumberId(formattedPhone));
          const actions =
            allowOutbound && formattedPhone
              ? buildDetailPhoneMessagingActions({
                  phone: formattedPhone,
                  callTitle: t("contacts.detail.callPhone", { phone: formattedPhone }),
                  whatsappTitle:
                    onWhatsApp && hasWa
                      ? t("contacts.detail.whatsappPhone", { phone: formattedPhone })
                      : undefined,
                  smsTitle: onSms
                    ? t("contacts.detail.smsPhone", { phone: formattedPhone })
                    : undefined,
                  onWhatsApp:
                    onWhatsApp && hasWa
                      ? () => onWhatsApp([withPrimaryPhone(contact, phone)])
                      : undefined,
                  onSms: onSms ? () => onSms([withPrimaryPhone(contact, phone)]) : undefined,
                })
              : [];

          return (
            <CollectionRowItem
              key={`phone-${phone.number}-${phoneIndex}`}
              label={resolvePhoneLabel(phone.label, phoneLabels, t)}
              value={formattedPhone}
              actions={actions}
            />
          );
        })
      )}
    </DetailSectionCard>
  );
}
