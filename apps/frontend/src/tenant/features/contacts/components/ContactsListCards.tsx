import React, { useMemo } from "react";
import { CONTACT_CARD_FACE_COLUMN_IDS, getVisibleWorkColumns, type Contact } from "@mms/shared";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import { buildContactsMap } from "@/lib/contacts/contactI18n";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import { useTranslation } from "@/hooks/useTranslation";
import { ModuleDirectoryCards } from "@/components/app/ModuleDirectoryCards";
import type { ContactsColumnConfig } from "@/tenant/features/contacts/components/ContactTableRow";
import { ContactCardItem } from "@/tenant/features/contacts/components/ContactCardItem";

export interface ContactsListCardsProps {
  contacts: Contact[];
  selected: (string | number)[];
  onSelect: (id: string | number) => void;
  onView?: (contact: Contact) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string | number) => void;
  onRestore?: (id: string | number) => void;
  showArchived?: boolean;
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
  onEmail?: (contacts: Contact[]) => void;
  allContacts?: Contact[];
  canWrite?: boolean;
  canDelete?: boolean;
  columns?: ContactsColumnConfig[];
  onSelectAll?: () => void;
  allSelected?: boolean;
  someSelected?: boolean;
}

/** Mobile-first card directory with dynamic, config-driven preferences. */
export const ContactsListCards = React.memo(function ContactsListCards({
  contacts,
  selected,
  onSelect,
  onView,
  onEdit,
  onDelete,
  onRestore,
  showArchived = false,
  onWhatsApp,
  onSms,
  onEmail,
  allContacts = [],
  canWrite = false,
  canDelete = false,
  columns = [],
  onSelectAll,
  allSelected = false,
  someSelected = false,
}: ContactsListCardsProps): React.JSX.Element {
  const { t } = useTranslation();
  const {
    prefs,
    countryCodesMap,
    countryCodes,
    columnRegistry,
    isColumnVisible: isRegistryColumnVisible,
  } = useContactConfig();

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const contactsMap = useMemo(() => buildContactsMap(allContacts), [allContacts]);

  const isColumnVisible = useMemo(() => {
    if (columns.length > 0) {
      const visibleIds = new Set(columns.map((col) => col.id));
      return (id: string) => visibleIds.has(id);
    }
    return isRegistryColumnVisible;
  }, [columns, isRegistryColumnVisible]);

  const otherColumns = useMemo(() => {
    const metaColumns = getVisibleWorkColumns(columnRegistry, isColumnVisible, {
      excludeFace: CONTACT_CARD_FACE_COLUMN_IDS,
    });
    if (columns.length > 0) {
      const metaKeys = new Set(metaColumns.map((col) => col.key));
      return columns.filter((col) => metaKeys.has(col.id));
    }
    return metaColumns.map((col): ContactsColumnConfig => ({
      id: col.key,
      label: col.label,
    }));
  }, [columnRegistry, isColumnVisible, columns]);

  const pageCountLabel = formatDirectoryPageCountLabel(contacts.length, t, {
    singular: "contacts.form.contact",
    plural: "contacts.table.contacts",
  });

  return (
    <ModuleDirectoryCards
      items={contacts}
      selectedIds={selected}
      onSelectAll={onSelectAll}
      allSelected={allSelected}
      someSelected={someSelected}
      selectAllLabel={t("contacts.table.selectAll")}
      deselectAllLabel={t("common.deselect")}
      selectedCountLabel={t("contacts.selectedCount", { count: selected.length })}
      pageCountLabel={pageCountLabel}
      checkboxIdPrefix="contacts"
      renderItem={(contact) => (
        <ContactCardItem
          key={contact.id}
          contact={contact}
          isSelected={selectedSet.has(contact.id)}
          prefs={prefs}
          countryCodesMap={countryCodesMap}
          countryCodes={countryCodes}
          contactsMap={contactsMap}
          allContacts={allContacts}
          otherColumns={otherColumns}
          isColumnVisible={isColumnVisible}
          showArchived={showArchived}
          canWrite={canWrite}
          canDelete={canDelete}
          onSelect={onSelect}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onRestore={onRestore}
          onWhatsApp={onWhatsApp}
          onSms={onSms}
          onEmail={onEmail}
        />
      )}
    />
  );
});

export default ContactsListCards;
