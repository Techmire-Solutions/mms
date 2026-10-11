import React, { useMemo } from "react";
import { type Contact, getDisplayName } from "@mms/shared";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import { useTranslation } from "@/hooks/useTranslation";
import { buildContactsMap } from "@/lib/contacts/contactI18n";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import { type ContactsColumnConfig } from "@/tenant/features/contacts/components/ContactTableRow";
import { WorkBatchTable, type WorkBatchTableColumn } from "@/components/common/work/WorkBatchTable";
import { renderContactTableCell } from "@/tenant/features/contacts/components/ContactTableCells";
import { ContactsRowActions } from "@/tenant/features/contacts/components/ContactsRowActions";
import { MODULE_ROW_ACTIONS_TRIGGER_CLASS } from "@/components/ui/ModuleRowActionsMenu";

export interface ContactsListDesktopTableProps {
  contacts: Contact[];
  selected: (number | string)[];
  onSelect: (contactId: number | string) => void;
  onSelectAll: () => void;
  onView?: (contact: Contact) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contactId: number | string) => void;
  onRestore?: (contactId: number | string) => void;
  showArchived?: boolean;
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
  onEmail?: (contacts: Contact[]) => void;
  sortField: string;
  sortDir: "asc" | "desc";
  onSort: (field: string) => void;
  columns?: ContactsColumnConfig[];
  allContacts?: Contact[];
  canWrite?: boolean;
  canDelete?: boolean;
  allSelected?: boolean;
  someSelected?: boolean;
}

export const ContactsListDesktopTable = React.memo(function ContactsListDesktopTable({
  contacts,
  selected,
  onSelect,
  onSelectAll,
  onView,
  onEdit,
  onDelete,
  onRestore,
  showArchived = false,
  onWhatsApp,
  onSms,
  onEmail,
  sortField,
  sortDir,
  onSort,
  columns = [],
  allContacts = [],
  canWrite = false,
  canDelete = false,
  allSelected = false,
  someSelected = false,
}: ContactsListDesktopTableProps): React.JSX.Element {
  const { prefs, countryCodesMap, countryCodes, getColumnWidth, setColumnWidth } =
    useContactConfig();
  const { t } = useTranslation();

  const contactsMap = useMemo(() => buildContactsMap(allContacts), [allContacts]);
  const pageCountLabel = formatDirectoryPageCountLabel(contacts.length, t, {
    singular: "contacts.form.contact",
    plural: "contacts.table.contacts",
  });

  const finalColumns = useMemo<WorkBatchTableColumn<Contact>[]>(() => {
    return columns.map((col) => ({
      id: col.id,
      label: col.label,
      sortField: col.id,
      width: col.width,
      render: (row, _idx) => {
        const isSelected = selected.includes(row.id) || selected.includes(String(row.id));
        return renderContactTableCell({
          col,
          contact: row,
          displayName: getDisplayName(row),
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
        });
      },
    }));
  }, [
    columns,
    getColumnWidth,
    prefs,
    countryCodesMap,
    countryCodes,
    contactsMap,
    allContacts,
    showArchived,
    t,
    onView,
    onWhatsApp,
    selected,
  ]);

  return (
    <WorkBatchTable
      data={contacts}
      columns={finalColumns}
      selection={{
        selectedIds: selected,
        onSelectOne: (id) => onSelect(id),
        onSelectAll,
        allSelected,
        someSelected,
      }}
      sort={{
        field: sortField,
        dir: sortDir,
        onSort,
      }}
      columnResize={{
        getColumnWidth,
        onColumnResize: setColumnWidth,
      }}
      actionsLabel={t("contacts.table.actions")}
      renderRowActions={(contact) => (
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
      )}
      stickyColumnId="name"
      footerCount={{
        selectedCountLabel: t("contacts.selectedCount", { count: selected.length }),
        pageCountLabel,
      }}
    />
  );
});

export default ContactsListDesktopTable;
