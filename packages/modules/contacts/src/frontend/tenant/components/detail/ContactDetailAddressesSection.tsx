import { MapPin } from "lucide-react";
import type { Contact } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { resolveAddressLabel } from "@mms/fe-core/lib/contactI18n";
import { ContactDetailExternalLinkSection } from "./ContactDetailExternalLinkSection.js";

export interface ContactDetailAddressesSectionProps {
  contact: Contact;
  addressLabels: string[];
}

export function ContactDetailAddressesSection({
  contact,
  addressLabels,
}: ContactDetailAddressesSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const addresses = contact.addresses ?? [];

  return (
    <ContactDetailExternalLinkSection
      title={t("contacts.detail.addresses")}
      emptyMessage={t("contacts.detail.emptyAddresses")}
      emptyDash={t("contacts.table.emptyDash")}
      actionIcon={MapPin}
      actionTitle={t("contacts.detail.openInMaps")}
      rows={addresses.map((address, addressIndex) => {
        const fullAddr = [address.line1, address.city, address.state, address.country]
          .filter(Boolean)
          .join(", ");
        return {
          key: `address-${addressIndex}`,
          label: resolveAddressLabel(address.label, addressLabels, t),
          value: fullAddr,
          href: fullAddr ? `https://maps.google.com/?q=${encodeURIComponent(fullAddr)}` : undefined,
        };
      })}
    />
  );
}
