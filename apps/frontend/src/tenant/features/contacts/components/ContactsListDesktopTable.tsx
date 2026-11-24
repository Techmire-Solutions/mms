import React, { useMemo } from "react";
import { type Contact, getDisplayName, resolveContactColumnSortField } from "@mms/contracts";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import { useTranslation } from "@/hooks/useTranslation";
import { buildContactsMap } from "@/lib/contacts/contactI18n";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import type { WorkTableDensity } from "@/hooks/useWorkTableDensity";
import { type ContactsColumnConfig } from "@/tenant/features/contacts/lib/contactTableTypes";
import { WorkBatchTable, type WorkBatchTableColumn } from "@/components/common/work/WorkBatchTable";
import { renderContactTableCell } from "@/tenant/features/contacts/components/ContactTableCells";
import { ContactsRowActions } from "@/tenant/features/contacts/components/ContactsRowActions";
import { MODULE_ROW_ACTIONS_TRIGGER_CLASS } from "@/components/app/ModuleRowActionsMenu";

export interface ContactsListDesktopTableProps {
  contacts: Contact[];
  selected: (number | string)[];
  onSelect: (contactId: number | string) => void;
  onSelectRange?: (contactId: number | string) => void;
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
  onReorderColumn?: (
    sourceColumnId: string,
    targetColumnId: string,
    position: "before" | "after",
  ) => void;
  /** Row density (padding-based). Defaults to "standard". */
  density?: WorkTableDensity;
}

export const ContactsListDesktopTable = React.memo(function ContactsListDesktopTable({
  contacts,
  selected,
  onSelect,
  onSelectRange,
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
  onReorderColumn: propOnReorderColumn,
  density = "standard",
}: ContactsListDesktopTableProps): React.JSX.Element {
  const {
    prefs,
    countryCodesMap,
    countryCodes,
    getColumnWidth,
    setColumnWidth,
    columnRegistry,
    updateUserColumnLayout,
  } = useContactConfig();
  const { t } = useTranslation();

  const contactsMap = useMemo(() => buildContactsMap(allContacts), [allContacts]);
  const pageCountLabel = formatDirectoryPageCountLabel(contacts.length, t, {
    singular: "contacts.form.contact",
    plural: "contacts.table.contacts",
  });

  const handleReorderColumn = React.useCallback(
    (sourceId: string, targetId: string, position: "before" | "after") => {
      if (propOnReorderColumn) {
        propOnReorderColumn(sourceId, targetId, position);
        return;
      }
      if (!columnRegistry || columnRegistry.length === 0 || sourceId === targetId) return;
      if (sourceId === "name" || targetId === "name") return;

      const visible = [...columnRegistry]
        .filter((c) => c.enabled)
        .sort((a, b) => a.order - b.order);
      const visibleKeys = visible.map((c) => c.key);

      const sourceIdx = visibleKeys.indexOf(sourceId);
      if (sourceIdx === -1) return;

      const newKeys = [...visibleKeys];
      newKeys.splice(sourceIdx, 1);
      const targetIdx = newKeys.indexOf(targetId);
      if (targetIdx === -1) return;

      const insertIdx = position === "after" ? targetIdx + 1 : targetIdx;
      newKeys.splice(insertIdx, 0, sourceId);

      const updated = columnRegistry.map((col) => {
        const orderIdx = newKeys.indexOf(col.key);
        if (orderIdx !== -1) {
          return { ...col, order: orderIdx };
        }
        return col;
      });

      updateUserColumnLayout(updated);
    },
    [columnRegistry, updateUserColumnLayout, propOnReorderColumn],
  );

  const finalColumns = useMemo<WorkBatchTableColumn<Contact>[]>(() => {
    return columns.map((col) => {
      // Only columns the server can order get a sort button: an unsupported key
      // fell back to id order, so the header toggled but the rows never moved.
      const sortField = resolveContactColumnSortField(col.id);
      return {
        id: col.id,
        label: col.label,
        sortField,
        sortable: Boolean(sortField),
        width: col.width,
        kind: col.kind,
        render: (row, idx) => {
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
            isSelected: false,
            t,
            onView,
            onWhatsApp,
            rowIndex: idx,
          });
        },
      };
    });
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
  ]);

  return (
    <WorkBatchTable
      data={contacts}
      columns={finalColumns}
      selection={{
        selectedIds: selected,
        onSelectOne: (id) => onSelect(id),
        onSelectRange,
        onSelectAll,
        allSelected,
        someSelected,
        selectAllAriaLabel: t("contacts.table.selectAll"),
        selectRowAriaLabel: (contact) =>
          t("contacts.table.selectContact", { name: getDisplayName(contact) }),
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
      onReorderColumn={handleReorderColumn}
      isColumnDraggable={(colId) => colId !== "name"}
      onRowClick={onView ? (contact) => onView(contact) : undefined}
      density={density}
      footerCount={{
        selectedCountLabel: t("contacts.selectedCount", { count: selected.length }),
        pageCountLabel,
      }}
    />
  );
});

export default ContactsListDesktopTable;
