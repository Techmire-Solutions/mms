import React from "react";
import { motion } from "framer-motion";
import { TableCell } from "@/components/ui/table";
import { getDisplayName, type Contact, type ContactPreferences } from "@mms/shared";
import { type useTranslation } from "@/hooks/useTranslation";
import { useListRowMotion } from "@/hooks/useListRowMotion";
import { ContactsRowActions } from "@/tenant/features/contacts/components/ContactsRowActions";
import { MODULE_ROW_ACTIONS_TRIGGER_CLASS } from "@/components/app/ModuleRowActionsMenu";
import { renderContactTableCell } from "@/tenant/features/contacts/components/ContactTableCells";
import { type ContactsColumnConfig } from "@/tenant/features/contacts/lib/contactTableTypes";
import { ModuleTableSelectionCell } from "@/components/app/ModuleTableSelectionCell";
import { cn } from "@/lib/utils";

export type { ContactsColumnConfig };

export interface ContactTableRowProps {
  contact: Contact;
  isSelected: boolean;
  columns: ContactsColumnConfig[];
  getColumnWidth: (key: string) => number | undefined;
  prefs: ContactPreferences;
  countryCodesMap: Record<string, string>;
  countryCodes: Array<{ country: string; code: string }>;
  contactsMap: Map<string, Contact> | null;
  allContacts: Contact[];
  showArchived: boolean;
  canWrite: boolean;
  canDelete: boolean;
  t: ReturnType<typeof useTranslation>["t"];
  onSelect: (id: number | string) => void;
  onView?: (contact: Contact) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contactId: number | string) => void;
  onRestore?: (contactId: number | string) => void;
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
  onEmail?: (contacts: Contact[]) => void;
}

export const ContactTableRow = React.memo(function ContactTableRow({
  contact,
  isSelected,
  columns,
  getColumnWidth,
  prefs,
  countryCodesMap,
  countryCodes,
  contactsMap,
  allContacts,
  showArchived,
  canWrite,
  canDelete,
  t,
  onSelect,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onWhatsApp,
  onSms,
  onEmail,
}: ContactTableRowProps): React.JSX.Element {
  const displayName = getDisplayName(contact);
  const rowMotion = useListRowMotion({ layout: "position", fade: true, duration: 0.1 });

  return (
    <motion.tr
      {...rowMotion()}
      className={cn("hover:bg-muted/20 transition-colors group", isSelected && "bg-primary/5")}
    >
      <ModuleTableSelectionCell
        checked={isSelected}
        onCheckedChange={() => onSelect(contact.id)}
        ariaLabel={t("contacts.table.selectContact", { name: displayName })}
      />
      {columns.map((col) =>
        renderContactTableCell({
          col,
          contact,
          displayName,
          getColumnWidth,
          prefs,
          countryCodesMap,
          countryCodes,
          contactsMap,
          allContacts,
          showArchived,
          isSelected,
          t,
          onView,
          onWhatsApp,
        }),
      )}
      <TableCell className="px-4 py-3">
        <ContactsRowActions
          contact={contact}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onRestore={onRestore}
          onWhatsApp={onWhatsApp}
          onSms={onSms}
          onEmail={onEmail}
          showArchived={showArchived}
          canWrite={canWrite}
          canDelete={canDelete}
          triggerClassName={MODULE_ROW_ACTIONS_TRIGGER_CLASS}
        />
      </TableCell>
    </motion.tr>
  );
});
