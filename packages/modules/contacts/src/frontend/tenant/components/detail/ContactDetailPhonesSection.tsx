import { type Contact, PuppeteerWhatsAppProvider } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { formatContactPhoneFull, resolvePhoneLabel } from "@mms/fe-core/lib/contactI18n";
import { CollectionRowItem } from "./ContactDetailShared.js";
import { DetailSectionCard } from "@mms/fe-core/components/DetailSectionCard";
import { COLLECTION_CONTAINER_CLASS } from "./contactDetailStyles.js";
import { DetailCollectionEmpty, withPrimaryPhone } from "./contactDetailChannelHelpers.js";
import { buildDetailPhoneMessagingActions } from "./contactDetailMessagingActions.js";

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
              dir="ltr"
              actions={actions}
            />
          );
        })
      )}
    </DetailSectionCard>
  );
}
