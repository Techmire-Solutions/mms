import React from "react";
import {
  type Contact,
  type ContactPreferences,
  getDisplayName,
  getPrimaryEmail,
} from "@mms/contracts";
import {
  resolveAllContactEmails,
  resolveAllContactPhones,
  resolveContactPhoneDisplay,
} from "@mms/fe-core/lib/contactI18n";
import { getGenderAccentBarClass } from "@mms/ui/app/directoryCardAccent";
import { DirectoryEntityCard } from "@mms/fe-core/components/DirectoryEntityCard";
import { ContactCardActions } from "./ContactCardActions.js";
import { ContactCardHeader } from "./ContactCardHeader.js";
import { ContactCardDeletedBanner, ContactCardMetadataGrid } from "./ContactCardSections.js";
import type { ContactsColumnConfig } from "../lib/contactTableTypes";
import type { EntityDescriptor } from "@mms/fe-core/components/entityRegistryTypes";
import { useReducedMotion } from "@mms/fe-core/tenant";
import { useTranslation } from "@mms/fe-core/i18n";

export interface ContactCardItemProps {
  contact: Contact;
  /**
   * Resolved once by the directory (`ContactsListCards`) and shared by every
   * card: calling the descriptor hook per card re-flattened the whole field
   * registry for each row on every render.
   */
  descriptor: EntityDescriptor<Contact>;
  isSelected: boolean;
  prefs: ContactPreferences;
  countryCodesMap: Record<string, string>;
  countryCodes: Array<{ country: string; code: string }>;
  contactsMap: Map<string, Contact> | null;
  allContacts: Contact[];
  otherColumns: ContactsColumnConfig[];
  isColumnVisible?: (key: string) => boolean;
  showArchived: boolean;
  canWrite: boolean;
  canDelete: boolean;
  onSelect: (id: string | number) => void;
  onView?: (contact: Contact) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string | number) => void;
  onRestore?: (id: string | number) => void;
  onPermanentDelete?: (id: string | number) => void;
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
  onEmail?: (contacts: Contact[]) => void;
}

/**
 * Contacts Work directory card — DirectoryEntityCard SSOT (do not hand-compose EntityCard).
 */
export const ContactCardItem = React.memo(function ContactCardItem({
  contact,
  descriptor,
  isSelected,
  prefs,
  countryCodesMap,
  countryCodes,
  contactsMap,
  allContacts,
  otherColumns,
  isColumnVisible,
  showArchived,
  canWrite,
  canDelete,
  onSelect,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onPermanentDelete,
  onWhatsApp,
  onSms,
  onEmail,
}: ContactCardItemProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  const { phone, countryCode, phoneDisplay } = resolveContactPhoneDisplay(
    contact,
    prefs,
    countryCodesMap,
    countryCodes,
  );
  const email = getPrimaryEmail(contact);
  const displayName = getDisplayName(contact) || phoneDisplay || email || "";
  const showGenderAccent = !isColumnVisible || isColumnVisible("gender");
  const columnVisibleFn = isColumnVisible ?? (() => true);
  const phones = resolveAllContactPhones(contact, prefs, countryCodesMap, countryCodes);
  const emails = resolveAllContactEmails(contact);

  return (
    <DirectoryEntityCard
      entity={contact}
      selectedIds={isSelected ? [contact.id] : []}
      canSelect
      onToggleSelected={() => onSelect(contact.id)}
      onView={onView}
      onEdit={onEdit}
      reducedMotion={reducedMotion}
      accentClassName={
        showGenderAccent ? getGenderAccentBarClass(isSelected, contact.gender) : undefined
      }
      header={{ displayName }}
      headerSlot={
        <ContactCardHeader
          contact={contact}
          isSelected={isSelected}
          displayName={displayName}
          onSelect={onSelect}
          onView={onView}
          isColumnVisible={isColumnVisible}
          reducedMotion={reducedMotion}
        />
      }
      infoPills={{
        phones,
        emails,
        phone,
        countryCode,
        phoneDisplay,
        email,
        showPhone: columnVisibleFn("phone"),
        showEmail: columnVisibleFn("email"),
        showArchived,
        onWhatsApp: onWhatsApp ? () => onWhatsApp([contact]) : undefined,
        onSms: onSms ? () => onSms([contact]) : undefined,
        onEmail: onEmail ? () => onEmail([contact]) : undefined,
      }}
      metadataSlot={
        <ContactCardMetadataGrid
          contact={contact}
          prefs={prefs}
          allContacts={allContacts}
          contactsMap={contactsMap}
          otherColumns={otherColumns}
          isColumnVisible={columnVisibleFn}
          t={t}
          descriptor={descriptor}
          entity={contact}
        />
      }
      banner={<ContactCardDeletedBanner contact={contact} />}
      footer={
        <ContactCardActions
          contact={contact}
          displayName={displayName}
          showArchived={showArchived}
          canWrite={canWrite}
          canDelete={canDelete}
          onView={onView ? () => onView(contact) : undefined}
          onEdit={onEdit}
          onDelete={onDelete}
          onRestore={onRestore}
          onPermanentDelete={onPermanentDelete}
          onWhatsApp={onWhatsApp}
          onSms={onSms}
          onEmail={onEmail}
        />
      }
    />
  );
});
