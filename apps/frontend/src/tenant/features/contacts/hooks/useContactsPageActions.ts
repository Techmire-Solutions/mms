import { useCallback } from "react";
import type { Contact } from "@mms/contracts";
import type { useContactsCrudActions } from "@/tenant/features/contacts/hooks/useContactsCrudActions";
import { useContactsPageDeleteActions } from "@/tenant/features/contacts/hooks/useContactsPageDeleteActions";
import { useContactsPageWriteActions } from "@/tenant/features/contacts/hooks/useContactsPageWriteActions";

type CrudActions = ReturnType<typeof useContactsCrudActions>;

/** Write/bulk/import/merge handlers for Contacts Work (overlay state stays in page state). */
export function useContactsPageActions({
  canWrite,
  canDelete,
  workContacts,
  linkContacts,
  selected,
  setSelected,
  shownCount,
  editContact,
  setEditContact,
  setShowForm,
  setShowDuplicates,
  openingDuplicates,
  setOpeningDuplicates,
  deleteTarget,
  setDeleteTarget,
  setBulkDeleteOpen,
  setBulkRestoreOpen,
  crud,
}: {
  canWrite: boolean;
  canDelete: boolean;
  workContacts: Contact[];
  /** Resolved linked contacts for drawer/edit (batch `/resolve`), not a full-tenant dump. */
  linkContacts: Contact[];
  selected: Array<string | number>;
  setSelected: (ids: Array<string | number>) => void;
  shownCount: number;
  editContact: Contact | null;
  setEditContact: (contact: Contact | null) => void;
  setShowForm: (open: boolean) => void;
  setShowDuplicates: (open: boolean) => void;
  openingDuplicates: boolean;
  setOpeningDuplicates: (open: boolean) => void;
  deleteTarget: { id: string | number; name?: string } | null;
  setDeleteTarget: (target: { id: string | number; name?: string } | null) => void;
  setBulkDeleteOpen: (open: boolean) => void;
  setBulkRestoreOpen: (open: boolean) => void;
  crud: Pick<
    CrudActions,
    | "updateContact"
    | "handleError"
    | "notifyBulkResult"
    | "saveContact"
    | "removeContact"
    | "mergeContacts"
    | "importContacts"
    | "bulkTagContacts"
    | "bulkDeleteContactsAction"
    | "restoreContactAction"
    | "bulkRestoreContactsAction"
  >;
}) {
  const findContactById = useCallback(
    (id: string | number): Contact | undefined =>
      workContacts.find((contact) => contact.id === id) ??
      linkContacts.find((contact) => contact.id === id),
    [workContacts, linkContacts],
  );

  const writeActions = useContactsPageWriteActions({
    canWrite,
    shownCount,
    selected,
    setSelected,
    editContact,
    setEditContact,
    setShowForm,
    setShowDuplicates,
    openingDuplicates,
    setOpeningDuplicates,
    crud,
  });

  const deleteActions = useContactsPageDeleteActions({
    canDelete,
    selected,
    setSelected,
    deleteTarget,
    setDeleteTarget,
    setBulkDeleteOpen,
    setBulkRestoreOpen,
    findContactById,
    crud,
  });

  return {
    ...writeActions,
    ...deleteActions,
  };
}
