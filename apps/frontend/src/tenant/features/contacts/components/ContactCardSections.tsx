import React from "react";
import type { Contact, ContactPreferences } from "@mms/shared";
import { EntityCardInfoPills } from "@/components/app/EntityCardInfoPills";
import { resolveAllContactPhones, resolveAllContactEmails } from "@/lib/contacts/contactI18n";

export {
  ContactCardMetadataGrid,
  ContactCardDeletedBanner,
} from "@/tenant/features/contacts/components/ContactCardMetadataGrid";

export interface ContactCardInfoPillsProps {
  contact?: Contact;
  prefs?: ContactPreferences;
  countryCodesMap?: Record<string, string>;
  countryCodes?: Array<{ country: string; code: string }>;
  phone?: string | null;
  countryCode?: string;
  phoneDisplay?: string;
  email?: string | null;
  displayName?: string;
  showArchived?: boolean;
  isColumnVisible: (key: string) => boolean;
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
  onEmail?: (contacts: Contact[]) => void;
}

/** Contacts face phone/email pills — shared EntityCardInfoPills chrome with inline contact actions (multi-channel). */
export function ContactCardInfoPills({
  contact,
  prefs,
  countryCodesMap,
  countryCodes,
  phone,
  countryCode,
  phoneDisplay,
  email,
  displayName,
  showArchived,
  isColumnVisible,
  onWhatsApp,
  onSms,
  onEmail,
}: ContactCardInfoPillsProps): React.JSX.Element | null {
  const allPhones = (() => {
    if (contact) {
      return resolveAllContactPhones(contact, prefs, countryCodesMap, countryCodes);
    }
    return phone
      ? [{ phone, countryCode: countryCode || "", phoneDisplay: phoneDisplay || phone }]
      : [];
  })();

  const allEmails = (() => {
    if (contact) {
      return resolveAllContactEmails(contact);
    }
    return email ? [{ email }] : [];
  })();

  return (
    <EntityCardInfoPills
      phones={allPhones}
      emails={allEmails}
      displayName={displayName}
      showPhone={isColumnVisible("phone")}
      showEmail={isColumnVisible("email")}
      showArchived={showArchived}
      onWhatsApp={onWhatsApp && contact ? () => onWhatsApp([contact]) : undefined}
      onSms={onSms && contact ? () => onSms([contact]) : undefined}
      onEmail={onEmail && contact ? () => onEmail([contact]) : undefined}
    />
  );
}
