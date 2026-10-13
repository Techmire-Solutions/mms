import React from "react";
import {
  type Contact,
  type ContactPreferences,
  getDisplayName,
  getPrimaryEmail,
} from "@mms/shared";
import {
  resolveAllContactEmails,
  resolveAllContactPhones,
  resolveContactPhoneDisplay,
} from "@/lib/contacts/contactI18n";
import { getGenderAccentBarClass } from "@/lib/ui/directoryCardAccent";
import { DirectoryCard } from "@/components/app/DirectoryCard";
import { ContactCardActions } from "@/tenant/features/contacts/components/ContactCardActions";
import { ContactCardHeader } from "@/tenant/features/contacts/components/ContactCardHeader";
import {
  ContactCardDeletedBanner,
  ContactCardMetadataGrid,
} from "@/tenant/features/contacts/components/ContactCardSections";
import type { ContactsColumnConfig } from "@/tenant/features/contacts/components/ContactTableRow";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactEntityDescriptor } from "@/tenant/features/contacts/hooks/useContactEntityDescriptor";

export interface ContactCardItemProps {
  contact: Contact;
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
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
  onEmail?: (contacts: Contact[]) => void;
}

/**
 * Contacts Work directory card — DirectoryCard SSOT (do not hand-compose EntityCard).
 */
export const ContactCardItem = React.memo(function ContactCardItem({
  contact,
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
  onWhatsApp,
  onSms,
  onEmail,
}: ContactCardItemProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const contactDescriptor = useContactEntityDescriptor();

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
    <DirectoryCard
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
          descriptor={contactDescriptor}
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
          onWhatsApp={onWhatsApp}
          onSms={onSms}
          onEmail={onEmail}
        />
      }
    />
  );
});
