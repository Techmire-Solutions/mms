import { useMemo, type ComponentProps } from "react";
import type { Contact } from "@mms/contracts";
import type ContactsListCards from "../components/ContactsListCards";
import type ContactsListDesktopTable from "../components/ContactsListDesktopTable";
import { getDirectoryPageSelection } from "@mms/fe-core/lib/directorySelection";
import type { useContactsDirectory } from "./useContactsDirectory.js";
import type { useContactsMessagingActions } from "./useContactsMessagingActions.js";
import type { useContactsPageActions } from "./useContactsPageActions.js";
import type { useContactsPageOverlayState } from "./useContactsPageOverlayState.js";
import type { ContactsColumnConfig } from "../lib/contactTableTypes";

type Directory = ReturnType<typeof useContactsDirectory>;
type Overlay = ReturnType<typeof useContactsPageOverlayState>;
type Messaging = ReturnType<typeof useContactsMessagingActions>;
type Actions = ReturnType<typeof useContactsPageActions>;

/** Builds ContactsListCards / ContactsListDesktopTable props from page directory slices. */
export function useContactsPageDirectoryProps({
  directory,
  overlay,
  messaging,
  actions,
  viewingDeleted,
  canWrite,
  canDelete,
  tableColumns,
}: {
  directory: Directory;
  overlay: Pick<Overlay, "setViewContact">;
  messaging: Pick<Messaging, "canWriteMessaging" | "handleWhatsApp" | "handleSms" | "handleEmail">;
  actions: Pick<Actions, "handleEdit" | "handleDelete" | "handleRestore">;
  viewingDeleted: boolean;
  canWrite: boolean;
  canDelete: boolean;
  tableColumns: ContactsColumnConfig[];
}) {
  const {
    workContacts,
    selected,
    handleSelect,
    handleSelectRange,
    handleSelectAll,
    allContactsForLinks,
    sortField,
    sortDir,
    handleSort,
  } = directory;

  const messagingHandlers = useMemo(() => {
    if (!messaging.canWriteMessaging || viewingDeleted) {
      return { onWhatsApp: undefined, onSms: undefined, onEmail: undefined };
    }
    return {
      onWhatsApp: messaging.handleWhatsApp,
      onSms: messaging.handleSms,
      onEmail: messaging.handleEmail,
    };
  }, [
    messaging.canWriteMessaging,
    viewingDeleted,
    messaging.handleWhatsApp,
    messaging.handleSms,
    messaging.handleEmail,
  ]);

  const pageSelection = useMemo(
    () =>
      getDirectoryPageSelection(
        workContacts.map((contact: Contact) => contact.id),
        selected,
      ),
    [workContacts, selected],
  );

  const commonDirectoryProps = useMemo(
    (): ComponentProps<typeof ContactsListCards> => ({
      contacts: workContacts,
      selected,
      onSelect: handleSelect,
      onSelectAll: handleSelectAll,
      onView: overlay.setViewContact,
      onEdit: actions.handleEdit,
      onDelete: actions.handleDelete,
      onRestore: actions.handleRestore,
      showArchived: viewingDeleted,
      ...messagingHandlers,
      allContacts: allContactsForLinks,
      canWrite,
      canDelete,
      columns: tableColumns,
      allSelected: pageSelection.allSelected,
      someSelected: pageSelection.someSelected,
    }),
    [
      workContacts,
      selected,
      handleSelect,
      handleSelectAll,
      overlay.setViewContact,
      actions.handleEdit,
      actions.handleDelete,
      actions.handleRestore,
      viewingDeleted,
      messagingHandlers,
      allContactsForLinks,
      canWrite,
      canDelete,
      tableColumns,
      pageSelection.allSelected,
      pageSelection.someSelected,
    ],
  );

  const tableProps = useMemo(
    (): ComponentProps<typeof ContactsListDesktopTable> => ({
      contacts: workContacts,
      selected,
      onSelect: handleSelect,
      onSelectRange: handleSelectRange,
      onSelectAll: handleSelectAll,
      onView: overlay.setViewContact,
      onEdit: actions.handleEdit,
      onDelete: actions.handleDelete,
      onRestore: actions.handleRestore,
      showArchived: viewingDeleted,
      ...messagingHandlers,
      allContacts: allContactsForLinks,
      canWrite,
      canDelete,
      columns: tableColumns,
      sortField,
      sortDir,
      onSort: handleSort,
      allSelected: pageSelection.allSelected,
      someSelected: pageSelection.someSelected,
    }),
    [
      workContacts,
      selected,
      handleSelect,
      handleSelectRange,
      handleSelectAll,
      overlay.setViewContact,
      actions.handleEdit,
      actions.handleDelete,
      actions.handleRestore,
      viewingDeleted,
      messagingHandlers,
      allContactsForLinks,
      canWrite,
      canDelete,
      tableColumns,
      sortField,
      sortDir,
      handleSort,
      pageSelection.allSelected,
      pageSelection.someSelected,
    ],
  );

  return { messagingHandlers, commonDirectoryProps, tableProps };
}
